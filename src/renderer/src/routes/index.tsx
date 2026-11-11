import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getInitialSiderRoute } from '@renderer/utils/sider'
import {
  Dashboard,
  ProxiesHub,
  RoutingHub,
  SettingsHub,
  Telemetry,
  NetworkPageComponent,
  Override,
  Proxies,
  Rules,
  Settings,
  Profiles,
  Logs,
  Connections,
  Mihomo,
  Sysproxy,
  Tun,
  Resources,
  DNS,
  Sniffer,
  SubStore,
  Traffic
} from './route-pages'

export { useDeferredRoutePreload } from './route-pages'

const HomeRedirect: React.FC = () => {
  const { appConfig } = useAppConfig()
  if (!appConfig) return null
  return (
    <Navigate
      to={getInitialSiderRoute(
        appConfig.rememberSelectedSiderCard ?? false,
        appConfig.lastSelectedSiderCard
      )}
      replace
    />
  )
}

const routes = [
  {
    path: '/dashboard',
    element: <Dashboard />
  },
  {
    path: '/proxies',
    element: <ProxiesHub />
  },
  {
    path: '/proxies/nodes',
    element: <Proxies />
  },
  {
    path: '/nodes',
    element: <Proxies />
  },
  {
    path: '/profiles',
    element: <Profiles />
  },
  {
    path: '/substore',
    element: <SubStore />
  },
  {
    path: '/routing',
    element: <RoutingHub />
  },
  {
    path: '/rules',
    element: <Rules />
  },
  {
    path: '/override',
    element: <Override />
  },
  {
    path: '/resources',
    element: <Resources />
  },
  {
    path: '/telemetry',
    element: <Telemetry />
  },
  {
    path: '/connections',
    element: <Connections />
  },
  {
    path: '/traffic',
    element: <Traffic />
  },
  {
    path: '/network',
    element: <NetworkPageComponent />
  },
  {
    path: '/logs',
    element: <Logs />
  },
  {
    path: '/settings',
    element: <SettingsHub />
  },
  {
    path: '/settings/general',
    element: <Settings />
  },
  {
    path: '/mihomo',
    element: <Mihomo />
  },
  {
    path: '/tun',
    element: <Tun />
  },
  {
    path: '/sysproxy',
    element: <Sysproxy />
  },
  {
    path: '/dns',
    element: <DNS />
  },
  {
    path: '/sniffer',
    element: <Sniffer />
  },
  {
    path: '/',
    element: <HomeRedirect />
  }
]

export default routes
