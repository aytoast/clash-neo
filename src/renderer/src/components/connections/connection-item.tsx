import { Avatar, Button } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from '@renderer/utils/dayjs'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { CgClose, CgTrash } from 'react-icons/cg'
import { LuCompass, LuInfo } from 'react-icons/lu'
import { platform } from '@renderer/utils/init'
import { connectionFallbackIcon } from '@renderer/utils/connection-icon'

interface Props {
  index: number
  info: IMihomoConnectionDetail
  displayIcon?: boolean
  iconUrl: string
  displayName?: string
  selected: IMihomoConnectionDetail | undefined
  setSelected: React.Dispatch<React.SetStateAction<IMihomoConnectionDetail | undefined>>
  setIsDetailModalOpen: React.Dispatch<React.SetStateAction<boolean>>
  onOpenQuickRoute?: (conn: IMihomoConnectionDetail) => void
  close: (id: string) => void
}

const ConnectionItemComponent: React.FC<Props> = ({
  index,
  info,
  displayIcon,
  iconUrl,
  displayName,
  close,
  setSelected,
  setIsDetailModalOpen,
  onOpenQuickRoute
}) => {
  const fallbackProcessName = useMemo(
    () => info.metadata.process?.replace(/\.exe$/, '') || info.metadata.sourceIP,
    [info.metadata.process, info.metadata.sourceIP]
  )
  const processName = displayName || fallbackProcessName
  const fallbackIcon = connectionFallbackIcon(platform, info.metadata.processPath)

  const destination = useMemo(
    () =>
      info.metadata.host ||
      info.metadata.sniffHost ||
      info.metadata.destinationIP ||
      info.metadata.remoteDestination,
    [
      info.metadata.host,
      info.metadata.sniffHost,
      info.metadata.destinationIP,
      info.metadata.remoteDestination
    ]
  )

  const [timeAgo, setTimeAgo] = useState(() => dayjs(info.start).fromNow())

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeAgo(dayjs(info.start).fromNow())
    }, 60000)

    return () => clearInterval(timer)
  }, [info.start])

  const uploadTraffic = useMemo(() => calcTraffic(info.upload), [info.upload])
  const downloadTraffic = useMemo(() => calcTraffic(info.download), [info.download])

  const uploadSpeed = useMemo(
    () => (info.uploadSpeed ? calcTraffic(info.uploadSpeed) : null),
    [info.uploadSpeed]
  )
  const downloadSpeed = useMemo(
    () => (info.downloadSpeed ? calcTraffic(info.downloadSpeed) : null),
    [info.downloadSpeed]
  )

  const hasSpeed = useMemo(
    () => Boolean(info.uploadSpeed || info.downloadSpeed),
    [info.uploadSpeed, info.downloadSpeed]
  )

  const handleOpenDetail = useCallback(() => {
    setSelected(info)
    setIsDetailModalOpen(true)
  }, [info, setSelected, setIsDetailModalOpen])

  const handleRouteClick = useCallback(() => {
    onOpenQuickRoute?.(info)
  }, [info, onOpenQuickRoute])

  const handleClose = useCallback(() => {
    close(info.id)
  }, [close, info.id])

  const isDirect = info.chains[0]?.toUpperCase() === 'DIRECT'

  return (
    <div className={`px-2 pb-2 ${index === 0 ? 'pt-2' : ''}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpenDetail}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleOpenDetail()
        }}
        className="shadcn-card p-3 border border-divider hover:border-default-400 bg-content1 transition-all cursor-pointer select-none space-y-2.5"
      >
        {/* Top Line: App + Host + Actions */}
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {displayIcon && (
              <div className="h-8 w-8 rounded-[5px] border border-divider bg-background flex items-center justify-center shrink-0 overflow-hidden">
                <Avatar
                  size="sm"
                  radius="sm"
                  src={iconUrl || fallbackIcon}
                  showFallback
                  fallback={
                    <img src={fallbackIcon} alt="" className="w-full h-full object-cover" />
                  }
                  className="bg-transparent w-7 h-7"
                />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground truncate">
                  {destination}
                </span>
                <span className="text-xs text-default-400 font-mono shrink-0">
                  :{info.metadata.destinationPort}
                </span>
              </div>
              <div className="text-xs text-default-500 font-mono truncate">
                {processName} • {info.metadata.type}({info.metadata.network.toUpperCase()}) •{' '}
                {timeAgo}
              </div>
            </div>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* 1-Click Route / Override Button */}
            <Button
              size="sm"
              variant="flat"
              className="h-7 px-2.5 text-xs font-medium border border-divider bg-background hover:bg-content2"
              startContent={<LuCompass className="text-xs text-primary" />}
              onPress={handleRouteClick}
            >
              Route
            </Button>

            {/* Inspect Detail Button */}
            <Button
              size="sm"
              variant="light"
              isIconOnly
              className="h-7 w-7 min-w-0 p-0 text-default-400 hover:text-foreground"
              onPress={handleOpenDetail}
              title="Inspect connection details"
            >
              <LuInfo className="text-sm" />
            </Button>

            {/* Kill / Close Socket Button */}
            <Button
              size="sm"
              variant="light"
              isIconOnly
              color={info.isActive ? 'warning' : 'danger'}
              className="h-7 w-7 min-w-0 p-0"
              onPress={handleClose}
              title={info.isActive ? 'Close connection' : 'Remove connection'}
            >
              {info.isActive ? (
                <CgClose className="text-base" />
              ) : (
                <CgTrash className="text-base" />
              )}
            </Button>
          </div>
        </div>

        {/* Bottom Line: Route Chain & Bandwidth Metrics */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-divider/60 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
            {/* Status Dot */}
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${
                info.isActive ? 'bg-emerald-500 ring-2 ring-emerald-500/20' : 'bg-default-400'
              }`}
            />

            {/* Rule Match Pill */}
            {info.rule && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-[4px] border border-divider bg-background text-default-600 truncate max-w-[200px]">
                {info.rule}: {info.rulePayload || 'Match'}
              </span>
            )}

            {/* Outbound Chain */}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-[4px] border truncate max-w-[180px] flag-emoji ${
                isDirect
                  ? 'border-default-300 bg-background text-default-500'
                  : 'border-primary/40 bg-primary/10 text-primary'
              }`}
            >
              {info.chains.join(' → ') || 'Direct'}
            </span>
          </div>

          {/* Traffic Counters */}
          <div className="flex items-center gap-2.5 text-xs font-mono text-default-600 shrink-0">
            <span>↓ {downloadTraffic}</span>
            <span>↑ {uploadTraffic}</span>
            {hasSpeed && (
              <span className="text-primary font-semibold">
                (↓{downloadSpeed || '0B'}/s ↑{uploadSpeed || '0B'}/s)
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const ConnectionItem = memo(ConnectionItemComponent, (prevProps, nextProps) => {
  return (
    prevProps.info.id === nextProps.info.id &&
    prevProps.info.upload === nextProps.info.upload &&
    prevProps.info.download === nextProps.info.download &&
    prevProps.info.uploadSpeed === nextProps.info.uploadSpeed &&
    prevProps.info.downloadSpeed === nextProps.info.downloadSpeed &&
    prevProps.info.isActive === nextProps.info.isActive &&
    prevProps.iconUrl === nextProps.iconUrl &&
    prevProps.info.metadata.processPath === nextProps.info.metadata.processPath &&
    prevProps.displayIcon === nextProps.displayIcon &&
    prevProps.displayName === nextProps.displayName &&
    prevProps.selected?.id === nextProps.selected?.id
  )
})

export default ConnectionItem
