import React, { useEffect, useState, useCallback } from 'react'
import { Button, Tooltip, Chip } from '@heroui/react'
import {
  LuGlobe,
  LuArrowDown,
  LuArrowUp,
  LuActivity,
  LuRefreshCw,
  LuTrendingUp,
  LuTerminal
} from 'react-icons/lu'
import { CgTrash } from 'react-icons/cg'
import { fetchIPInfo, mihomoCloseAllConnections } from '@renderer/utils/ipc'
import { calcTraffic } from '@renderer/utils/calc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

interface EgressData {
  ip: string
  country?: string
  countryCode?: string
  city?: string
  isp?: string
  org?: string
}

interface TelemetryHudProps {
  activeCount?: number
  closedCount?: number
  showAnalytics?: boolean
  onToggleAnalytics?: () => void
  showLogs?: boolean
  onToggleLogs?: () => void
  showNetwork?: boolean
  onToggleNetwork?: () => void
}

const TelemetryHud: React.FC<TelemetryHudProps> = ({
  activeCount = 0,
  closedCount = 0,
  showAnalytics = false,
  onToggleAnalytics,
  showLogs = false,
  onToggleLogs,
  showNetwork = false,
  onToggleNetwork
}) => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const mode = controledMihomoConfig?.mode ?? 'rule'

  const [egress, setEgress] = useState<EgressData | null>(null)
  const [loadingEgress, setLoadingEgress] = useState(false)
  const [downloadSpeed, setDownloadSpeed] = useState(0)
  const [uploadSpeed, setUploadSpeed] = useState(0)

  const loadEgress = useCallback(async () => {
    setLoadingEgress(true)
    try {
      const data = (await fetchIPInfo('https://api.ip.sb/geoip')) as Record<string, unknown>
      if (data && data.ip) {
        setEgress({
          ip: String(data.ip),
          country: data.country ? String(data.country) : undefined,
          countryCode: data.country_code ? String(data.country_code).toLowerCase() : undefined,
          city: data.city ? String(data.city) : undefined,
          isp: data.isp
            ? String(data.isp)
            : data.asn_organization
              ? String(data.asn_organization)
              : undefined,
          org: data.organization ? String(data.organization) : undefined
        })
      }
    } catch {
      try {
        const fallback = (await fetchIPInfo('https://ipwho.is/')) as Record<string, unknown>
        if (fallback && fallback.ip) {
          const conn = fallback.connection as Record<string, unknown> | undefined
          setEgress({
            ip: String(fallback.ip),
            country: fallback.country ? String(fallback.country) : undefined,
            countryCode: fallback.country_code
              ? String(fallback.country_code).toLowerCase()
              : undefined,
            city: fallback.city ? String(fallback.city) : undefined,
            isp: conn?.isp ? String(conn.isp) : undefined,
            org: conn?.org ? String(conn.org) : undefined
          })
        }
      } catch {
        // ignore
      }
    } finally {
      setLoadingEgress(false)
    }
  }, [])

  useEffect(() => {
    void loadEgress()
  }, [loadEgress])

  useEffect(() => {
    const onTraffic = (_e: unknown, ...args: unknown[]): void => {
      const info = args[0] as IMihomoTrafficInfo
      if (info) {
        setDownloadSpeed(info.down)
        setUploadSpeed(info.up)
      }
    }
    const unsub = window.electron.ipcRenderer.on('mihomoTraffic', onTraffic)
    return () => unsub()
  }, [])

  return (
    <div className="px-3 pt-3 pb-2 shrink-0">
      <div className="p-3 rounded-[6px] border border-divider bg-content1 flex flex-wrap items-center justify-between gap-3">
        {/* Outbound Egress Status */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded-[5px] border border-divider bg-background flex items-center justify-center shrink-0">
            {egress?.countryCode ? (
              <span className={`fi fi-${egress.countryCode} rounded-xs text-base`} />
            ) : (
              <LuGlobe className="text-base text-default-500" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold font-mono text-foreground tracking-tight truncate">
                {egress?.ip || (loadingEgress ? 'Detecting egress...' : 'Unknown')}
              </span>
              <Tooltip content="Refresh egress IP">
                <Button
                  size="sm"
                  variant="light"
                  isIconOnly
                  className="h-5 w-5 min-w-0 p-0 text-default-400 hover:text-foreground"
                  isLoading={loadingEgress}
                  onPress={() => void loadEgress()}
                >
                  <LuRefreshCw className="text-[11px]" />
                </Button>
              </Tooltip>
            </div>
            <div className="text-xs text-default-500 truncate">
              {egress?.city ? `${egress.city}, ` : ''}
              {egress?.country ? `${egress.country}` : ''}
              {egress?.isp ? ` • ${egress.isp}` : ''}
              {!egress && !loadingEgress && 'Egress IP diagnostics offline'}
            </div>
          </div>
        </div>

        {/* Live Metrics: Throughput & Sockets */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Live Speed */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-[6px] border border-divider bg-background text-xs font-mono h-8">
            <div className="flex items-center gap-1 text-emerald-500">
              <LuArrowDown className="text-sm" />
              <span>{calcTraffic(downloadSpeed)}/s</span>
            </div>
            <div className="flex items-center gap-1 text-sky-500">
              <LuArrowUp className="text-sm" />
              <span>{calcTraffic(uploadSpeed)}/s</span>
            </div>
          </div>

          {/* Sockets Counter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] border border-divider bg-background text-xs h-8">
            <LuActivity className="text-sm text-primary" />
            <span className="font-semibold text-foreground">{activeCount}</span>
            <span className="text-default-400">active</span>
            <span className="text-divider">•</span>
            <span className="text-default-500">{closedCount} closed</span>
          </div>

          {/* Mode Badge */}
          <Chip
            size="sm"
            variant="flat"
            className="h-8 px-3 text-xs font-mono capitalize border border-divider bg-background rounded-[6px]"
          >
            Mode: {mode}
          </Chip>

          {/* Collapsible Tool Toggles */}
          <div className="flex items-center gap-1.5">
            {onToggleNetwork && (
              <button
                type="button"
                onClick={onToggleNetwork}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-[6px] border text-xs font-medium transition-colors ${
                  showNetwork
                    ? 'border-primary/50 bg-primary/10 text-primary font-semibold'
                    : 'border-divider bg-background text-default-600 hover:text-foreground hover:bg-content2'
                }`}
              >
                <LuGlobe className="text-sm" />
                <span>Network</span>
              </button>
            )}

            {onToggleAnalytics && (
              <button
                type="button"
                onClick={onToggleAnalytics}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-[6px] border text-xs font-medium transition-colors ${
                  showAnalytics
                    ? 'border-primary/50 bg-primary/10 text-primary font-semibold'
                    : 'border-divider bg-background text-default-600 hover:text-foreground hover:bg-content2'
                }`}
              >
                <LuTrendingUp className="text-sm" />
                <span>Analytics</span>
              </button>
            )}

            {onToggleLogs && (
              <button
                type="button"
                onClick={onToggleLogs}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-[6px] border text-xs font-medium transition-colors ${
                  showLogs
                    ? 'border-primary/50 bg-primary/10 text-primary font-semibold'
                    : 'border-divider bg-background text-default-600 hover:text-foreground hover:bg-content2'
                }`}
              >
                <LuTerminal className="text-sm" />
                <span>Kernel logs</span>
              </button>
            )}

            <Tooltip content="Close all active connections">
              <button
                type="button"
                onClick={() => void mihomoCloseAllConnections()}
                className="flex items-center justify-center h-8 w-8 rounded-[6px] border border-divider bg-background text-default-400 hover:text-danger hover:border-danger/40 transition-colors"
                aria-label="Close all connections"
              >
                <CgTrash className="text-sm" />
              </button>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TelemetryHud
