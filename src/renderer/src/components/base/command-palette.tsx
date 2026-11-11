import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGroups } from '@renderer/hooks/use-groups'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import {
  mihomoChangeProxy,
  mihomoCloseAllConnections,
  patchMihomoConfig,
  restartCore,
  triggerSysProxy,
  updateTrayIcon,
  updateTrayIconImmediate
} from '@renderer/utils/ipc'
import { toast } from '@renderer/components/base/toast'
import {
  LuSearch,
  LuLayoutDashboard,
  LuGlobe,
  LuShield,
  LuServer,
  LuCpu,
  LuActivity,
  LuFolder,
  LuSettings,
  LuRefreshCw,
  LuZap,
  LuCompass,
  LuFileCode,
  LuDatabase,
  LuLayers,
  LuTerminal,
  LuRadio,
  LuNetwork,
  LuCheck
} from 'react-icons/lu'

export const OPEN_COMMAND_PALETTE_EVENT = 'clash-party:open-command-palette'

export function openCommandPalette(): void {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT))
}

interface CommandItem {
  id: string
  category: 'Actions' | 'Proxy Nodes' | 'Navigation'
  title: string
  subtitle?: string
  badge?: string
  badgeColor?: string
  active?: boolean
  icon: React.ReactNode
  onSelect: () => Promise<void> | void
}

const CommandPalette: React.FC = () => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const { groups = [], mutate: mutateGroups } = useGroups()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()

  const sysProxyEnabled = appConfig?.sysProxy?.enable ?? false
  const tunEnabled = controledMihomoConfig?.tun?.enable ?? false
  const currentMode = controledMihomoConfig?.mode ?? 'rule'
  const autoCloseConnection = appConfig?.autoCloseConnection ?? true

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    const handleCustomOpen = (): void => {
      setIsOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleCustomOpen)
    return (): void => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleCustomOpen)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      window.setTimeout(() => {
        inputRef.current?.focus()
      }, 20)
    }
  }, [isOpen])

  const handleToggleSysProxy = useCallback(async (): Promise<void> => {
    const next = !sysProxyEnabled
    updateTrayIconImmediate(next, tunEnabled)
    try {
      await patchAppConfig({ sysProxy: { enable: next } })
      await triggerSysProxy(next)
      window.electron.ipcRenderer.send('updateFloatingWindow')
      window.electron.ipcRenderer.send('updateTrayMenu')
      toast.success(`System Proxy ${next ? 'enabled' : 'disabled'}`)
    } catch (e) {
      await patchAppConfig({ sysProxy: { enable: sysProxyEnabled } })
      updateTrayIconImmediate(sysProxyEnabled, tunEnabled)
      toast.error(String(e))
    }
  }, [sysProxyEnabled, tunEnabled, patchAppConfig])

  const handleToggleTun = useCallback(async (): Promise<void> => {
    const enable = !tunEnabled
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
  }, [tunEnabled, sysProxyEnabled, t, patchControledMihomoConfig])

  const handleSwitchMode = useCallback(
    async (mode: OutboundMode): Promise<void> => {
      await patchControledMihomoConfig({ mode })
      await patchMihomoConfig({ mode })
      if (autoCloseConnection) {
        await mihomoCloseAllConnections()
      }
      mutateGroups()
      window.electron.ipcRenderer.send('updateTrayMenu')
      await updateTrayIcon()
      toast.success(`Switched outbound mode to ${mode}`)
    },
    [patchControledMihomoConfig, autoCloseConnection, mutateGroups]
  )

  const allItems = useMemo<CommandItem[]>(() => {
    const actionItems: CommandItem[] = [
      {
        id: 'action-sysproxy',
        category: 'Actions',
        title: sysProxyEnabled ? 'Disable system proxy' : 'Enable system proxy',
        subtitle: 'Toggle system proxy routing',
        badge: sysProxyEnabled ? 'on' : 'off',
        badgeColor: sysProxyEnabled
          ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
          : '',
        active: sysProxyEnabled,
        icon: <LuGlobe className="text-base" />,
        onSelect: handleToggleSysProxy
      },
      {
        id: 'action-tun',
        category: 'Actions',
        title: tunEnabled ? 'Disable tun adapter' : 'Enable tun adapter',
        subtitle: 'Toggle virtual network adapter',
        badge: tunEnabled ? 'on' : 'off',
        badgeColor: tunEnabled ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10' : '',
        active: tunEnabled,
        icon: <LuShield className="text-base" />,
        onSelect: handleToggleTun
      },
      {
        id: 'action-mode-rule',
        category: 'Actions',
        title: 'Outbound mode: Rule',
        subtitle: 'Route traffic dynamically using rule sets',
        badge: currentMode === 'rule' ? 'active' : undefined,
        active: currentMode === 'rule',
        icon: <LuCompass className="text-base" />,
        onSelect: () => handleSwitchMode('rule')
      },
      {
        id: 'action-mode-global',
        category: 'Actions',
        title: 'Outbound mode: Global',
        subtitle: 'Route all traffic through global proxy',
        badge: currentMode === 'global' ? 'active' : undefined,
        active: currentMode === 'global',
        icon: <LuGlobe className="text-base" />,
        onSelect: () => handleSwitchMode('global')
      },
      {
        id: 'action-mode-direct',
        category: 'Actions',
        title: 'Outbound mode: Direct',
        subtitle: 'Bypass all proxies and connect directly',
        badge: currentMode === 'direct' ? 'active' : undefined,
        active: currentMode === 'direct',
        icon: <LuZap className="text-base" />,
        onSelect: () => handleSwitchMode('direct')
      },
      {
        id: 'action-restart-core',
        category: 'Actions',
        title: 'Restart Mihomo core',
        subtitle: 'Reload core daemon and active configuration',
        icon: <LuRefreshCw className="text-base" />,
        onSelect: async () => {
          await restartCore()
          toast.success('Mihomo core restarted')
        }
      },
      {
        id: 'action-close-conns',
        category: 'Actions',
        title: 'Close all active connections',
        subtitle: 'Terminate all active sessions immediately',
        icon: <LuActivity className="text-base" />,
        onSelect: async () => {
          await mihomoCloseAllConnections()
          toast.success('Closed all active connections')
        }
      }
    ]

    const navItems: CommandItem[] = [
      {
        id: 'nav-dashboard',
        category: 'Navigation',
        title: 'Command center',
        subtitle: 'Quick connect, active node, quota and live speed',
        badge: '/dashboard',
        icon: <LuLayoutDashboard className="text-base" />,
        onSelect: () => navigate('/dashboard')
      },
      {
        id: 'nav-proxies',
        category: 'Navigation',
        title: 'Proxies & nodes',
        subtitle: `Browse and test ${groups.length} outbound groups`,
        badge: '/proxies',
        icon: <LuLayers className="text-base" />,
        onSelect: () => navigate('/proxies')
      },
      {
        id: 'nav-profiles',
        category: 'Navigation',
        title: 'Subscriptions & profiles',
        subtitle: 'Import subscription links or edit local profiles',
        badge: '/proxies?tab=subscriptions',
        icon: <LuFolder className="text-base" />,
        onSelect: () => navigate('/proxies?tab=subscriptions')
      },
      {
        id: 'nav-substore',
        category: 'Navigation',
        title: 'Sub-Store manager',
        subtitle: 'Subscription converter and node aggregator',
        badge: '/proxies?tab=substore',
        icon: <LuLayers className="text-base" />,
        onSelect: () => navigate('/proxies?tab=substore')
      },
      {
        id: 'nav-routing',
        category: 'Navigation',
        title: 'Routing hub',
        subtitle: 'Rules, overrides, and external routing resources',
        badge: '/routing',
        icon: <LuCompass className="text-base" />,
        onSelect: () => navigate('/routing')
      },
      {
        id: 'nav-rules',
        category: 'Navigation',
        title: 'Routing rules',
        subtitle: 'Search and inspect active routing rules',
        badge: '/routing?tab=rules',
        icon: <LuCompass className="text-base" />,
        onSelect: () => navigate('/routing?tab=rules')
      },
      {
        id: 'nav-override',
        category: 'Navigation',
        title: 'Configuration overrides',
        subtitle: 'YAML and script profile pre-processors',
        badge: '/routing?tab=overrides',
        icon: <LuFileCode className="text-base" />,
        onSelect: () => navigate('/routing?tab=overrides')
      },
      {
        id: 'nav-resources',
        category: 'Navigation',
        title: 'External resources',
        subtitle: 'GeoIP, GeoSite, ASN, and rule provider bundles',
        badge: '/routing?tab=resources',
        icon: <LuDatabase className="text-base" />,
        onSelect: () => navigate('/routing?tab=resources')
      },
      {
        id: 'nav-telemetry',
        category: 'Navigation',
        title: 'Telemetry hub',
        subtitle: 'Connections, traffic charts, network IP, and logs',
        badge: '/telemetry',
        icon: <LuActivity className="text-base" />,
        onSelect: () => navigate('/telemetry')
      },
      {
        id: 'nav-connections',
        category: 'Navigation',
        title: 'Live connections',
        subtitle: 'Inspect active sockets, rule chains, and processes',
        badge: '/telemetry?tab=connections',
        icon: <LuActivity className="text-base" />,
        onSelect: () => navigate('/telemetry?tab=connections')
      },
      {
        id: 'nav-traffic',
        category: 'Navigation',
        title: 'Traffic & analytics',
        subtitle: 'Historical bandwidth by host, process, and node',
        badge: '/telemetry?tab=traffic',
        icon: <LuActivity className="text-base" />,
        onSelect: () => navigate('/telemetry?tab=traffic')
      },
      {
        id: 'nav-network',
        category: 'Navigation',
        title: 'Network & egress IP',
        subtitle: 'Egress IP geolocation, WebRTC leak, and latency matrix',
        badge: '/telemetry?tab=network',
        icon: <LuNetwork className="text-base" />,
        onSelect: () => navigate('/telemetry?tab=network')
      },
      {
        id: 'nav-logs',
        category: 'Navigation',
        title: 'Kernel logs',
        subtitle: 'Real-time Mihomo core log stream',
        badge: '/telemetry?tab=logs',
        icon: <LuTerminal className="text-base" />,
        onSelect: () => navigate('/telemetry?tab=logs')
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Settings hub',
        subtitle: 'Application preferences, engine, and network stack',
        badge: '/settings',
        icon: <LuSettings className="text-base" />,
        onSelect: () => navigate('/settings')
      },
      {
        id: 'nav-mihomo',
        category: 'Navigation',
        title: 'Kernel engine settings',
        subtitle: 'Mixed/Socks/HTTP ports, secret, IPv6, and core version',
        badge: '/settings?tab=kernel',
        icon: <LuCpu className="text-base" />,
        onSelect: () => navigate('/settings?tab=kernel')
      },
      {
        id: 'nav-tun',
        category: 'Navigation',
        title: 'Tun virtual adapter',
        subtitle: 'Network stack, MTU, strict route, and DNS hijack',
        badge: '/settings?tab=tun',
        icon: <LuShield className="text-base" />,
        onSelect: () => navigate('/settings?tab=tun')
      },
      {
        id: 'nav-sysproxy',
        category: 'Navigation',
        title: 'System proxy settings',
        subtitle: 'PAC script, bypass hosts, and system proxy mode',
        badge: '/settings?tab=sysproxy',
        icon: <LuGlobe className="text-base" />,
        onSelect: () => navigate('/settings?tab=sysproxy')
      },
      {
        id: 'nav-dns',
        category: 'Navigation',
        title: 'DNS configuration',
        subtitle: 'FakeIP, DoH/DoT nameservers, and fallback policy',
        badge: '/settings?tab=dns',
        icon: <LuServer className="text-base" />,
        onSelect: () => navigate('/settings?tab=dns')
      },
      {
        id: 'nav-sniffer',
        category: 'Navigation',
        title: 'Traffic sniffer',
        subtitle: 'TLS SNI and HTTP host packet sniffing',
        badge: '/settings?tab=sniffer',
        icon: <LuRadio className="text-base" />,
        onSelect: () => navigate('/settings?tab=sniffer')
      }
    ]

    const proxyItems: CommandItem[] = []
    for (const group of groups) {
      if (group.type !== 'Selector' && group.type !== 'URLTest' && group.type !== 'Fallback') {
        continue
      }
      for (const proxy of group.all || []) {
        const lastDelay =
          proxy.history && proxy.history.length > 0
            ? proxy.history[proxy.history.length - 1].delay
            : -1
        const isCurrent = group.now === proxy.name
        const delayBadge =
          lastDelay > 0 ? `${lastDelay} ms` : lastDelay === 0 ? 'Timeout' : proxy.type
        const badgeColor =
          lastDelay > 0 && lastDelay < 250
            ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
            : lastDelay >= 250
              ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
              : ''

        proxyItems.push({
          id: `proxy-${group.name}-${proxy.name}`,
          category: 'Proxy Nodes',
          title: proxy.name,
          subtitle: `Group: ${group.name}${isCurrent ? ' (Current)' : ''}`,
          badge: delayBadge,
          badgeColor,
          active: isCurrent,
          icon: isCurrent ? (
            <LuCheck className="text-base text-emerald-500" />
          ) : (
            <LuZap className="text-base" />
          ),
          onSelect: async () => {
            await mihomoChangeProxy(group.name, proxy.name)
            if (autoCloseConnection) {
              await mihomoCloseAllConnections(group.name)
            }
            mutateGroups()
            window.electron.ipcRenderer.send('updateTrayMenu')
            toast.success(`Selected ${proxy.name} in ${group.name}`)
          }
        })
      }
    }

    return [...actionItems, ...navItems, ...proxyItems]
  }, [
    sysProxyEnabled,
    tunEnabled,
    currentMode,
    groups,
    handleToggleSysProxy,
    handleToggleTun,
    handleSwitchMode,
    navigate,
    autoCloseConnection,
    mutateGroups
  ])

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Show top actions, navigation, and active group nodes when query is empty
      const actionsAndNav = allItems.filter((item) => item.category !== 'Proxy Nodes')
      const topProxies = allItems.filter((item) => item.category === 'Proxy Nodes').slice(0, 12)
      return [...actionsAndNav, ...topProxies]
    }
    return allItems
      .filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          (item.badge && item.badge.toLowerCase().includes(q))
      )
      .slice(0, 50)
  }, [allItems, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const executeItem = useCallback(async (item: CommandItem): Promise<void> => {
    setIsOpen(false)
    await item.onSelect()
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-[2px] app-nodrag"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="w-full max-w-[560px] mx-4 rounded-[8px] border border-divider bg-background overflow-hidden flex flex-col max-h-[72vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-3.5 py-2.5 border-b border-divider gap-2.5">
          <LuSearch className="text-default-400 text-lg shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex((prev) =>
                  filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
                )
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex((prev) =>
                  filteredItems.length > 0
                    ? (prev - 1 + filteredItems.length) % filteredItems.length
                    : 0
                )
              } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
                e.preventDefault()
                void executeItem(filteredItems[selectedIndex])
              }
            }}
            placeholder="Type a command, search proxy nodes, or jump to page..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-default-400 focus:outline-none"
          />
          <span className="shadcn-kbd shrink-0">Esc</span>
        </div>

        <div ref={listRef} className="overflow-y-auto p-1.5 space-y-1 flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-default-400">
              No matching commands or proxy nodes found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const prevCategory = idx > 0 ? filteredItems[idx - 1].category : null
              const showCategoryHeader = item.category !== prevCategory

              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && (
                    <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-default-400">
                      {item.category}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => void executeItem(item)}
                    className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-[6px] text-left transition-colors ${
                      isSelected
                        ? 'bg-content2 text-foreground'
                        : 'text-default-600 hover:bg-content2/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] border border-divider bg-content1 ${
                          item.active
                            ? 'text-emerald-500 border-emerald-500/40'
                            : 'text-default-500'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-foreground truncate flag-emoji">
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-[11px] text-default-400 truncate flag-emoji">
                            {item.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                    {item.badge && (
                      <span
                        className={`shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] border border-divider bg-content1 text-default-500 ${
                          item.badgeColor || ''
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                </React.Fragment>
              )
            })
          )}
        </div>

        <div className="px-3.5 py-1.5 border-t border-divider bg-content1 flex items-center justify-between text-[11px] text-default-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="shadcn-kbd mr-1">↑↓</kbd>Navigate
            </span>
            <span>
              <kbd className="shadcn-kbd mr-1">↵</kbd>Execute
            </span>
          </div>
          <span>{filteredItems.length} results</span>
        </div>
      </div>
    </div>
  )
}

export default CommandPalette
