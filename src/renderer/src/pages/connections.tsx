import { useConnectionApps, connectionAppKey } from '@renderer/hooks/use-connection-apps'
import BasePage from '@renderer/components/base/base-page'
import { mihomoCloseAllConnections, mihomoCloseConnection } from '@renderer/utils/ipc'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Input,
  Select,
  SelectItem,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem
} from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'
import ConnectionTable, {
  CONNECTION_TABLE_COLUMNS,
  DEFAULT_CONNECTION_TABLE_COLUMN_KEYS
} from '@renderer/components/connections/connection-table'
import { Virtuoso } from 'react-virtuoso'
import dayjs from '@renderer/utils/dayjs'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import QuickRouteModal from '@renderer/components/connections/quick-route-modal'
import { CgClose, CgTrash } from 'react-icons/cg'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { MdViewList, MdTableChart } from 'react-icons/md'
import { HiOutlineAdjustmentsHorizontal } from 'react-icons/hi2'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useTranslation } from 'react-i18next'
import { IoMdPause, IoMdPlay } from 'react-icons/io'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'

let cachedConnections: IMihomoConnectionDetail[] = []
const CONNECTIONS_FILTER_KEY = 'connections-filter'

interface ConnectionsProps {
  embedded?: boolean
}

const Connections: React.FC<ConnectionsProps> = ({ embedded = false }: ConnectionsProps) => {
  const { t } = useTranslation()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'find-process-mode': findProcessMode = 'always' } = controledMihomoConfig || {}
  const [filter, setFilter] = useState(() => localStorage.getItem(CONNECTIONS_FILTER_KEY) || '')
  const { appConfig, patchAppConfig } = useAppConfig()
  const appConfigValues: Partial<IAppConfig> = appConfig ?? {}
  const {
    connectionDirection = 'asc',
    connectionOrderBy = 'time',
    connectionViewMode = 'list',
    connectionTableColumns = DEFAULT_CONNECTION_TABLE_COLUMN_KEYS,
    connectionTableColumnWidths,
    connectionTableSortColumn,
    connectionTableSortDirection,
    displayIcon = true,
    displayAppName = true
  } = appConfigValues
  const [connectionsInfo, setConnectionsInfo] = useState<IMihomoConnectionsInfo>()
  const [allConnections, setAllConnections] = useState<IMihomoConnectionDetail[]>(cachedConnections)
  const [activeConnections, setActiveConnections] = useState<IMihomoConnectionDetail[]>([])
  const [closedConnections, setClosedConnections] = useState<IMihomoConnectionDetail[]>([])
  const connectionApps = useConnectionApps(
    activeConnections,
    closedConnections,
    findProcessMode !== 'off' && (displayIcon || displayAppName)
  )
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selected, setSelected] = useState<IMihomoConnectionDetail>()
  const [tab, setTab] = useState('active')
  const [isPaused, setIsPaused] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'table'>(connectionViewMode)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(connectionTableColumns))
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'proxied' | 'direct'>('all')
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [quickRouteConn, setQuickRouteConn] = useState<IMihomoConnectionDetail | null>(null)

  const topApps = useMemo(() => {
    const counts = new Map<string, number>()
    const currentList = tab === 'active' ? activeConnections : closedConnections
    currentList.forEach((c) => {
      const name = c.metadata.process?.replace(/\.exe$/, '') || c.metadata.sourceIP
      if (name) counts.set(name, (counts.get(name) || 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name)
  }, [tab, activeConnections, closedConnections])

  const activeConnectionsRef = useRef(activeConnections)
  const allConnectionsRef = useRef(allConnections)

  useEffect(() => {
    activeConnectionsRef.current = activeConnections
    allConnectionsRef.current = allConnections
  }, [activeConnections, allConnections])

  useEffect(() => {
    localStorage.setItem(CONNECTIONS_FILTER_KEY, filter)
  }, [filter])

  useEffect(() => {
    setViewMode(connectionViewMode)
  }, [connectionViewMode])

  useEffect(() => {
    setVisibleColumns(new Set(connectionTableColumns))
  }, [connectionTableColumns])

  const selectedConnection = useMemo(() => {
    if (!selected) return undefined
    return (
      activeConnections.find((c) => c.id === selected.id) ||
      closedConnections.find((c) => c.id === selected.id) ||
      selected
    )
  }, [selected, activeConnections, closedConnections])

  const handleColumnWidthChange = useCallback(
    async (widths: Record<string, number>) => {
      await patchAppConfig({ connectionTableColumnWidths: widths })
    },
    [patchAppConfig]
  )

  const handleSortChange = useCallback(
    async (column: string, direction: 'asc' | 'desc') => {
      await patchAppConfig({
        connectionTableSortColumn: column,
        connectionTableSortDirection: direction
      })
    },
    [patchAppConfig]
  )

  const filteredConnections = useMemo(() => {
    const connections = tab === 'active' ? activeConnections : closedConnections

    let filtered =
      filter === ''
        ? connections
        : connections.filter((connection) => {
            const raw = JSON.stringify(connection)
            return includesIgnoreCase(raw, filter)
          })

    if (categoryFilter === 'proxied') {
      filtered = filtered.filter((c) => c.chains[0]?.toUpperCase() !== 'DIRECT')
    } else if (categoryFilter === 'direct') {
      filtered = filtered.filter((c) => c.chains[0]?.toUpperCase() === 'DIRECT')
    }

    if (selectedApp) {
      filtered = filtered.filter((c) => {
        const name = c.metadata.process?.replace(/\.exe$/, '') || c.metadata.sourceIP
        return name === selectedApp
      })
    }

    if (viewMode === 'list' && connectionOrderBy) {
      return [...filtered].sort((a, b) => {
        let comparison = 0
        switch (connectionOrderBy) {
          case 'time':
            comparison = dayjs(a.start).unix() - dayjs(b.start).unix()
            break
          case 'upload':
            comparison = a.upload - b.upload
            break
          case 'download':
            comparison = a.download - b.download
            break
          case 'uploadSpeed':
            comparison = (a.uploadSpeed || 0) - (b.uploadSpeed || 0)
            break
          case 'downloadSpeed':
            comparison = (a.downloadSpeed || 0) - (b.downloadSpeed || 0)
            break
        }
        return connectionDirection === 'asc' ? comparison : -comparison
      })
    }

    return filtered
  }, [
    activeConnections,
    closedConnections,
    tab,
    filter,
    categoryFilter,
    selectedApp,
    connectionDirection,
    connectionOrderBy,
    viewMode
  ])

  const closeAllConnections = useCallback((): void => {
    tab === 'active' ? mihomoCloseAllConnections() : trashAllClosedConnection()
  }, [tab])

  const closeConnection = useCallback(
    (id: string): void => {
      tab === 'active' ? mihomoCloseConnection(id) : trashClosedConnection(id)
    },
    [tab]
  )

  const trashAllClosedConnection = (): void => {
    setClosedConnections((closedConns) => {
      const trashIds = new Set(closedConns.map((conn) => conn.id))
      setAllConnections((allConns) => {
        const filtered = allConns.filter((conn) => !trashIds.has(conn.id))
        cachedConnections = filtered
        return filtered
      })
      return []
    })
  }

  const trashClosedConnection = (id: string): void => {
    setAllConnections((allConns) => {
      const filtered = allConns.filter((conn) => conn.id !== id)
      cachedConnections = filtered
      return filtered
    })
    setClosedConnections((closedConns) => closedConns.filter((conn) => conn.id !== id))
  }

  useEffect(() => {
    let pendingInfo: IMihomoConnectionsInfo | undefined
    let frameId: number | undefined

    const updateConnections = (info: IMihomoConnectionsInfo): void => {
      setConnectionsInfo(info)

      if (!info.connections) return
      // O(n+m) merge using Map instead of O(n²) unionWith
      const allConnsMap = new Map(allConnectionsRef.current.map((c) => [c.id, c]))
      activeConnectionsRef.current.forEach((c) => allConnsMap.set(c.id, c))
      const allConns = Array.from(allConnsMap.values())

      const prevConnMap = new Map(activeConnectionsRef.current.map((c) => [c.id, c]))
      const activeConns = info.connections.map((conn) => {
        const preConn = prevConnMap.get(conn.id)
        return {
          ...conn,
          isActive: true,
          downloadSpeed: preConn ? conn.download - preConn.download : 0,
          uploadSpeed: preConn ? conn.upload - preConn.upload : 0
        }
      })
      // O(n+m) difference using Set instead of O(n²) differenceWith
      const activeIdSet = new Set(activeConns.map((c) => c.id))
      const closedConns = allConns
        .filter((c) => !activeIdSet.has(c.id))
        .map((conn) => ({
          ...conn,
          isActive: false,
          downloadSpeed: 0,
          uploadSpeed: 0
        }))

      const sliced = allConns.slice(-(activeConns.length + 200))
      setActiveConnections(activeConns)
      setClosedConnections(closedConns)
      setAllConnections(sliced)
      cachedConnections = sliced
    }

    const handler = (_e: unknown, ...args: unknown[]): void => {
      const info = args[0] as IMihomoConnectionsInfo | undefined
      if (!info || document.hidden) return

      pendingInfo = info
      if (frameId !== undefined) return
      frameId = window.requestAnimationFrame(() => {
        frameId = undefined
        const latestInfo = pendingInfo
        pendingInfo = undefined
        if (latestInfo && !document.hidden) updateConnections(latestInfo)
      })
    }

    let unsubscribe: (() => void) | null = null
    if (!isPaused) {
      unsubscribe = window.electron.ipcRenderer.on('mihomoConnections', handler)
    }

    return (): void => {
      unsubscribe?.()
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
      pendingInfo = undefined
    }
  }, [isPaused])

  const openConnectionDetail = useCallback((connection: IMihomoConnectionDetail): void => {
    setSelected(connection)
    setIsDetailModalOpen(true)
  }, [])
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev)
  }, [])

  const renderConnectionItem = useCallback(
    (i: number, connection: IMihomoConnectionDetail) => {
      const info = connectionApps[connectionAppKey(connection)]
      const iconUrl = (displayIcon && findProcessMode !== 'off' && info?.icon) || ''
      const displayName = displayAppName && findProcessMode !== 'off' ? info?.name : undefined

      return (
        <ConnectionItem
          setSelected={setSelected}
          setIsDetailModalOpen={setIsDetailModalOpen}
          selected={selected}
          iconUrl={iconUrl}
          displayIcon={displayIcon && findProcessMode !== 'off'}
          displayName={displayName}
          close={closeConnection}
          onOpenQuickRoute={(c) => setQuickRouteConn(c)}
          index={i}
          key={connection.id}
          info={connection}
        />
      )
    },
    [displayIcon, connectionApps, selected, closeConnection, findProcessMode, displayAppName]
  )

  const headerControls = (
    <div className="flex items-center gap-2">
      <div className="flex items-center text-xs text-default-500 font-mono">
        <span className="mr-2">↑ {calcTraffic(connectionsInfo?.uploadTotal ?? 0)}</span>
        <span>↓ {calcTraffic(connectionsInfo?.downloadTotal ?? 0)}</span>
      </div>
      <Button
        className="app-nodrag"
        title={
          viewMode === 'list'
            ? t('connections.table.switchToTable')
            : t('connections.table.switchToList')
        }
        isIconOnly
        size="sm"
        variant="flat"
        onPress={async () => {
          const newMode = viewMode === 'list' ? 'table' : 'list'
          setViewMode(newMode)
          await patchAppConfig({ connectionViewMode: newMode })
        }}
      >
        {viewMode === 'list' ? (
          <MdTableChart className="text-base" />
        ) : (
          <MdViewList className="text-base" />
        )}
      </Button>
      <Button
        className="app-nodrag"
        title={isPaused ? t('connections.resume') : t('connections.pause')}
        isIconOnly
        size="sm"
        variant="flat"
        onPress={togglePause}
      >
        {isPaused ? <IoMdPlay className="text-base" /> : <IoMdPause className="text-base" />}
      </Button>
      <Button
        className="app-nodrag text-danger"
        title={t('connections.closeAll')}
        isIconOnly
        size="sm"
        variant="flat"
        onPress={() => {
          if (filter === '') {
            closeAllConnections()
          } else {
            filteredConnections.forEach((conn) => {
              closeConnection(conn.id)
            })
          }
        }}
      >
        {tab === 'active' ? <CgClose className="text-base" /> : <CgTrash className="text-base" />}
      </Button>
    </div>
  )

  const currentList = tab === 'active' ? activeConnections : closedConnections
  const proxiedCount = useMemo(
    () => currentList.filter((c) => c.chains[0]?.toUpperCase() !== 'DIRECT').length,
    [currentList]
  )
  const directCount = useMemo(
    () => currentList.filter((c) => c.chains[0]?.toUpperCase() === 'DIRECT').length,
    [currentList]
  )

  const bodyContent = (
    <div className="flex flex-col h-full w-full">
      {isDetailModalOpen && selectedConnection && (
        <ConnectionDetailModal
          onClose={() => setIsDetailModalOpen(false)}
          connection={selectedConnection}
        />
      )}
      {quickRouteConn && (
        <QuickRouteModal
          connection={quickRouteConn}
          isOpen={true}
          onClose={() => setQuickRouteConn(null)}
        />
      )}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-divider">
        <div className="flex p-2 gap-2 items-center justify-between flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Active / Closed Segmented Control */}
            <div className="inline-flex items-center gap-1 p-0.5 rounded-[6px] border border-divider bg-content1">
              <button
                type="button"
                onClick={() => setTab('active')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-[4px] transition-all ${
                  tab === 'active'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-default-500 hover:text-foreground'
                }`}
              >
                <span>{t('connections.active')}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                  {activeConnections.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('closed')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-[4px] transition-all ${
                  tab === 'closed'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-default-500 hover:text-foreground'
                }`}
              >
                <span>{t('connections.closed')}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-full bg-default-200 text-default-600">
                  {closedConnections.length}
                </span>
              </button>
            </div>

            <Input
              variant="flat"
              size="sm"
              value={filter}
              placeholder="Search host, IP, app name, or rule..."
              isClearable
              className="w-60 text-sm"
              onValueChange={setFilter}
            />
          </div>

          <div className="flex items-center gap-2">
            {embedded && headerControls}
            {viewMode === 'table' && (
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    size="sm"
                    variant="flat"
                    startContent={<HiOutlineAdjustmentsHorizontal className="text-lg" />}
                  >
                    {t('connections.table.columns')}
                  </Button>
                </DropdownTrigger>
                <DropdownMenu
                  aria-label="Column visibility"
                  closeOnSelect={false}
                  selectionMode="multiple"
                  selectedKeys={visibleColumns}
                  onSelectionChange={async (keys) => {
                    const newColumns =
                      keys === 'all'
                        ? CONNECTION_TABLE_COLUMNS.map((column) => column.key)
                        : Array.from(keys).map(String)
                    setVisibleColumns(new Set(newColumns))
                    await patchAppConfig({ connectionTableColumns: newColumns })
                  }}
                >
                  {CONNECTION_TABLE_COLUMNS.map((column) => (
                    <DropdownItem key={column.key}>{t(column.labelKey)}</DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            )}

            {viewMode === 'list' && (
              <>
                <Select
                  classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
                  size="sm"
                  className="w-36 min-w-32 text-xs"
                  aria-label={t('connections.orderBy')}
                  selectedKeys={[connectionOrderBy]}
                  disallowEmptySelection={true}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      connectionOrderBy: v.currentKey as
                        'time' | 'upload' | 'download' | 'uploadSpeed' | 'downloadSpeed'
                    })
                  }}
                >
                  <SelectItem key="time">{t('connections.time')}</SelectItem>
                  <SelectItem key="upload">{t('connections.uploadAmount')}</SelectItem>
                  <SelectItem key="download">{t('connections.downloadAmount')}</SelectItem>
                  <SelectItem key="uploadSpeed">{t('connections.uploadSpeed')}</SelectItem>
                  <SelectItem key="downloadSpeed">{t('connections.downloadSpeed')}</SelectItem>
                </Select>
                <Button
                  size="sm"
                  isIconOnly
                  className="bg-content2"
                  onPress={() => {
                    patchAppConfig({
                      connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc'
                    })
                  }}
                >
                  {connectionDirection === 'asc' ? (
                    <HiSortAscending className="text-lg" />
                  ) : (
                    <HiSortDescending className="text-lg" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Smart PM Diagnostic Filter Pills */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 overflow-x-auto no-scrollbar bg-content1/40 text-xs border-t border-divider/50">
          <span className="text-default-400 font-medium shrink-0">Filter:</span>
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-2.5 py-1 rounded-[4px] border transition-colors shrink-0 ${
              categoryFilter === 'all'
                ? 'border-primary bg-primary text-primary-foreground font-medium'
                : 'border-divider bg-background text-default-600 hover:text-foreground'
            }`}
          >
            All ({currentList.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('proxied')}
            className={`px-2.5 py-1 rounded-[4px] border transition-colors shrink-0 ${
              categoryFilter === 'proxied'
                ? 'border-primary bg-primary text-primary-foreground font-medium'
                : 'border-divider bg-background text-default-600 hover:text-foreground'
            }`}
          >
            Proxied ({proxiedCount})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('direct')}
            className={`px-2.5 py-1 rounded-[4px] border transition-colors shrink-0 ${
              categoryFilter === 'direct'
                ? 'border-primary bg-primary text-primary-foreground font-medium'
                : 'border-divider bg-background text-default-600 hover:text-foreground'
            }`}
          >
            Direct ({directCount})
          </button>

          {topApps.length > 0 && <span className="text-divider mx-1">|</span>}

          {topApps.map((appName) => (
            <button
              key={appName}
              type="button"
              onClick={() => setSelectedApp(selectedApp === appName ? null : appName)}
              className={`px-2 py-0.5 rounded-[4px] border transition-colors shrink-0 ${
                selectedApp === appName
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500 font-medium'
                  : 'border-divider bg-background text-default-500 hover:text-foreground'
              }`}
            >
              {appName}
            </button>
          ))}

          {(categoryFilter !== 'all' || selectedApp) && (
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('all')
                setSelectedApp(null)
              }}
              className="text-xs text-default-400 hover:text-foreground underline ml-1 shrink-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      <div className={embedded ? 'flex-1 min-h-[460px]' : 'h-[calc(100vh-100px)] mt-px'}>
        {viewMode === 'list' ? (
          <Virtuoso data={filteredConnections} itemContent={renderConnectionItem} />
        ) : (
          <ConnectionTable
            connections={filteredConnections}
            onOpenDetail={openConnectionDetail}
            close={closeConnection}
            visibleColumns={visibleColumns}
            columnWidths={connectionTableColumnWidths}
            sortColumn={connectionTableSortColumn}
            sortDirection={connectionTableSortDirection}
            onColumnWidthChange={handleColumnWidthChange}
            onSortChange={handleSortChange}
          />
        )}
      </div>
    </div>
  )

  if (embedded) {
    return bodyContent
  }

  return (
    <BasePage title={t('connections.title')} header={headerControls}>
      {bodyContent}
    </BasePage>
  )
}

export default Connections
