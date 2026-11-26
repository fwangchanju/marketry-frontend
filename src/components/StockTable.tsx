import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import ChangeHistoryControls from '@/components/ChangeHistoryControls'
import ColumnFilterButton, { FunnelIcon } from '@/components/ColumnFilterButton'
import EmptyMessage, { EMPTY_DATA_MESSAGE, EMPTY_SEARCH_MESSAGE } from '@/components/EmptyMessage'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import ScrollArea from '@/components/ScrollArea'
import SelectionHintBubble from '@/components/SelectionHintBubble'
import type { SheetSlots } from '@/components/SheetScreen'
import Spinner from '@/components/Spinner'
import { BulkAssignButton, StockSectorCell } from '@/components/StockSectorCells'
import { buildSectorOptions, resolveSectorChain, type SectorOption } from '@/utils/sectorOptions'
import StockSortHeader from '@/components/StockSortHeader'
import StockTableColGroup from '@/components/StockTableColGroup'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { useRowRangeSelection } from '@/hooks/useRowRangeSelection'
import { useStockColumnFilters, type StockFilterKey } from '@/hooks/useStockColumnFilters'
import { useStockColumnWidths } from '@/hooks/useStockColumnWidths'
import type { SectorItem } from '@/types/api'
import { appAlert } from '@/utils/appDialogBus'
import { toSnapshotDateLabel, toSnapshotTimeOnlyLabel } from '@/utils/format'
import { compareKoreanText } from '@/utils/koreanSort'
import { SUSPENDED_STOCK_HINT, isProtectedSectorName, isSuspendedSectorName, placeProtectedSectorsLast } from '@/utils/protectedSector'
import { buildSectorParentHints } from '@/utils/sectorFilterHints'
import { sectorNamesByDepth, sortByMarketValue, type SectorStats } from '@/utils/sectorOrder'
import { readSettingStorage, writeSettingStorage } from '@/utils/settingsStorageGate'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { STOCK_SEARCH_MAX_LENGTH, createStockMatcher } from '@/utils/stockSearch'
import { STOCK_CHECKBOX_COLUMN_PX, STOCK_HEADER_ROW_PX, STOCK_ROW_PX, pinnedStockColumns, stockColumnWidthsTotal, type StockColumnKey, type StockColumnWidths } from '@/utils/stockTableColumns'

// 표의 한 종목. 시장마다 다른 값은 cells에 열 이름으로 담는다.
export interface StockRow {
  code: string
  name: string
  // 고칠 수 있는 둘째 이름(약칭·한글 이름).
  alias: string | null
  marketValue: number | null
  // 배정된 업종. 읽기 전용이거나 배정이 없으면 null이다.
  sectorId: number | null
  // 대·중·소분류 이름. 없으면 '-'.
  path: readonly [string, string, string]
  // 마켓을 색으로 구분하는 종목인지.
  accent: boolean
  cells: Partial<Record<StockColumnKey, string>>
  // 열에 보이지 않지만 검색에 걸리는 이름.
  searchLabel?: string
}

// 대·중·소분류 앞에 놓이는 열. 시장마다 다르다.
export interface StockColumn {
  key: StockColumnKey
  header: string
  align: 'center' | 'left' | 'right'
  text: (row: StockRow) => string
  sort: 'marketValue' | 'text'
  accent?: boolean
  // 이 열이 함께 차지하는 다른 열 자리(그 열을 보이지 않는 사용자).
  spans?: readonly StockColumnKey[]
  headerHint?: string
  cellHint?: boolean
  filter?: { key: StockFilterKey; order?: readonly string[]; isProtected?: (value: string) => boolean }
  // 고칠 수 있는 이름 열.
  isNameEdit?: boolean
}

// 분류를 고치는 동작. 저장하는 곳만 시장마다 다르다.
export interface StockTableEditor {
  sectors: readonly SectorItem[]
  sectorStats: SectorStats
  // 배정이 없던 종목을 되돌릴 업종. 없으면 되돌리지 않는다.
  unassignedId: number | null
  assign: (code: string, sectorId: number) => Promise<void>
  assignMany: (codes: string[], sectorId: number) => Promise<{ failed: readonly string[] }>
  // 종목마다 다른 업종으로 되돌린다. 되돌렸으면 true.
  restore: (entries: readonly { code: string; sectorId: number }[]) => Promise<boolean>
  // 둘째 이름 고치기. 빈 값은 null이다.
  nameEdit: { label: (row: StockRow) => string; maxLength: number; submit: (row: StockRow, value: string | null) => void } | null
}

export interface StockHistoryAction {
  id: string
  after: number
  afterLabel: string
  entries: { code: string; before: number }[]
}

const HISTORY_LIMIT = 9
const NO_EXCLUDED: ReadonlySet<string> = new Set()
const CHECKBOX_CELL_STYLE = { width: `${STOCK_CHECKBOX_COLUMN_PX}px`, minWidth: `${STOCK_CHECKBOX_COLUMN_PX}px`, maxWidth: `${STOCK_CHECKBOX_COLUMN_PX}px`, paddingLeft: 0, paddingRight: 0 } as const
const LEVELS = [
  { key: 'parentSector', header: '대분류' },
  { key: 'midSector', header: '중분류' },
  { key: 'subSector', header: '소분류' },
] as const
const ORDER_STORAGE = 'marketry:sector-filter-order'
const isClassificationFilter = (key: StockFilterKey) => key === 'industry' || key === 'parentSector' || key === 'midSector' || key === 'subSector'
const ALIGN_CLASS = { center: 'text-center', left: 'truncate text-left !pl-2', right: 'text-right !pr-3' } as const
const identity = (widths: StockColumnWidths) => widths

// 모든 시장·모드의 STOCK 표. editor가 null이면 읽기 전용이라 체크·편집이 잠긴다.
export default function StockTable({ rows, columns, editor, slots, arrangeWidths = identity, marketValueTime, industryProtected, levelSortKey, extras }: {
  rows: readonly StockRow[]
  columns: readonly StockColumn[]
  editor: StockTableEditor | null
  slots: SheetSlots
  arrangeWidths?: (widths: StockColumnWidths) => StockColumnWidths
  // 시가총액 머리글에 올리면 보이는 기준 시각.
  marketValueTime: string | null
  industryProtected?: (value: string) => boolean
  // 대·중·소분류에 값이 없는 모드에서 그 머리글을 누르면 대신 정렬할 열.
  levelSortKey?: StockColumnKey
  // 이 시장에만 있는 편집 항목(엑셀·초기화 등).
  extras?: (context: { rows: readonly StockRow[]; pushHistory: (action: Omit<StockHistoryAction, 'id'>) => void; clearHistory: () => void }) => ReactNode
}) {
  const [query, setQuery] = useState('')
  // null이면 처음 순서(시가총액이 큰 순서)다.
  const [customSort, setCustomSort] = useState<{ key: StockColumnKey; direction: 'asc' | 'desc' } | null>(null)
  const pressedKey = customSort?.key ?? 'totalMarketValue'
  const sortKey = levelSortKey && LEVELS.some(level => level.key === pressedKey) ? levelSortKey : pressedKey
  const direction = customSort?.direction ?? 'desc'
  const [isPending, startTransition] = useTransition()
  const [timeTooltip, setTimeTooltip] = useState<{ left: number; top: number } | null>(null)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  // 분류 필터와 업종 선택 목록의 보기 순서(브라우저에 저장).
  const [orderMode, setOrderMode] = useState<'alpha' | 'cap'>(() => (readSettingStorage(ORDER_STORAGE) === 'cap' ? 'cap' : 'alpha'))
  const changeOrderMode = useCallback((value: 'alpha' | 'cap') => {
    writeSettingStorage(ORDER_STORAGE, value)
    setOrderMode(value)
  }, [])
  const orderControl = { value: orderMode, onChange: changeOrderMode }
  const sectors = editor?.sectors
  const sectorStats = editor?.sectorStats
  const sectorOptions = useMemo(() => buildSectorOptions(sectors ?? []), [sectors])
  const sectorById = useMemo(() => new Map(sectorOptions.map(option => [option.id, option])), [sectorOptions])

  // 검색 — 이름·코드·둘째 이름·분류명을 대소문자·공백 무시와 초성으로 찾는다.
  const trimmed = query.trim()
  const searched = useMemo(() => (trimmed ? rows.filter(createStockMatcher<StockRow>(trimmed, row => ({
    name: row.name, code: row.code, alias: row.alias, labels: [row.cells.industry ?? null, ...row.path, row.searchLabel ?? null],
  }))) : rows), [rows, trimmed])
  const filterValueOf = useCallback((row: StockRow, key: StockFilterKey): string => {
    const level = LEVELS.findIndex(item => item.key === key)
    return (level >= 0 ? row.path[level] : row.cells[key]) || '-'
  }, [])
  const filters = useStockColumnFilters(searched, filterValueOf)

  // 방금 바꾼 종목은 필터 조건에서 벗어나도 선택을 모두 풀기 전까지 표에 남겨, 이어서 아래 단계를 정할 수 있게 한다.
  const [pinnedCodes, setPinnedCodes] = useState<ReadonlySet<string>>(new Set())
  const [bulkParentId, setBulkParentId] = useState<number | null>(null)
  const [bulkMidId, setBulkMidId] = useState<number | null>(null)
  const changeSelected = useCallback((next: ReadonlySet<string> | ((previous: ReadonlySet<string>) => ReadonlySet<string>)) => setSelected(next), [])
  useEffect(() => {
    if (selected.size > 0) return
    // 선택이 전부 풀리면(새 작업 시작) 이어 하던 상태를 비운다
    setBulkParentId(null)
    setBulkMidId(null)
    setPinnedCodes(previous => (previous.size === 0 ? previous : new Set()))
  }, [selected])
  const filtered = useMemo(() => {
    if (pinnedCodes.size === 0) return filters.filteredRows
    const matched = new Set(filters.filteredRows.map(row => row.code))
    const kept = searched.filter(row => pinnedCodes.has(row.code) && !matched.has(row.code))
    return kept.length === 0 ? filters.filteredRows : [...filters.filteredRows, ...kept]
  }, [filters.filteredRows, pinnedCodes, searched])
  // 화면에서 사라진 종목은 선택도 해제한다 — 안 보이는 종목이 일괄 변경에 딸려 들어가지 않게 한다.
  useEffect(() => {
    const visible = new Set(filtered.map(row => row.code))
    // 다시 보여도 선택되지 않게 선택 자체를 지운다
    setSelected(previous => {
      const next = new Set([...previous].filter(code => visible.has(code)))
      return next.size === previous.size ? previous : next
    })
  }, [filtered])

  // 같은 값끼리는 방향과 상관없이 시가총액이 큰 종목이 위에 온다.
  const sorted = useMemo(() => {
    const column = columns.find(item => item.key === sortKey)
    const level = LEVELS.findIndex(item => item.key === sortKey)
    const textOf = (row: StockRow) => (level >= 0 ? row.path[level] : column?.text(row) ?? '')
    const byValue = level < 0 && column?.sort !== 'text'
    const sign = direction === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const value = (a.marketValue ?? -Infinity) - (b.marketValue ?? -Infinity)
      const diff = byValue ? value : compareKoreanText(textOf(a), textOf(b))
      return diff !== 0 ? sign * diff : -value || compareKoreanText(a.code, b.code)
    })
  }, [filtered, columns, sortKey, direction])
  // 같은 열을 계속 누르면 오름차순 → 내림차순 → 처음 순서로 돈다.
  const toggleSort = (key: StockColumnKey) => startTransition(() => {
    if (key !== pressedKey || customSort === null) setCustomSort({ key, direction: 'asc' })
    else if (customSort.direction === 'asc') setCustomSort({ key, direction: 'desc' })
    else setCustomSort(null)
  })
  useReportCountLabel(formatStockCountLabel(sorted.length, rows.length), slots.setCountLabel)

  // 분류 필터의 시가총액 순 보기.
  const filterOrder = useMemo(() => {
    const keys: StockFilterKey[] = ['industry', 'parentSector', 'midSector', 'subSector']
    const totals = new Map(keys.map(key => [key, new Map<string, number>()]))
    for (const row of rows) for (const key of keys) {
      const name = filterValueOf(row, key)
      if (name !== '-') totals.get(key)?.set(name, (totals.get(key)?.get(name) ?? 0) + (row.marketValue ?? 0))
    }
    const order = new Map<StockFilterKey, readonly string[]>([...totals].map(([key, byName]) => [key, [...byName].sort(([nameA, a], [nameB, b]) => b - a || compareKoreanText(nameA, nameB)).map(([name]) => name)]))
    // 업종 트리를 알면 상위 업종 순서를 따라 펼친다.
    if (sectors && sectorStats) sectorNamesByDepth([...sectors], sectorStats).forEach((names, level) => order.set(LEVELS[level].key, names))
    return order
  }, [rows, filterValueOf, sectors, sectorStats])
  const parentHints = useMemo(() => buildSectorParentHints(sectors
    ? sectorOptions.map(option => { const chain = resolveSectorChain(sectorById, option.id); return [chain.rootName, chain.midName, chain.leafName].filter((name): name is string => name !== null) })
    : rows.map(row => row.path.filter(name => name !== '-'))), [sectors, sectorOptions, sectorById, rows])
  const filterButton = (key: StockFilterKey, label: string, order?: readonly string[], isProtected?: (value: string) => boolean) => (
    <ColumnFilterButton
      label={label}
      isProtected={isProtected}
      getOptions={() => filters.optionValues(key)}
      excluded={filters.excluded[key] ?? NO_EXCLUDED}
      onToggle={value => filters.toggle(key, value)}
      onSelectAll={() => filters.selectAll(key)}
      onSelectNone={values => filters.selectNone(key, values)}
      selectOnlyOnSearch={isClassificationFilter(key)}
      hintOf={key === 'midSector' || key === 'subSector' ? value => parentHints[key].get(value) : undefined}
      optionOrder={order ?? filterOrder.get(key)}
      orderMode={isClassificationFilter(key) ? orderControl : undefined}
    />
  )

  // 변경 내역(실행 취소·다시 실행). 이 표에 머무는 동안만 기억한다.
  const [undoStack, setUndoStack] = useState<StockHistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<StockHistoryAction[]>([])
  const historyId = useRef(0)
  const pushHistory = (action: Omit<StockHistoryAction, 'id'>) => {
    setUndoStack(previous => [...previous.slice(-HISTORY_LIMIT + 1), { ...action, id: String(historyId.current++) }])
    setRedoStack([])
  }
  const clearHistory = () => { setUndoStack([]); setRedoStack([]) }
  // 항목을 고르면 맨 위(다음 차례)부터 그 항목까지 한 단계씩 차례로 처리해 값이 꼬이지 않게 한다.
  const runHistory = async (kind: 'undo' | 'redo', id?: string) => {
    const from = kind === 'undo' ? undoStack : redoStack
    const index = id === undefined ? from.length - 1 : from.findIndex(action => action.id === id)
    if (index < 0 || !editor) return
    const applied = from.slice(index).reverse()
    for (const action of applied) {
      const done = await editor.restore(action.entries.map(entry => ({ code: entry.code, sectorId: kind === 'undo' ? entry.before : action.after })))
      if (!done) return
      const move = (previous: StockHistoryAction[]) => previous.filter(item => item.id !== action.id)
      if (kind === 'undo') { setUndoStack(move); setRedoStack(previous => [...previous, action]) }
      else { setRedoStack(move); setUndoStack(previous => [...previous, action]) }
    }
  }
  const runHistoryRef = useRef(runHistory)
  useEffect(() => { runHistoryRef.current = runHistory })
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      // 입력창 안에서는 글자 되돌리기에 맡긴다.
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable || !(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault()
      void runHistoryRef.current(key === 'y' || event.shiftKey ? 'redo' : 'undo')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
  const sectorLabel = (id: number) => sectorById.get(id)?.name ?? '(알 수 없음)'
  const describe = (action: StockHistoryAction) => action.entries.length === 1
    ? `${rows.find(row => row.code === action.entries[0].code)?.name ?? action.entries[0].code}\n[${sectorLabel(action.entries[0].before)}] → [${action.afterLabel}]`
    : `${action.entries.length}개 종목\n→ [${action.afterLabel}]`
  const beforeOf = (row: StockRow | undefined) => row?.sectorId ?? editor?.unassignedId ?? null

  const assignOne = (row: StockRow, sectorId: number) => {
    if (!editor) return
    const before = beforeOf(row)
    const chain = resolveSectorChain(sectorById, sectorId)
    const names = [chain.rootName, chain.midName ?? '-', chain.leafName ?? '-']
    const leavesFilter = LEVELS.some((level, index) => filters.excluded[level.key]?.has(names[index]))
    void editor.assign(row.code, sectorId).then(() => {
      if (before !== null && before !== sectorId) pushHistory({ after: sectorId, afterLabel: sectorLabel(sectorId), entries: [{ code: row.code, before }] })
      if (!leavesFilter || before === sectorId) return
      if (selected.has(row.code)) setPinnedCodes(previous => new Set([...previous, row.code]))
      else {
        // 선택하지 않은 줄이면 이전 선택 대신 이 줄만 선택한다.
        setSelected(new Set([row.code]))
        setPinnedCodes(new Set([row.code]))
        setBulkParentId(null)
        setBulkMidId(null)
      }
    }, () => undefined)
  }
  const assignSelected = (sectorId: number, onDone?: () => void) => {
    if (!editor) return
    const codes = [...selected]
    // 필터에서 빠지더라도 표에 남겨 둔다. 분류가 바뀌기 전에 표시해야 필터 갱신 때 선택이 풀리지 않는다.
    setPinnedCodes(previous => new Set([...previous, ...codes]))
    const beforeByCode = new Map(codes.map(code => [code, beforeOf(rows.find(row => row.code === code))]))
    void editor.assignMany(codes, sectorId).then(({ failed }) => {
      onDone?.()
      const name = sectorById.get(sectorId)?.name ?? ''
      const entries = codes.flatMap(code => { const before = beforeByCode.get(code) ?? null; return failed.includes(code) || before === null || before === sectorId ? [] : [{ code, before }] })
      if (entries.length > 0) pushHistory({ after: sectorId, afterLabel: name, entries })
      if (failed.length === 0) void appAlert(`[${name}]\n일괄 적용 완료되었습니다.`, { title: '일괄 변경 완료' })
      else void appAlert(`[${name}]\n다음 종목은 반영되지 않았습니다:\n${failed.join(', ')}`, { title: '일괄 변경 실패' })
    }, () => undefined)
  }
  // 선택한 종목의 대분류(중분류)가 모두 같으면 그 아래를 바로 일괄 변경한다. 다르면 위 단계를 먼저 일괄 적용한 값을 쓴다.
  const commonChain = useMemo(() => {
    const chains = rows.filter(row => selected.has(row.code)).map(row => ({ ...resolveSectorChain(sectorById, row.sectorId), sectorId: row.sectorId }))
    const common = (key: 'rootId' | 'midId' | 'sectorId') => (chains.length > 0 && chains.every(chain => chain[key] === chains[0][key]) ? chains[0][key] : null)
    return { rootId: common('rootId'), midId: common('midId'), leafId: common('sectorId') }
  }, [rows, selected, sectorById])
  const parentId = commonChain.rootId ?? bulkParentId
  const midId = commonChain.midId ?? bulkMidId
  const arrange = (options: SectorOption[]) => (orderMode === 'alpha' || !sectorStats ? options : sortByMarketValue(options, sectorStats))
  const childrenOf = (id: number | null) => arrange(sectorOptions.filter(option => option.parentId === id)).map(option => ({ ...option, label: option.name }))
  // 거래 정지 업종은 서버만 종목을 넣으므로 뺀다. 보호 업종은 늘 맨 아래에 둔다.
  const rootOptions = placeProtectedSectorsLast(childrenOf(null).filter(option => !isSuspendedSectorName(option.name)), option => option.name)

  const isAllSelected = sorted.length > 0 && sorted.every(row => selected.has(row.code))
  const toggleAll = () => setSelected(previous => {
    const next = new Set(previous)
    for (const row of sorted) { if (isAllSelected) next.delete(row.code); else next.add(row.code) }
    return next
  })

  // 종목이 수천 개라 화면에 보이는 줄(+위아래 여유)만 그리고 나머지 높이는 앞뒤 빈 줄로 채운다.
  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedColumns = useMemo(() => pinnedStockColumns(filters.excluded), [filters.excluded])
  const baseWidths = useStockColumnWidths(scrollRef, pinnedColumns)
  const widths = useMemo(() => arrangeWidths(baseWidths), [arrangeWidths, baseWidths])
  const widthKeys = useMemo(() => [...columns.flatMap(column => [column.key, ...(column.spans ?? [])]), ...LEVELS.map(level => level.key)], [columns])
  const shownColumns = columns.filter(column => widths[column.key] !== undefined)
  const colSpanOf = (column: StockColumn) => 1 + (column.spans ?? []).filter(key => widths[key] !== undefined).length
  const tableColSpan = 1 + widthKeys.filter(key => widths[key] !== undefined).length
  const { rowProps, selectionHint } = useRowRangeSelection(useMemo(() => sorted.map(row => row.code), [sorted]), scrollRef, selected, changeSelected)
  // eslint-disable-next-line react-hooks/incompatible-library -- 가상화 라이브러리의 함수는 메모하지 못한다는 경고
  const virtualizer = useVirtualizer({ count: sorted.length, getScrollElement: () => scrollRef.current, estimateSize: () => STOCK_ROW_PX, overscan: 15 })
  const virtualRows = virtualizer.getVirtualItems()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const paddingBottom = virtualRows.length > 0 ? virtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }) }, [trimmed, sortKey, direction])

  const sortHeader = (key: StockColumnKey, header: string, filter?: ReactNode) => <StockSortHeader label={header} state={sortKey === key ? direction : null} onSort={() => toggleSort(key)} filter={filter} />
  const headerClass = 'whitespace-nowrap bg-[var(--ui-panel)] text-center align-middle font-bold text-ui-white'
  const spacer = (height: number) => height > 0 && <tr><td colSpan={tableColSpan} style={{ height, padding: 0, border: 'none' }} /></tr>
  const bulkButtons = [
    { label: '대분류', options: rootOptions, current: commonChain.rootId, disabled: false, hint: undefined, onAssign: (id: number) => assignSelected(id, () => { setBulkParentId(id); setBulkMidId(null) }) },
    { label: '중분류', options: parentId === null ? [] : childrenOf(parentId), current: commonChain.midId, disabled: parentId === null, hint: '선택한 종목의 대분류가 같아야 합니다.\n다르면 대분류를 먼저 일괄적용해 주세요', onAssign: (id: number) => assignSelected(id, () => setBulkMidId(id)) },
    { label: '소분류', options: midId === null ? [] : childrenOf(midId), current: commonChain.leafId, disabled: midId === null, hint: '선택한 종목의 중분류가 같아야 합니다.\n다르면 중분류를 먼저 일괄적용해 주세요', onAssign: (id: number) => assignSelected(id) },
  ]

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {slots.toolbar && createPortal(
        <div className="flex h-full min-h-0 w-full items-center gap-2">
          <SearchBar
            inline
            query={query}
            onChange={setQuery}
            placeholder="검색"
            ariaLabel="종목 검색"
            maxLength={STOCK_SEARCH_MAX_LENGTH}
            afterInput={filters.activeCount > 0 ? (
              <button type="button" onClick={filters.clearAll} className="toolbar-badge flex h-6 items-center gap-1 whitespace-nowrap rounded border border-ui-border bg-transparent px-2 text-sm font-normal text-ui-text transition-colors hover:border-[var(--brand)] hover:text-[var(--brand)]">
                <FunnelIcon className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]" />
                필터 초기화
              </button>
            ) : null}
          />
        </div>,
        slots.toolbar,
      )}
      {editor && slots.history && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">변경 내역</h2>
          <ChangeHistoryControls undoStack={undoStack} redoStack={redoStack} describe={describe} onUndo={() => void runHistory('undo')} onRedo={() => void runHistory('redo')} onUndoItem={id => void runHistory('undo', id)} onRedoItem={id => void runHistory('redo', id)} />
        </div>,
        slots.history,
      )}
      {editor && slots.bulk && createPortal(
        <div className="settings-custom-control">
          <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">일괄 변경</h2>
          <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">{selected.size > 0 ? `선택한 종목 ${selected.size}개의 분류를 한 번에 바꿉니다` : '표에서 종목을 먼저 선택해 주세요'}</p>
          <div className="grid max-w-full settings-control-inset grid-cols-3 gap-[6px]">
            {bulkButtons.map(button => <BulkAssignButton key={button.label} count={selected.size} options={button.options} onAssign={button.onAssign} label={button.label} title="일괄 변경" orderMode={orderControl} currentSectorId={button.current} disabled={button.disabled} disabledHint={button.hint} />)}
          </div>
        </div>,
        slots.bulk,
      )}
      {extras?.({ rows: sorted, pushHistory, clearHistory })}
      <div className="relative min-h-0 flex-1 border border-ui-border">
        {selectionHint.isOpen && <SelectionHintBubble onClose={selectionHint.close} />}
        <ScrollArea overlay viewportRef={scrollRef} scrollLabel="종목 목록" className="h-full">
          {/* 줄 드래그 선택과 겹치지 않게 표 글자는 선택되지 않는다(입력창 안의 글자는 된다). */}
          <table style={{ minWidth: stockColumnWidthsTotal(widths) }} className="nes-table is-dark custom-page-table w-full table-fixed select-none text-sm [&_input]:select-text [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:py-1">
            <StockTableColGroup keys={widthKeys} widths={widths} />
            <thead className="sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--ui-border)]">
              <tr style={{ height: STOCK_HEADER_ROW_PX }}>
                <th
                  className={`bg-[var(--ui-panel)] px-0 text-center font-bold text-ui-white ${editor ? 'cursor-pointer' : ''}`}
                  style={CHECKBOX_CELL_STYLE}
                  // 체크박스를 누른 경우는 onChange가 이미 처리한다.
                  onClick={event => { if (editor && (event.target as HTMLElement).tagName !== 'INPUT') toggleAll() }}
                >
                  <input type="checkbox" aria-label="보이는 종목 전체 선택" className="mx-auto my-0 block thin-check" checked={isAllSelected} disabled={!editor} onChange={toggleAll} />
                </th>
                {shownColumns.map(column => (
                  <th key={column.key} data-column-key={column.key} colSpan={colSpanOf(column)} className={headerClass} data-hint={column.headerHint}>
                    {column.key === 'totalMarketValue' && marketValueTime !== null ? (
                      <span
                        onMouseEnter={event => { const rect = event.currentTarget.getBoundingClientRect(); setTimeTooltip({ left: rect.left + rect.width / 2, top: rect.top }) }}
                        onMouseLeave={() => setTimeTooltip(null)}
                      >
                        {sortHeader(column.key, column.header)}
                        {timeTooltip && createPortal(
                          <div className={`fixed z-50 w-max -translate-x-1/2 -translate-y-full ${HINT_BUBBLE_CLASS}`} style={{ left: timeTooltip.left, top: timeTooltip.top - 4 }}>
                            {toSnapshotDateLabel(marketValueTime)} {toSnapshotTimeOnlyLabel(marketValueTime)}
                          </div>,
                          document.body,
                        )}
                      </span>
                    ) : sortHeader(column.key, column.header, column.filter ? filterButton(column.filter.key, column.header, column.filter.order, column.filter.isProtected ?? (column.filter.key === 'industry' ? industryProtected : undefined)) : undefined)}
                  </th>
                ))}
                {LEVELS.map(level => <th key={level.key} data-column-key={level.key} className={headerClass}>{sortHeader(level.key, level.header, filterButton(level.key, level.header, undefined, level.key === 'parentSector' ? isProtectedSectorName : undefined))}</th>)}
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                <tr><td colSpan={tableColSpan} className="p-8"><div className="flex h-[min(32rem,60vh)] items-center justify-center"><Spinner delayReveal showElapsed /></div></td></tr>
              ) : (
                <>
                  {spacer(paddingTop)}
                  {virtualRows.map(virtualRow => {
                    const row = sorted[virtualRow.index]
                    return <StockTableRow key={row.code} row={row} columns={shownColumns} colSpanOf={colSpanOf} isSelected={selected.has(row.code)} rowProps={editor ? rowProps(virtualRow.index) : null} editor={editor} chain={resolveSectorChain(sectorById, row.sectorId)} rootOptions={rootOptions} childrenOf={childrenOf} orderMode={orderControl} onAssign={id => assignOne(row, id)} />
                  })}
                  {spacer(paddingBottom)}
                </>
              )}
            </tbody>
          </table>
          {!isPending && sorted.length === 0 && <EmptyMessage message={rows.length === 0 ? EMPTY_DATA_MESSAGE : EMPTY_SEARCH_MESSAGE} />}
        </ScrollArea>
      </div>
    </div>
  )
}

// 한 종목. 줄에 올리면 옅게, 고칠 수 있는 칸에 올리면 그 칸만 진하게 칠한다. 고치는 동안에는 강조를 유지한다.
function StockTableRow({ row, columns, colSpanOf, isSelected, rowProps, editor, chain, rootOptions, childrenOf, orderMode, onAssign }: {
  row: StockRow
  columns: readonly StockColumn[]
  colSpanOf: (column: StockColumn) => number
  isSelected: boolean
  rowProps: ReturnType<ReturnType<typeof useRowRangeSelection>['rowProps']> | null
  editor: StockTableEditor | null
  chain: ReturnType<typeof resolveSectorChain>
  rootOptions: SectorOption[]
  childrenOf: (id: number | null) => SectorOption[]
  orderMode: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
  onAssign: (sectorId: number) => void
}) {
  const [isRowHovered, setIsRowHovered] = useState(false)
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)
  const [editingCells, setEditingCells] = useState<ReadonlySet<string>>(new Set())
  const setCellEditing = (key: string, editing: boolean) => setEditingCells(previous => {
    const next = new Set(previous)
    if (editing) next.add(key)
    else next.delete(key)
    return next
  })
  const isActive = isRowHovered || editingCells.size > 0
  const selectedClass = isRowHovered ? 'bg-[var(--brand)]/35 border-ui-white/20!' : 'bg-[var(--brand)]/20 border-ui-white/20!'
  const plainClass = isSelected ? selectedClass : isActive ? 'bg-[var(--brand)]/10 border-ui-white/20!' : ''
  const editableClass = isSelected ? selectedClass : isActive ? 'bg-[var(--brand)]/20 border-ui-white/20!' : ''
  const isSuspended = isSuspendedSectorName(chain.rootName)
  const cellProps = (key: string) => ({
    isHighlighted: hoveredCell === key,
    rowHoverClass: editableClass,
    onHoverStart: () => setHoveredCell(key),
    onHoverEnd: () => setHoveredCell(null),
    onEditingChange: (editing: boolean) => setCellEditing(key, editing),
  })
  const levels = [
    { key: 'sector1', current: chain.rootId, options: rootOptions, context: '대분류 전체 목록', disabled: isSuspended },
    { key: 'sector2', current: chain.midId, options: chain.rootId === null ? [] : childrenOf(chain.rootId), context: `[${chain.rootName}] 하위 목록`, disabled: isSuspended },
    { key: 'sector3', current: row.sectorId, options: chain.midId === null ? [] : childrenOf(chain.midId), context: chain.midName ? `[${chain.midName}] 하위 목록` : undefined, disabled: chain.midId === null || isSuspended },
  ]
  return (
    <tr {...rowProps} className={rowProps ? 'cursor-pointer' : undefined} onMouseEnter={() => setIsRowHovered(true)} onMouseLeave={() => setIsRowHovered(false)}>
      <td className={`text-center ${plainClass}`} style={CHECKBOX_CELL_STYLE}>
        {/* 상태 변경은 줄을 누를 때 한다. onChange는 제어되는 체크박스에 필요한 자리표시다. */}
        <input type="checkbox" aria-label={`${row.name} 선택`} className="mx-auto my-0 block thin-check" checked={isSelected} disabled={!editor} onChange={() => {}} />
      </td>
      {columns.map(column => column.isNameEdit && editor?.nameEdit ? (
        <NameCell key={column.key} value={row.alias} label={editor.nameEdit.label(row)} maxLength={editor.nameEdit.maxLength} onSubmit={value => editor.nameEdit?.submit(row, value)} {...cellProps('name')} />
      ) : (
        <td key={column.key} colSpan={colSpanOf(column)} data-hint={column.cellHint ? column.text(row) : undefined} className={`${ALIGN_CLASS[column.align]} ${column.accent && row.accent ? 'text-[var(--brand)]' : 'text-ui-muted'} ${plainClass}`}>{column.text(row)}</td>
      ))}
      {levels.map((level, index) => editor ? (
        <StockSectorCell key={level.key} value={row.path[index]} currentSectorId={level.current} options={level.options} onAssign={onAssign} {...cellProps(level.key)} rowHoverClass={level.disabled && index === 2 ? plainClass : editableClass} contextLabel={level.context} disabled={level.disabled} disabledHint={isSuspended ? SUSPENDED_STOCK_HINT : '중분류를 먼저 지정해 주세요'} title="개별 변경" orderMode={orderMode} />
      ) : <td key={level.key} className={`${ALIGN_CLASS.left} text-ui-muted ${plainClass}`}>{row.path[index]}</td>)}
    </tr>
  )
}

// 고칠 수 있는 이름 칸. 누르면 입력창이 되고 Enter로 저장, Escape로 취소한다.
function NameCell({ value, label, maxLength, onSubmit, isHighlighted, rowHoverClass, onHoverStart, onHoverEnd, onEditingChange }: {
  value: string | null
  label: string
  maxLength: number
  onSubmit: (value: string | null) => void
  isHighlighted: boolean
  rowHoverClass: string
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingChange: (editing: boolean) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const stop = () => { setDraft(null); onEditingChange(false) }
  const submit = () => {
    const next = draft?.trim() || null
    stop()
    if (next !== value) onSubmit(next)
  }
  if (draft !== null) {
    return (
      <td className={`px-1 text-left ${rowHoverClass}`} data-no-row-select onClick={event => event.stopPropagation()}>
        <input
          type="text"
          autoFocus
          aria-label={label}
          value={draft}
          maxLength={maxLength}
          // 한글 조합 중에 최대 글자 수를 넘는 한 글자가 잠깐 들어오므로 바로 잘라 낸다.
          onChange={event => setDraft(event.target.value.slice(0, maxLength))}
          onBlur={stop}
          onKeyDown={event => {
            // 한글 조합 중의 엔터는 글자를 확정할 뿐이라 저장으로 넘기지 않는다.
            if (event.nativeEvent.isComposing || event.keyCode === 229) return
            if (event.key === 'Enter') submit()
            if (event.key === 'Escape') stop()
          }}
          className="nes-input is-dark block h-5 w-full rounded-md border-0 bg-[var(--ui-panel)] px-1 text-left text-sm text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
        />
      </td>
    )
  }
  return (
    <td
      className={`cursor-pointer ${ALIGN_CLASS.left} text-ui-white ${isHighlighted ? 'bg-[var(--brand)]/35' : rowHoverClass}`}
      data-no-row-select
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={event => { event.stopPropagation(); setDraft(value ?? ''); onEditingChange(true); onHoverEnd() }}
    >
      {value ?? '-'}
    </td>
  )
}
