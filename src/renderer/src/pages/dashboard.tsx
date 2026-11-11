import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Chip, Input, Progress, Switch, Tooltip } from '@heroui/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import PubSub from 'pubsub-js'
import BasePage from '@renderer/components/base/base-page'
import { toast } from '@renderer/components/base/toast'
import { openCommandPalette } from '@renderer/components/base/command-palette'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { useRules } from '@renderer/hooks/use-rules'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import dayjs from '@renderer/utils/dayjs'
import {
  getFilePath,
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  mihomoGroupDelay,
  mihomoVersion,
  patchMihomoConfig,
  readTextFile,
  restartCore,
  triggerSysProxy,
  updateTrayIcon,
  updateTrayIconImmediate
} from '@renderer/utils/ipc'
import {
  LuRefreshCw,
  LuFileCode,
  LuArrowUpRight,
  LuMinimize2,
  LuMaximize2,
  LuSearch,
  LuCheck
} from 'react-icons/lu'

const ConfigViewer = lazy(() => import('@renderer/components/sider/config-viewer'))

const COMPACT_MODE_STORAGE_KEY = 'clash_party_dashboard_compact_mode'

const DashboardPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { profileConfig, addProfileItem, changeCurrentProfile } = useProfileConfig()
  const { groups = [], mutate: mutateGroups } = useGroups()
  const { rules } = useRules()
  const { data: version, mutate: mutateVersion } = useSWR('mihomoVersion', mihomoVersion)

  const sysProxyEnabled = appConfig?.sysProxy?.enable ?? false
  const tunEnabled = controledMihomoConfig?.tun?.enable ?? false
  const mode = controledMihomoConfig?.mode ?? 'rule'
  const autoCloseConnection = appConfig?.autoCloseConnection ?? true
  const isProtected = sysProxyEnabled || tunEnabled

  const { current, items = [] } = profileConfig || {}
  const activeProfile = useMemo(
    () =>
      items.find((item) => item && item.id === current) ?? {
        id: 'default',
        type: 'local' as const,
        name: t('sider.cards.emptyProfile')
      },
    [items, current, t]
  )

  const [compactMode, setCompactMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COMPACT_MODE_STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  const [showImportDrawer, setShowImportDrawer] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [showRuntimeConfig, setShowRuntimeConfig] = useState(false)
  const [testingGroup, setTestingGroup] = useState(false)
  const [restartingCore, setRestartingCore] = useState(false)

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  const [memory, setMemory] = useState(0)
  const [trafficHistory, setTrafficHistory] = useState<number[]>(Array(24).fill(0))

  useEffect(() => {
    try {
      localStorage.setItem(COMPACT_MODE_STORAGE_KEY, String(compactMode))
    } catch {
      // ignore
    }
  }, [compactMode])

  useEffect(() => {
    const onTraffic = (_e: unknown, ...args: unknown[]): void => {
      const info = args[0] as IMihomoTrafficInfo
      setUpload(info.up)
      setDownload(info.down)
      setTrafficHistory((prev) => [...prev.slice(1), info.up + info.down])
    }
    const onMemory = (_e: unknown, ...args: unknown[]): void => {
      const info = args[0] as IMihomoMemoryInfo
      setMemory(info.inuse)
    }
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutateVersion()
    })
    const unsubTraffic = window.electron.ipcRenderer.on('mihomoTraffic', onTraffic)
    const unsubMemory = window.electron.ipcRenderer.on('mihomoMemory', onMemory)
    return (): void => {
      unsubTraffic()
      unsubMemory()
      PubSub.unsubscribe(token)
    }
  }, [mutateVersion])

  const checkClipboardForUrl = useCallback(async (): Promise<void> => {
    try {
      const text = (await navigator.clipboard.readText())?.trim()
      if (text && /^https?:\/\/\S+/i.test(text)) {
        setClipboardUrl(text)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (items.length === 0 || showImportDrawer) {
      void checkClipboardForUrl()
    }
  }, [items.length, showImportDrawer, checkClipboardForUrl])

  const primaryGroup = useMemo(() => {
    if (groups.length === 0) return undefined
    if (mode === 'global') {
      return groups.find((g) => g.name === 'GLOBAL') ?? groups[0]
    }
    return groups.find((g) => g.type === 'Selector' && g.name !== 'GLOBAL') ?? groups[0]
  }, [groups, mode])

  const activeNode = useMemo(() => {
    if (!primaryGroup) return undefined
    return primaryGroup.all?.find((p) => p.name === primaryGroup.now)
  }, [primaryGroup])

  const activeNodeDelay = useMemo(() => {
    if (!activeNode?.history?.length) return -1
    return activeNode.history[activeNode.history.length - 1].delay
  }, [activeNode])

  const handleToggleSysProxy = async (enable: boolean): Promise<void> => {
    const previousState = !enable
    updateTrayIconImmediate(enable, tunEnabled)
    try {
      await patchAppConfig({ sysProxy: { enable } })
      await triggerSysProxy(enable)
      window.electron.ipcRenderer.send('updateFloatingWindow')
      window.electron.ipcRenderer.send('updateTrayMenu')
    } catch (e) {
      await patchAppConfig({ sysProxy: { enable: previousState } })
      updateTrayIconImmediate(previousState, tunEnabled)
      toast.error(String(e))
    }
  }

  const handleToggleTun = async (enable: boolean): Promise<void> => {
    updateTrayIconImmediate(sysProxyEnabled, enable)
    if (enable) {
      try {
        const hasPermissions = await window.electron.ipcRenderer.invoke(
          'checkMihomoCorePermissions'
        )
        if (!hasPermissions) {
          if (window.electron.process.platform === 'win32') {
            const confirmed = await window.electron.ipcRenderer.invoke('showTunPermissionDialog')
            if (confirmed) {
              try {
                const notification = new Notification(t('tun.permissions.restarting'))
                await window.electron.ipcRenderer.invoke('restartAsAdmin')
                notification.close()
                return
              } catch (error) {
                await window.electron.ipcRenderer.invoke(
                  'showErrorDialog',
                  t('tun.permissions.failed'),
                  String(error)
                )
                updateTrayIconImmediate(sysProxyEnabled, false)
                return
              }
            } else {
              updateTrayIconImmediate(sysProxyEnabled, false)
              return
            }
          } else {
            try {
              await window.electron.ipcRenderer.invoke('requestTunPermissions')
            } catch (error) {
              await window.electron.ipcRenderer.invoke(
                'showErrorDialog',
                t('tun.permissions.failed'),
                String(error)
              )
              updateTrayIconImmediate(sysProxyEnabled, false)
              return
            }
          }
        }
      } catch {
        // ignore
      }
      await patchControledMihomoConfig({ tun: { enable }, dns: { enable: true } })
      const autoRunEnabled = await window.electron.ipcRenderer.invoke('checkAutoRun')
      if (autoRunEnabled) {
        await window.electron.ipcRenderer.invoke('enableAutoRun')
      }
    } else {
      await patchControledMihomoConfig({ tun: { enable } })
    }
    window.electron.ipcRenderer.send('updateFloatingWindow')
    window.electron.ipcRenderer.send('updateTrayMenu')
  }

  const handleMasterConnectToggle = async (): Promise<void> => {
    if (isProtected) {
      if (sysProxyEnabled) await handleToggleSysProxy(false)
      if (tunEnabled) await handleToggleTun(false)
    } else {
      await handleToggleSysProxy(true)
    }
  }

  const handleModeChange = async (nextMode: OutboundMode): Promise<void> => {
    await patchControledMihomoConfig({ mode: nextMode })
    await patchMihomoConfig({ mode: nextMode })
    if (autoCloseConnection) {
      await mihomoCloseAllConnections()
    }
    mutateGroups()
    window.electron.ipcRenderer.send('updateTrayMenu')
    await updateTrayIcon()
  }

  const handleQuickSelectNode = async (nodeName: string): Promise<void> => {
    if (!primaryGroup) return
    await mihomoChangeProxy(primaryGroup.name, nodeName)
    if (autoCloseConnection) {
      await mihomoCloseAllConnections(primaryGroup.name)
    }
    mutateGroups()
    window.electron.ipcRenderer.send('updateTrayMenu')
  }

  const handleTestPrimaryGroup = async (): Promise<void> => {
    if (!primaryGroup || testingGroup) return
    setTestingGroup(true)
    try {
      await mihomoGroupDelay(primaryGroup.name, primaryGroup.testUrl)
      mutateGroups()
    } catch (e) {
      toast.error(String(e))
    } finally {
      setTestingGroup(false)
    }
  }

  const handleImportUrl = async (targetUrl?: string): Promise<void> => {
    const finalUrl = (targetUrl ?? importUrl).trim()
    if (!finalUrl || importing) return
    setImporting(true)
    try {
      await addProfileItem({ name: '', type: 'remote', url: finalUrl })
      setImportUrl('')
      setShowImportDrawer(false)
      toast.success('Profile imported')
    } catch (e) {
      toast.error(String(e))
    } finally {
      setImporting(false)
    }
  }

  const handleImportLocalFile = async (): Promise<void> => {
    try {
      const files = await getFilePath(['yml', 'yaml'])
      if (files?.length) {
        const content = await readTextFile(files[0])
        const fileName = files[0].split(/[/\\]/).pop() || 'Local Profile'
        await addProfileItem({ name: fileName, type: 'local', file: content })
        setShowImportDrawer(false)
        toast.success(`Imported ${fileName}`)
      }
    } catch (e) {
      toast.error(String(e))
    }
  }

  const extra = activeProfile?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0
  const maxTrafficPoint = Math.max(...trafficHistory, 1024)

  return (
    <BasePage
      title="Command Center"
      header={
        <div className="flex items-center gap-1.5 app-nodrag">
          <Button
            size="sm"
            variant="flat"
            className="h-7 px-2.5 text-xs bg-content1 border border-divider"
            onPress={() => setShowImportDrawer((v) => !v)}
          >
            Import
          </Button>
          <Tooltip content={compactMode ? 'Switch to full dashboard' : 'Switch to compact mode'}>
            <Button
              size="sm"
              isIconOnly
              variant="light"
              onPress={() => setCompactMode((v) => !v)}
              title={compactMode ? 'Full dashboard' : 'Compact mode'}
            >
              {compactMode ? (
                <LuMaximize2 className="text-sm" />
              ) : (
                <LuMinimize2 className="text-sm" />
              )}
            </Button>
          </Tooltip>
        </div>
      }
    >
      {showRuntimeConfig && (
        <Suspense fallback={null}>
          <ConfigViewer onClose={() => setShowRuntimeConfig(false)} />
        </Suspense>
      )}

      <div className="p-3.5 space-y-3.5 max-w-[1160px] mx-auto w-full">
        {/* Onboarding / Import Drawer */}
        {(items.length === 0 || showImportDrawer) && (
          <div className="shadcn-card p-4 border border-divider bg-content1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {items.length === 0
                    ? 'Import profile to start'
                    : 'Import subscription or profile'}
                </h3>
                <p className="text-xs text-default-500 mt-0.5">
                  Paste subscription link or import local Clash/Mihomo file.
                </p>
              </div>
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="light"
                  className="h-6 min-w-0 px-2 text-xs"
                  onPress={() => setShowImportDrawer(false)}
                >
                  Close
                </Button>
              )}
            </div>

            {clipboardUrl && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-[6px] border border-emerald-500/30 bg-emerald-500/5">
                <span className="text-xs text-default-600 truncate font-mono">
                  Clipboard: {clipboardUrl}
                </span>
                <Button
                  size="sm"
                  color="primary"
                  isLoading={importing}
                  className="h-6 px-2.5 text-xs shrink-0"
                  onPress={() => void handleImportUrl(clipboardUrl)}
                >
                  Import
                </Button>
              </div>
            )}

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <Input
                size="sm"
                value={importUrl}
                onValueChange={setImportUrl}
                placeholder="https://example.com/api/v1/client/subscribe?token=..."
                classNames={{
                  inputWrapper: 'bg-background border border-divider shadow-none h-8'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleImportUrl()
                }}
              />
              <Button
                size="sm"
                color="primary"
                isLoading={importing}
                isDisabled={!importUrl.trim()}
                className="h-8 px-3 text-xs font-medium shrink-0"
                onPress={() => void handleImportUrl()}
              >
                Import link
              </Button>
              <Button
                size="sm"
                variant="flat"
                className="h-8 px-3 text-xs border border-divider bg-background shrink-0"
                onPress={() => void handleImportLocalFile()}
              >
                Import file
              </Button>
              <Button
                size="sm"
                variant="flat"
                className="h-8 px-3 text-xs border border-divider bg-background shrink-0"
                onPress={() => navigate('/profiles')}
              >
                Profiles
              </Button>
            </div>
          </div>
        )}

        {/* COMPACT VPN CONTROLLER MODE */}
        {compactMode ? (
          <div className="max-w-[440px] mx-auto py-4">
            <div className="shadcn-card p-5 border border-divider bg-content1 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {tunEnabled && sysProxyEnabled
                      ? 'Tun + system proxy active'
                      : tunEnabled
                        ? 'Tun tunnel protected'
                        : sysProxyEnabled
                          ? 'System proxy active'
                          : 'Disconnected'}
                  </div>
                  <div className="text-xs text-default-500 font-mono mt-0.5">
                    {activeProfile.name} • {mode}
                  </div>
                </div>
                <Button
                  size="sm"
                  color={isProtected ? 'danger' : 'primary'}
                  variant={isProtected ? 'flat' : 'solid'}
                  className="h-8 px-3.5 text-xs font-medium"
                  onPress={() => void handleMasterConnectToggle()}
                >
                  {isProtected ? 'Disconnect' : 'Connect'}
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-[6px] border border-divider bg-background">
                  <div>
                    <div className="text-xs font-medium text-foreground">System proxy</div>
                    <div className="text-[10px] text-default-400">Http / socks</div>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={sysProxyEnabled}
                    onValueChange={(v) => void handleToggleSysProxy(v)}
                  />
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-[6px] border border-divider bg-background">
                  <div>
                    <div className="text-xs font-medium text-foreground">Tun mode</div>
                    <div className="text-[10px] text-default-400">Virtual adapter</div>
                  </div>
                  <Switch
                    size="sm"
                    isSelected={tunEnabled}
                    onValueChange={(v) => void handleToggleTun(v)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 p-1 rounded-[6px] border border-divider bg-background">
                {(['rule', 'global', 'direct'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => void handleModeChange(m)}
                    className={`py-1.5 text-xs font-medium rounded-[4px] capitalize transition-colors ${
                      mode === m
                        ? 'bg-primary text-primary-foreground'
                        : 'text-default-500 hover:text-foreground'
                    }`}
                  >
                    {t(`sider.cards.outbound.${m}`)}
                  </button>
                ))}
              </div>

              {primaryGroup && (
                <div className="p-3 rounded-[6px] border border-divider bg-background space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium tracking-wider text-default-400">
                      Exit Node ({primaryGroup.name})
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleTestPrimaryGroup()}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] border border-divider bg-content1 hover:bg-content2 text-default-600"
                    >
                      {testingGroup
                        ? 'Testing...'
                        : activeNodeDelay > 0
                          ? `${activeNodeDelay} ms`
                          : 'Test'}
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate flag-emoji">
                    {primaryGroup.now || 'None'}
                  </div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(primaryGroup.all || []).slice(0, 6).map((node) => {
                      const selected = primaryGroup.now === node.name
                      return (
                        <button
                          key={node.name}
                          type="button"
                          onClick={() => void handleQuickSelectNode(node.name)}
                          className={`text-[11px] px-2 py-1 rounded-[4px] border truncate max-w-[125px] flag-emoji transition-colors ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground font-medium'
                              : 'border-divider bg-content1 hover:bg-content2 text-default-600'
                          }`}
                        >
                          {node.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-divider text-xs font-mono text-default-500">
                <div className="flex items-center gap-3">
                  <span>↓ {calcTraffic(download)}/s</span>
                  <span>↑ {calcTraffic(upload)}/s</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCompactMode(false)}
                  className="text-xs text-default-500 hover:text-foreground underline"
                >
                  Expand
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* FULL BENTO COMMAND CENTER */
          <>
            {/* Top Row: Master Connection Control + Active Node Switcher */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Left 7 Cols: Master Connection & Outbound Control Card */}
              <div className="lg:col-span-7 shadcn-card p-4 border border-divider bg-content1 flex flex-col justify-between gap-3.5 overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold tracking-tight text-foreground">
                        {tunEnabled && sysProxyEnabled
                          ? 'Protected (tun + system proxy)'
                          : tunEnabled
                            ? 'Protected (tun mode)'
                            : sysProxyEnabled
                              ? 'Protected (system proxy)'
                              : 'Proxy standby'}
                      </h2>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] border ${
                          isProtected
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                            : 'border-divider bg-content2 text-default-500'
                        }`}
                      >
                        {isProtected ? 'Connected' : 'Standby'}
                      </span>
                    </div>
                    <p className="text-xs text-default-500 mt-0.5 truncate">
                      Profile:{' '}
                      <span className="text-foreground font-medium">{activeProfile.name}</span> •
                      Mode: <span className="font-mono">{mode}</span>
                    </p>
                  </div>

                  <Button
                    size="sm"
                    color={isProtected ? 'default' : 'primary'}
                    variant={isProtected ? 'bordered' : 'solid'}
                    className="h-7 px-3 text-xs font-medium shrink-0"
                    onPress={() => void handleMasterConnectToggle()}
                  >
                    {isProtected ? 'Disconnect' : 'Connect'}
                  </Button>
                </div>

                {/* System Proxy & TUN Switches */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2.5 rounded-[6px] border border-divider bg-background min-w-0">
                    <div className="min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => navigate('/sysproxy')}
                        className="text-xs font-medium text-foreground hover:underline truncate block"
                      >
                        System proxy
                      </button>
                      <div className="text-[10px] text-default-400 truncate">Http/socks proxy</div>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={sysProxyEnabled}
                      onValueChange={(v) => void handleToggleSysProxy(v)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-[6px] border border-divider bg-background min-w-0">
                    <div className="min-w-0 pr-2">
                      <button
                        type="button"
                        onClick={() => navigate('/tun')}
                        className="text-xs font-medium text-foreground hover:underline truncate block"
                      >
                        Tun adapter
                      </button>
                      <div className="text-[10px] text-default-400 truncate">Virtual adapter</div>
                    </div>
                    <Switch
                      size="sm"
                      isSelected={tunEnabled}
                      onValueChange={(v) => void handleToggleTun(v)}
                    />
                  </div>
                </div>

                {/* Outbound Mode Bar */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-divider">
                  <span className="text-xs text-default-500 font-medium">Outbound Mode</span>
                  <div className="flex items-center gap-1 p-0.5 rounded-[6px] border border-divider bg-background">
                    {(['rule', 'global', 'direct'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => void handleModeChange(m)}
                        className={`px-3 py-1 text-xs font-medium rounded-[4px] transition-colors ${
                          mode === m
                            ? 'bg-primary text-primary-foreground'
                            : 'text-default-500 hover:text-foreground'
                        }`}
                      >
                        {t(`sider.cards.outbound.${m}`)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right 5 Cols: Active Exit Node & Instant Switcher */}
              <div className="lg:col-span-5 shadcn-card p-4 border border-divider bg-content1 flex flex-col justify-between gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-default-500">
                    Exit Node
                  </span>
                  <div className="flex items-center gap-1.5">
                    {primaryGroup && (
                      <Button
                        size="sm"
                        variant="flat"
                        isLoading={testingGroup}
                        className="h-8 px-3 text-xs border border-divider bg-background"
                        onPress={() => void handleTestPrimaryGroup()}
                      >
                        Ping
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="light"
                      className="h-8 px-3 text-xs"
                      endContent={<LuArrowUpRight className="text-xs" />}
                      onPress={() => navigate('/proxies')}
                    >
                      All ({groups.length})
                    </Button>
                  </div>
                </div>

                {primaryGroup ? (
                  <>
                    <div className="p-2.5 rounded-[6px] border border-divider bg-background flex items-center justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <div className="text-[10px] text-default-400 truncate">
                          {primaryGroup.name} ({primaryGroup.type})
                        </div>
                        <div className="text-sm font-semibold text-foreground truncate flag-emoji mt-0.5">
                          {primaryGroup.now || 'Direct'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {activeNode?.type && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] border border-divider bg-content1 text-default-500">
                            {activeNode.type}
                          </span>
                        )}
                        <span
                          className={`text-xs font-mono px-2 py-0.5 rounded-[4px] border ${
                            activeNodeDelay > 0 && activeNodeDelay < 250
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                              : activeNodeDelay >= 250
                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                                : 'border-divider bg-content1 text-default-400'
                          }`}
                        >
                          {activeNodeDelay > 0
                            ? `${activeNodeDelay} ms`
                            : activeNodeDelay === 0
                              ? 'Timeout'
                              : 'Untested'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-default-400">
                        <span>Nodes ({primaryGroup.all?.length ?? 0})</span>
                        <button
                          type="button"
                          onClick={() => openCommandPalette()}
                          className="hover:text-foreground flex items-center gap-1"
                        >
                          <LuSearch className="text-[10px]" />
                          <span>Search (Ctrl+K)</span>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 max-h-[105px] overflow-y-auto pr-0.5 custom-scrollbar">
                        {(primaryGroup.all || []).slice(0, 8).map((node) => {
                          const isSelected = primaryGroup.now === node.name
                          const d =
                            node.history && node.history.length > 0
                              ? node.history[node.history.length - 1].delay
                              : -1
                          return (
                            <button
                              key={node.name}
                              type="button"
                              onClick={() => void handleQuickSelectNode(node.name)}
                              className={`flex items-center justify-between gap-1 px-2 py-1 rounded-[5px] border text-left text-xs transition-colors min-w-0 ${
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground font-medium'
                                  : 'border-divider bg-background hover:bg-content2 text-foreground'
                              }`}
                            >
                              <span className="truncate flag-emoji">{node.name}</span>
                              <span
                                className={`text-[10px] font-mono shrink-0 ${
                                  isSelected ? 'text-primary-foreground/80' : 'text-default-400'
                                }`}
                              >
                                {d > 0 ? `${d}ms` : ''}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-6 text-center text-xs text-default-400">
                    No proxy groups loaded.
                  </div>
                )}
              </div>
            </div>

            {/* Middle Row: Active Profile & Quota + Live Throughput Sparkline + Engine Status */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3.5">
              {/* Card 1: Active Profile & Subscription Quota */}
              <div className="shadcn-card p-4 border border-divider bg-content1 flex flex-col justify-between gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-default-500">
                    Profile
                  </span>
                  <div className="flex items-center gap-1">
                    <Tooltip content={t('sider.cards.viewRuntimeConfig')}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="h-8 w-8 min-w-0"
                        onPress={() => setShowRuntimeConfig(true)}
                      >
                        <LuFileCode className="text-xs" />
                      </Button>
                    </Tooltip>
                    {activeProfile.type === 'remote' && (
                      <Tooltip content="Refresh subscription">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          className="h-8 w-8 min-w-0"
                          isDisabled={updatingProfile}
                          onPress={async () => {
                            setUpdatingProfile(true)
                            try {
                              await addProfileItem(activeProfile)
                              toast.success('Subscription updated')
                            } finally {
                              setUpdatingProfile(false)
                            }
                          }}
                        >
                          <LuRefreshCw
                            className={`text-xs ${updatingProfile ? 'animate-spin' : ''}`}
                          />
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      size="sm"
                      variant="light"
                      className="h-8 px-3 text-xs"
                      endContent={<LuArrowUpRight className="text-xs" />}
                      onPress={() => navigate('/profiles')}
                    >
                      Manage
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {activeProfile.name}
                    </div>
                    <Chip
                      size="sm"
                      variant="bordered"
                      className="h-5 text-[10px] border-divider shrink-0"
                    >
                      {activeProfile.type === 'remote' ? 'Remote' : 'Local'}
                    </Chip>
                  </div>

                  {extra ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono text-default-500">
                        <span>
                          {calcTraffic(usage)} / {calcTraffic(total)}
                        </span>
                        <span>
                          {extra.expire
                            ? new Date(extra.expire * 1000).toLocaleDateString()
                            : 'No Expiry'}
                        </span>
                      </div>
                      <Progress
                        size="sm"
                        value={calcPercent(extra.upload, extra.download, extra.total)}
                        classNames={{
                          indicator: 'bg-primary'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-default-400">
                      {activeProfile.updated
                        ? `Updated ${dayjs(activeProfile.updated).fromNow()}`
                        : 'Local configuration active'}
                    </div>
                  )}
                </div>

                {/* Quick Profile Switcher Pills */}
                {items.length > 1 && (
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
                    {items.slice(0, 4).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void changeCurrentProfile(item.id)}
                        className={`text-[11px] px-2 py-0.5 rounded-[4px] border truncate max-w-[110px] flex items-center gap-1 shrink-0 ${
                          item.id === current
                            ? 'border-primary bg-primary/10 text-foreground font-medium'
                            : 'border-divider bg-background text-default-500 hover:text-foreground'
                        }`}
                      >
                        {item.id === current && <LuCheck className="text-[10px] shrink-0" />}
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Card 2: Live Throughput & Sparkline */}
              <div className="shadcn-card p-4 border border-divider bg-content1 flex flex-col justify-between gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-default-500">
                    Throughput
                  </span>
                  <Button
                    size="sm"
                    variant="light"
                    className="h-8 px-3 text-xs"
                    endContent={<LuArrowUpRight className="text-xs" />}
                    onPress={() => navigate('/telemetry')}
                  >
                    Sockets
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-[6px] border border-divider bg-background">
                    <div className="text-[10px] text-default-400">Download</div>
                    <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
                      {calcTraffic(download)}/s
                    </div>
                  </div>
                  <div className="p-2.5 rounded-[6px] border border-divider bg-background">
                    <div className="text-[10px] text-default-400">Upload</div>
                    <div className="text-sm font-semibold font-mono text-foreground mt-0.5">
                      {calcTraffic(upload)}/s
                    </div>
                  </div>
                </div>

                {/* Minimal Bar Sparkline */}
                <div className="h-8 flex items-end gap-1 pt-1 px-1">
                  {trafficHistory.map((val, idx) => {
                    const heightPct = Math.max(
                      8,
                      Math.min(100, Math.round((val / maxTrafficPoint) * 100))
                    )
                    return (
                      <div
                        key={idx}
                        style={{ height: `${heightPct}%` }}
                        className="flex-1 rounded-t-[2px] bg-default-300/60 dark:bg-default-200/70 transition-all duration-150"
                      />
                    )
                  })}
                </div>
              </div>

              {/* Card 3: Mihomo Core & Quick Diagnostics */}
              <div className="shadcn-card p-4 border border-divider bg-content1 flex flex-col justify-between gap-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wider text-default-500">
                    Engine
                  </span>
                  <div className="flex items-center gap-1">
                    <Tooltip content={t('mihomo.restart')}>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        className="h-8 w-8 min-w-0"
                        isDisabled={restartingCore}
                        onPress={async () => {
                          setRestartingCore(true)
                          try {
                            await restartCore()
                            mutateVersion()
                            toast.success('Core restarted')
                          } catch (e) {
                            toast.error(String(e))
                          } finally {
                            setRestartingCore(false)
                          }
                        }}
                      >
                        <LuRefreshCw
                          className={`text-xs ${restartingCore ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    </Tooltip>
                    <Button
                      size="sm"
                      variant="light"
                      className="h-8 px-3 text-xs"
                      endContent={<LuArrowUpRight className="text-xs" />}
                      onPress={() => navigate('/mihomo')}
                    >
                      Core
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-[6px] border border-divider bg-background min-w-0">
                    <div className="text-[10px] text-default-400 truncate">Version</div>
                    <div className="text-xs font-semibold font-mono text-foreground truncate mt-0.5">
                      {version?.version ?? '-'}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-[6px] border border-divider bg-background min-w-0">
                    <div className="text-[10px] text-default-400 truncate">Memory</div>
                    <div className="text-xs font-semibold font-mono text-foreground mt-0.5">
                      {calcTraffic(memory)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => navigate('/telemetry')}
                    className="flex items-center justify-center py-1 px-1.5 rounded-[5px] border border-divider bg-background hover:bg-content2 text-[11px] text-default-600 transition-colors truncate"
                  >
                    Telemetry
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/rules')}
                    className="flex items-center justify-center py-1 px-1.5 rounded-[5px] border border-divider bg-background hover:bg-content2 text-[11px] text-default-600 transition-colors truncate"
                  >
                    {rules?.rules?.length ?? 0} Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/logs')}
                    className="flex items-center justify-center py-1 px-1.5 rounded-[5px] border border-divider bg-background hover:bg-content2 text-[11px] text-default-600 transition-colors truncate"
                  >
                    Logs
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </BasePage>
  )
}

export default DashboardPage
