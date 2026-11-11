import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Tooltip } from '@heroui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useSWR from 'swr'
import PubSub from 'pubsub-js'
import { toast } from '@renderer/components/base/toast'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { useRules } from '@renderer/hooks/use-rules'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { calcTraffic } from '@renderer/utils/calc'
import { markInitialContentPartReady } from '@renderer/utils/startup'
import {
  mihomoVersion,
  restartCore,
  triggerSysProxy,
  updateTrayIconImmediate
} from '@renderer/utils/ipc'
import {
  LuLayoutDashboard,
  LuLayers,
  LuCompass,
  LuActivity,
  LuFileCode,
  LuRefreshCw,
  LuArrowUp,
  LuArrowDown,
  LuSettings,
  LuGlobe,
  LuShield
} from 'react-icons/lu'

const ConfigViewer = lazy(() => import('./config-viewer'))

const WorkspaceSidebar: React.FC = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const sysProxyEnabled = appConfig?.sysProxy?.enable ?? false
  const tunEnabled = controledMihomoConfig?.tun?.enable ?? false
  const [togglingProxy, setTogglingProxy] = useState(false)

  const { profileConfig, addProfileItem } = useProfileConfig()
  const { groups = [] } = useGroups()
  const { rules } = useRules()
  const { data: version, mutate: mutateVersion } = useSWR('mihomoVersion', mihomoVersion)

  const { current, items = [] } = profileConfig || {}
  const activeProfile = items.find((item) => item && item.id === current) ?? {
    id: 'default',
    type: 'local' as const,
    name: t('sider.cards.emptyProfile')
  }

  const [showRuntimeConfig, setShowRuntimeConfig] = useState(false)
  const [updatingProfile, setUpdatingProfile] = useState(false)
  const [restartingCore, setRestartingCore] = useState(false)
  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)

  const handleToggleSysProxy = useCallback(
    async (enable: boolean): Promise<void> => {
      if (togglingProxy) return
      setTogglingProxy(true)
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
      } finally {
        setTogglingProxy(false)
      }
    },
    [togglingProxy, tunEnabled, patchAppConfig]
  )

  const handleToggleTun = useCallback(
    async (enable: boolean): Promise<void> => {
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
    },
    [sysProxyEnabled, t, patchControledMihomoConfig]
  )

  useEffect(() => {
    markInitialContentPartReady('sider')
  }, [])

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutateVersion()
    })
    const onTraffic = (_e: unknown, ...args: unknown[]): void => {
      const info = args[0] as IMihomoTrafficInfo
      setUpload(info.up)
      setDownload(info.down)
    }
    const unsubTraffic = window.electron.ipcRenderer.on('mihomoTraffic', onTraffic)
    return (): void => {
      PubSub.unsubscribe(token)
      unsubTraffic()
    }
  }, [mutateVersion])

  const isRouteActive = (route: string): boolean => {
    if (route === '/dashboard') {
      return location.pathname === '/' || location.pathname.startsWith('/dashboard')
    }
    if (route === '/proxies') {
      return (
        location.pathname.startsWith('/proxies') ||
        location.pathname.startsWith('/profiles') ||
        location.pathname.startsWith('/substore')
      )
    }
    if (route === '/routing') {
      return (
        location.pathname.startsWith('/routing') ||
        location.pathname.startsWith('/rules') ||
        location.pathname.startsWith('/override') ||
        location.pathname.startsWith('/resources')
      )
    }
    if (route === '/telemetry') {
      return (
        location.pathname.startsWith('/telemetry') ||
        location.pathname.startsWith('/connections') ||
        location.pathname.startsWith('/traffic') ||
        location.pathname.startsWith('/network') ||
        location.pathname.startsWith('/logs')
      )
    }
    if (route === '/settings') {
      return (
        location.pathname.startsWith('/settings') ||
        location.pathname.startsWith('/mihomo') ||
        location.pathname.startsWith('/tun') ||
        location.pathname.startsWith('/sysproxy') ||
        location.pathname.startsWith('/dns') ||
        location.pathname.startsWith('/sniffer')
      )
    }
    return location.pathname.startsWith(route)
  }

  const renderNavRow = (opts: {
    route: string
    icon: React.ReactNode
    label: string
    badge?: React.ReactNode
    rightAction?: React.ReactNode
    tourTarget?: string
  }): React.JSX.Element => {
    const active = isRouteActive(opts.route)
    return (
      <div
        role="button"
        tabIndex={0}
        data-tour={opts.tourTarget}
        key={opts.route}
        onClick={() => navigate(opts.route)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(opts.route)
          }
        }}
        className={`w-full text-left group flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-[5px] cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary ${
          active
            ? 'bg-content2 text-foreground font-medium'
            : 'text-default-600 hover:bg-content2/60 hover:text-foreground font-normal'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`shrink-0 text-base ${active ? 'text-primary' : 'text-default-400'}`}>
            {opts.icon}
          </span>
          <span className="text-sm truncate tracking-tight">{opts.label}</span>
          {opts.badge}
        </div>
        {opts.rightAction && (
          <div
            className="flex items-center gap-1 shrink-0 app-nodrag"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {opts.rightAction}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-36px)] justify-between select-none bg-content1">
      {showRuntimeConfig && (
        <Suspense fallback={null}>
          <ConfigViewer onClose={() => setShowRuntimeConfig(false)} />
        </Suspense>
      )}

      {/* Navigation Pillar List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 no-scrollbar">
        {renderNavRow({
          route: '/dashboard',
          icon: <LuLayoutDashboard />,
          label: 'Command center'
        })}
        {renderNavRow({
          route: '/proxies',
          icon: <LuLayers />,
          label: 'Proxies',
          tourTarget: 'profiles',
          rightAction: (
            <div className="flex items-center gap-1">
              <Tooltip content={t('sider.cards.viewRuntimeConfig')} delay={500}>
                <button
                  type="button"
                  onClick={() => setShowRuntimeConfig(true)}
                  className="p-1 rounded-[4px] hover:bg-content3 text-default-500 hover:text-foreground"
                >
                  <LuFileCode className="text-xs" />
                </button>
              </Tooltip>
              {activeProfile.type === 'remote' && (
                <Tooltip content="Refresh subscription" delay={500}>
                  <button
                    type="button"
                    disabled={updatingProfile}
                    onClick={async () => {
                      setUpdatingProfile(true)
                      try {
                        await addProfileItem(activeProfile)
                        toast.success('Profile updated')
                      } finally {
                        setUpdatingProfile(false)
                      }
                    }}
                    className="p-1 rounded-[4px] hover:bg-content3 text-default-500 hover:text-foreground"
                  >
                    <LuRefreshCw className={`text-xs ${updatingProfile ? 'animate-spin' : ''}`} />
                  </button>
                </Tooltip>
              )}
              <span className="text-xs font-mono px-2 py-0.5 rounded-[4px] border border-divider bg-background text-default-500">
                {groups.length}
              </span>
            </div>
          )
        })}
        {renderNavRow({
          route: '/routing',
          icon: <LuCompass />,
          label: 'Routing',
          tourTarget: 'overrides',
          rightAction: (
            <span className="text-xs font-mono px-2 py-0.5 rounded-[4px] border border-divider bg-background text-default-500">
              {rules?.rules?.length ?? 0}
            </span>
          )
        })}
        {renderNavRow({
          route: '/telemetry',
          icon: <LuActivity />,
          label: 'Telemetry'
        })}
        {renderNavRow({
          route: '/settings',
          icon: <LuSettings />,
          label: 'Settings',
          tourTarget: 'dns'
        })}
      </div>

      {/* Persistent Bottom Bar */}
      <div className="px-2.5 py-2.5 border-t border-divider bg-content1 shrink-0 space-y-2">
        {/* Master Switches: System Proxy & TUN Mode */}
        <div className="grid grid-cols-2 gap-1.5">
          {/* System Proxy */}
          <button
            type="button"
            disabled={togglingProxy}
            data-tour="system-proxy"
            onClick={() => void handleToggleSysProxy(!sysProxyEnabled)}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-[5px] border text-xs font-medium transition-all ${
              sysProxyEnabled
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold'
                : 'border-divider bg-background text-default-600 hover:text-foreground hover:bg-content2'
            }`}
            title={sysProxyEnabled ? 'Disable System Proxy' : 'Enable System Proxy'}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <LuGlobe
                className={`text-xs shrink-0 ${sysProxyEnabled ? 'text-emerald-500' : 'text-default-400'}`}
              />
              <span className="truncate">Proxy</span>
            </div>
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                sysProxyEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-default-300'
              }`}
            />
          </button>

          {/* TUN Mode */}
          <button
            type="button"
            data-tour="tun"
            onClick={() => void handleToggleTun(!tunEnabled)}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-[5px] border text-xs font-medium transition-all ${
              tunEnabled
                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500 font-semibold'
                : 'border-divider bg-background text-default-600 hover:text-foreground hover:bg-content2'
            }`}
            title={tunEnabled ? 'Disable TUN' : 'Enable TUN'}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <LuShield
                className={`text-xs shrink-0 ${tunEnabled ? 'text-emerald-500' : 'text-default-400'}`}
              />
              <span className="truncate">TUN</span>
            </div>
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                tunEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-default-300'
              }`}
            />
          </button>
        </div>

        {/* Traffic Speed & Core Version Row */}
        <div className="flex items-center justify-between text-xs font-mono text-default-600 font-normal pt-1 border-t border-divider/40">
          <button
            type="button"
            onClick={() => navigate('/telemetry')}
            className="flex items-center gap-2 hover:text-foreground"
          >
            <span className="flex items-center gap-0.5">
              <LuArrowDown className="text-emerald-500 text-xs" />
              {calcTraffic(download)}/s
            </span>
            <span className="flex items-center gap-0.5">
              <LuArrowUp className="text-sky-500 text-xs" />
              {calcTraffic(upload)}/s
            </span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-default-400 truncate max-w-[65px]">
              {version?.version ?? ''}
            </span>
            <Tooltip content={t('mihomo.restart')} delay={500}>
              <button
                type="button"
                disabled={restartingCore}
                onClick={async () => {
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
                className="p-1 rounded-[4px] hover:bg-content2 text-default-500 hover:text-foreground"
              >
                <LuRefreshCw className={`text-xs ${restartingCore ? 'animate-spin' : ''}`} />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkspaceSidebar
