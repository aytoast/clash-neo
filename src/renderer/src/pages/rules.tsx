import BasePage from '@renderer/components/base/base-page'
import RuleItem from '@renderer/components/rules/rule-item'
import { Virtuoso } from 'react-virtuoso'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Spinner } from '@heroui/react'
import { useRules } from '@renderer/hooks/use-rules'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useTranslation } from 'react-i18next'
import { useActiveProfile } from '@renderer/hooks/use-active-profile'
import useSWR from 'swr'
import { MdAdd } from 'react-icons/md'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import SortableGroup from '@renderer/components/proxies/sortable-group'
import EditModeMenu from '@renderer/components/local/edit-mode-menu'
import RuleEditorModal from '@renderer/components/rules/rule-editor-modal'
import { getLocalRulesEditor, saveLocalRules } from '@renderer/utils/ipc'
import { toast } from '@renderer/components/base/toast'
import { parseLocalRule } from '../../../shared/local-rules'
import type { LocalRuleEditor } from '../../../shared/local-config'

const RULES_FILTER_KEY = 'rules-filter'

type RulePriorityFilter = 'all' | 'custom' | 'provider'

interface RulesProps {
  embedded?: boolean
}

const Rules: React.FC<RulesProps> = ({ embedded = false }: RulesProps) => {
  const { rules, mutate } = useRules()
  const [filter, setFilter] = useState(() => localStorage.getItem(RULES_FILTER_KEY) || '')
  const [priorityFilter, setPriorityFilter] = useState<RulePriorityFilter>('all')
  const { t } = useTranslation()
  const { isLocalActive: localMode } = useActiveProfile()
  const [editMode, setEditMode] = useState(false)
  const editing = localMode && editMode
  const {
    data,
    error,
    mutate: refresh
  } = useSWR(editing ? 'getLocalRulesEditor' : null, getLocalRulesEditor)
  const [editor, setEditor] = useState<{
    index: number | null
    insertAt?: number
    data: LocalRuleEditor
  }>()
  const [savingOrder, setSavingOrder] = useState(false)
  useEffect(() => {
    if (!editing) return
    return window.electron.ipcRenderer.on('localConfigUpdated', () => {
      void refresh()
    })
  }, [editing, refresh])
  const [dragging, setDragging] = useState(false)
  const lastDragEnd = useRef(0)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const saved = (): void => {
    void refresh()
    mutate()
  }
  const open = (index: number | null, insertAt?: number): void => {
    if (data && !error && !savingOrder && !dragging && Date.now() - lastDragEnd.current > 250)
      setEditor({ index, insertAt, data })
  }
  const renderInsertion = (index: number, before = false): React.ReactNode => {
    if (!data || filter.trim() || savingOrder || dragging || editor || error) return null
    return (
      <div
        className={`group absolute inset-x-2 ${before ? '-top-1' : '-bottom-1'} z-10 flex h-4 items-center justify-center`}
      >
        <div className="pointer-events-none absolute inset-x-2 h-px bg-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
        <Button
          size="sm"
          color="primary"
          aria-label={index === 0 ? '在规则列表顶部新建规则' : `在第 ${index} 条规则后新建规则`}
          className={`h-6 min-w-0 gap-1 px-2 ${data.rules.length ? 'opacity-0' : 'opacity-100'} group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100`}
          startContent={<MdAdd className="text-base" />}
          onPress={() => open(null, index)}
        >
          新建
        </Button>
      </div>
    )
  }
  const reorder = async ({ active, over }: DragEndEvent): Promise<void> => {
    setDragging(false)
    lastDragEnd.current = Date.now()
    if (!data || !over || active.id === over.id || filter.trim() || savingOrder) return
    const indices = data.rules.map((_, index) => index)
    const from = indices.findIndex((index) => `rule:${index}` === active.id)
    const to = indices.findIndex((index) => `rule:${index}` === over.id)
    if (from < 0 || to < 0) return
    setSavingOrder(true)
    try {
      await saveLocalRules({ action: 'reorder', order: arrayMove(indices, from, to) }, data.rules)
      await refresh()
      mutate()
    } catch (error) {
      toast.error(String(error))
    } finally {
      setSavingOrder(false)
    }
  }
  useEffect(() => {
    if (!localMode) {
      setEditMode(false)
      setEditor(undefined)
    }
  }, [localMode])

  useEffect(() => {
    localStorage.setItem(RULES_FILTER_KEY, filter)
  }, [filter])

  const allRules = useMemo<IMihomoRulesDetail[]>(() => {
    if (editing) {
      return (data?.rules || []).map((rule, index) => {
        const parsed = parseLocalRule(rule)
        return {
          index,
          type: parsed.type,
          payload: parsed.payload || parsed.type,
          proxy: parsed.target,
          size: -1
        }
      })
    }
    return rules?.rules || []
  }, [rules, editing, data])

  const filteredRules = useMemo<IMihomoRulesDetail[]>(() => {
    let result = allRules

    if (priorityFilter === 'custom') {
      result = result.filter(() => editing)
    } else if (priorityFilter === 'provider') {
      result = result.filter(() => !editing)
    }

    if (filter !== '') {
      result = result.filter((rule) => {
        return (
          includesIgnoreCase(rule.payload, filter) ||
          includesIgnoreCase(rule.type, filter) ||
          includesIgnoreCase(rule.proxy, filter)
        )
      })
    }
    return result
  }, [allRules, priorityFilter, filter, editing])

  const customCount = editing ? (data?.rules?.length ?? 0) : 0
  const providerCount = editing ? 0 : (rules?.rules?.length ?? 0)

  const toolbarHeader = localMode ? (
    <div className="flex items-center gap-2 app-nodrag">
      <Button
        size="sm"
        color="primary"
        className="h-7 px-2.5 text-xs font-medium"
        startContent={<MdAdd className="text-sm" />}
        onPress={() => {
          if (!editMode) setEditMode(true)
          open(null, 0)
        }}
      >
        Add Rule
      </Button>
      <EditModeMenu
        enabled={editing}
        disabled={savingOrder}
        onChange={(enabled) => {
          setEditMode(enabled)
          setEditor(undefined)
        }}
      />
    </div>
  ) : undefined

  const bodyContent = (
    <div className="flex flex-col h-full w-full">
      {embedded && toolbarHeader && (
        <div className="flex items-center justify-end px-3 py-1.5 border-b border-divider bg-background/50">
          {toolbarHeader}
        </div>
      )}
      {editing && editor && (
        <RuleEditorModal
          index={editor.index}
          insertAt={editor.insertAt}
          data={editor.data}
          onClose={() => setEditor(undefined)}
          onSaved={saved}
        />
      )}
      <div className="sticky top-0 z-40 bg-background border-b border-divider">
        {/* Priority Evaluation Chain Banner */}
        <div className="px-3 pt-2 pb-1.5 flex items-center justify-between gap-2 text-xs text-default-500 border-b border-divider/40">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-foreground/80">Priority order:</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 font-medium">
              1. Custom Overrides (P1)
            </span>
            <span>&rarr;</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
              2. Provider Defaults (P2)
            </span>
            <span>&rarr;</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-default-200/50 text-default-600 font-medium">
              3. Match Fallback
            </span>
          </div>
          <div className="text-default-400 font-mono text-[11px] shrink-0">
            {allRules.length} rules loaded
          </div>
        </div>

        {/* Search & Priority Filter Controls */}
        <div className="p-2 flex items-center gap-2">
          <Input
            size="sm"
            value={filter}
            placeholder={t('rules.filter')}
            isClearable
            onValueChange={setFilter}
            className="flex-1"
          />
          <div className="inline-flex items-center gap-1 p-0.5 rounded-[5px] border border-divider bg-content1 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setPriorityFilter('all')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                priorityFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              All ({allRules.length})
            </button>
            <button
              type="button"
              onClick={() => setPriorityFilter('custom')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                priorityFilter === 'custom'
                  ? 'bg-background text-amber-500 font-semibold shadow-xs'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              Custom ({customCount})
            </button>
            <button
              type="button"
              onClick={() => setPriorityFilter('provider')}
              className={`px-2.5 py-1 rounded-[4px] font-medium transition-colors ${
                priorityFilter === 'provider'
                  ? 'bg-background text-primary font-semibold shadow-xs'
                  : 'text-default-500 hover:text-foreground'
              }`}
            >
              Provider ({providerCount})
            </button>
          </div>
        </div>
      </div>
      {editing ? (
        <>
          {!data && !error && (
            <div className="flex justify-center p-6">
              <Spinner aria-label="加载规则" />
            </div>
          )}
          {error && (
            <div role="alert" className="p-3 text-sm text-danger">
              {String(error)}
            </div>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[({ transform }) => ({ ...transform, x: 0 })]}
            onDragStart={() => {
              setDragging(true)
            }}
            onDragEnd={reorder}
            onDragCancel={() => {
              setDragging(false)
              lastDragEnd.current = Date.now()
            }}
          >
            <SortableContext
              items={filteredRules.map((rule) => `rule:${rule.index}`)}
              strategy={verticalListSortingStrategy}
            >
              <div className="py-2">
                {data?.rules.length === 0 && (
                  <div className="relative h-8">{renderInsertion(0, true)}</div>
                )}
                {filteredRules.map((rule, position) => (
                  <div key={`rule:${rule.index}`} className="relative">
                    {position === 0 && renderInsertion(0, true)}
                    <SortableGroup
                      name={`rule:${rule.index}`}
                      disabled={savingOrder || !!editor || !!filter.trim()}
                    >
                      <RuleItem
                        {...rule}
                        priority="custom"
                        onEdit={() => open(rule.index)}
                        onDelete={
                          data && !savingOrder
                            ? async () => {
                                await saveLocalRules(
                                  { action: 'remove', index: rule.index },
                                  data.rules
                                )
                                saved()
                              }
                            : undefined
                        }
                      />
                    </SortableGroup>
                    {renderInsertion(rule.index + 1)}
                  </div>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <div className="h-[calc(100vh-140px)] mt-px">
          <Virtuoso
            data={filteredRules}
            itemContent={(i, rule) => (
              <RuleItem
                index={rule.index ?? i}
                type={rule.type}
                payload={rule.payload}
                proxy={rule.proxy}
                size={rule.size}
                extra={rule.extra}
                priority={rule.type === 'MATCH' ? 'match' : 'provider'}
              />
            )}
          />
        </div>
      )}
    </div>
  )

  if (embedded) {
    return bodyContent
  }

  return (
    <BasePage title={t('rules.title')} header={toolbarHeader}>
      {bodyContent}
    </BasePage>
  )
}

export default Rules
