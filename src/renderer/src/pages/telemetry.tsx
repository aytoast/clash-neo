import React, { useEffect, useState } from 'react'
import BasePage from '@renderer/components/base/base-page'
import TelemetryHud from '@renderer/components/telemetry/telemetry-hud'
import { useSearchParams } from 'react-router-dom'
import Connections from './connections'
import TrafficPage from './traffic'
import Logs from './logs'
import NetworkPage from './network'

const TelemetryPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const qTab = searchParams.get('tab')

  const [activeCount, setActiveCount] = useState(0)
  const [closedCount] = useState(0)
  const [showNetwork, setShowNetwork] = useState(qTab === 'network')
  const [showAnalytics, setShowAnalytics] = useState(qTab === 'traffic')
  const [showLogs, setShowLogs] = useState(qTab === 'logs')

  useEffect(() => {
    if (qTab === 'network') setShowNetwork(true)
    if (qTab === 'traffic') setShowAnalytics(true)
    if (qTab === 'logs') setShowLogs(true)
  }, [qTab])

  useEffect(() => {
    const onConns = (_e: unknown, ...args: unknown[]): void => {
      const info = args[0] as IMihomoConnectionsInfo
      if (info && info.connections) {
        setActiveCount(info.connections.length)
      }
    }
    const unsub = window.electron.ipcRenderer.on('mihomoConnections', onConns)
    return () => {
      unsub()
    }
  }, [])

  return (
    <BasePage title="Telemetry">
      <div className="flex flex-col h-full w-full select-none">
        {/* Top Diagnostic HUD - Single Source of Truth */}
        <TelemetryHud
          activeCount={activeCount}
          closedCount={closedCount}
          showNetwork={showNetwork}
          onToggleNetwork={() => setShowNetwork(!showNetwork)}
          showAnalytics={showAnalytics}
          onToggleAnalytics={() => setShowAnalytics(!showAnalytics)}
          showLogs={showLogs}
          onToggleLogs={() => setShowLogs(!showLogs)}
        />

        {/* Collapsible Network Diagnostics & Topology Panel */}
        {showNetwork && (
          <div className="px-3 pb-2 shrink-0">
            <div className="border border-divider rounded-[6px] bg-content1 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-divider bg-content2/50 text-xs font-semibold text-foreground">
                <span>Network Topology & IP Diagnostics</span>
                <button
                  type="button"
                  onClick={() => setShowNetwork(false)}
                  className="text-default-400 hover:text-foreground text-xs"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[380px] overflow-y-auto">
                <NetworkPage embedded={true} />
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Traffic Analytics Panel */}
        {showAnalytics && (
          <div className="px-3 pb-2 shrink-0">
            <div className="border border-divider rounded-[6px] bg-content1 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-divider bg-content2/50 text-xs font-semibold text-foreground">
                <span>Traffic & Host Breakdown</span>
                <button
                  type="button"
                  onClick={() => setShowAnalytics(false)}
                  className="text-default-400 hover:text-foreground text-xs"
                >
                  Close
                </button>
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                <TrafficPage embedded={true} />
              </div>
            </div>
          </div>
        )}

        {/* Collapsible Kernel Logs Panel */}
        {showLogs && (
          <div className="px-3 pb-2 shrink-0">
            <div className="border border-divider rounded-[6px] bg-content1 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-divider bg-content2/50 text-xs font-semibold text-foreground">
                <span>Kernel Log Stream</span>
                <button
                  type="button"
                  onClick={() => setShowLogs(false)}
                  className="text-default-400 hover:text-foreground text-xs"
                >
                  Close
                </button>
              </div>
              <div className="h-[220px] overflow-hidden">
                <Logs embedded={true} />
              </div>
            </div>
          </div>
        )}

        {/* Real-time Connection Stream & 1-Click Remediation (Primary Canvas) */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <Connections embedded={true} />
        </div>
      </div>
    </BasePage>
  )
}

export default TelemetryPage
