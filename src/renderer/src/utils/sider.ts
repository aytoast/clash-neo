import { DEFAULT_SIDER_ORDER } from '../../../shared/appConfig'

export const SIDER_CARD_KEYS: SiderCardKey[] = DEFAULT_SIDER_ORDER

export const SIDER_CARD_ROUTES: Record<SiderCardKey, string> = {
  sysproxy: '/sysproxy',
  tun: '/tun',
  profile: '/profiles',
  proxy: '/proxies',
  rule: '/rules',
  resource: '/resources',
  override: '/override',
  connection: '/connections',
  mihomo: '/mihomo',
  dns: '/dns',
  sniff: '/sniffer',
  log: '/logs',
  substore: '/substore',
  network: '/network',
  usage: '/traffic'
}

export function mergeSiderOrder(saved: string[] = []): SiderCardKey[] {
  const valid = saved.filter((key): key is SiderCardKey =>
    SIDER_CARD_KEYS.includes(key as SiderCardKey)
  )
  const missing = SIDER_CARD_KEYS.filter((key) => !valid.includes(key))
  return [...valid, ...missing]
}

export function getSiderCardRoute(card?: string): string {
  if (!card || !SIDER_CARD_KEYS.includes(card as SiderCardKey)) {
    return SIDER_CARD_ROUTES.proxy
  }
  return SIDER_CARD_ROUTES[card as SiderCardKey]
}

export function getSiderCardByPath(pathname: string, search = ''): SiderCardKey | undefined {
  const tab = new URLSearchParams(search).get('tab')
  if (pathname === '/proxies' || pathname === '/proxies/nodes' || pathname === '/nodes') {
    if (tab === 'subscriptions') return 'profile'
    if (tab === 'substore') return 'substore'
    return 'proxy'
  }
  if (pathname === '/routing') {
    if (tab === 'overrides') return 'override'
    if (tab === 'resources') return 'resource'
    return 'rule'
  }
  if (pathname === '/telemetry') {
    if (tab === 'network') return 'network'
    if (tab === 'traffic') return 'usage'
    if (tab === 'logs') return 'log'
    return 'connection'
  }
  if (pathname === '/settings') {
    const tabs: Record<string, SiderCardKey> = {
      kernel: 'mihomo',
      tun: 'tun',
      sysproxy: 'sysproxy',
      dns: 'dns',
      sniffer: 'sniff'
    }
    return tab ? tabs[tab] : undefined
  }
  return SIDER_CARD_KEYS.find((key) => SIDER_CARD_ROUTES[key] === pathname)
}

export function getInitialSiderRoute(remember: boolean, lastCard?: string): string {
  return remember ? getSiderCardRoute(lastCard) : '/dashboard'
}
