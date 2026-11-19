import MainAreaLoading from '@/components/MainAreaLoading'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import ChangeHistoryControls from '@/components/ChangeHistoryControls'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import OverseasPublishControls from '@/components/OverseasPublishControls'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { customMenu } from '@/utils/marketMenu'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import ScrollArea from '@/components/ScrollArea'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import ToolbarModeText from '@/components/ToolbarModeText'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useSession } from '@/hooks/useSession'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { isAdminSession } from '@/utils/adminAccess'
import type { OverseasStockSource } from '@/hooks/overseasStockSource'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useRowRangeSelection } from '@/hooks/useRowRangeSelection'
import SelectionHintBubble from '@/components/SelectionHintBubble'
import { STOCK_HEADER_ROW_PX, stockColumnWidthsForJapan, stockColumnWidthsTotal, type StockColumnKey } from '@/utils/stockTableColumns'
import StockTableColGroup from '@/components/StockTableColGroup'
import { useStockColumnWidths } from '@/hooks/useStockColumnWidths'
import EmptyMessage, { EMPTY_SEARCH_MESSAGE } from '@/components/EmptyMessage'
import Spinner from '@/components/Spinner'
import ScreenshotModal from '@/components/ScreenshotModal'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import StockSortHeader from '@/components/StockSortHeader'
import ColumnFilterButton from '@/components/ColumnFilterButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import { appAlert } from '@/utils/appDialogBus'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import { AdminStockSectorCell, BulkAssignButton } from '@/components/AdminStockTable'
import { STOCK_SEARCH_MAX_LENGTH, createStockMatcher } from '@/utils/stockSearch'
import { toJoEokDecimal } from '@/utils/format'
import { compareKoreanText } from '@/utils/koreanSort'
import { buildSectorParentHints } from '@/utils/sectorFilterHints'
import { isProtectedSectorName } from '@/utils/protectedSector'
import { yahooSectorKo } from '@/utils/yahooSector'
import { overseasMarketInfo } from '@/utils/markets'

type ClassificationField = 'sector' | 'industry' | 'subIndustry'
type SortKey = 'code' | 'name' | 'englishName' | 'marketCap' | 'marketCapKrw' | 'sector' | 'customSector' | 'customIndustry' | 'customSubIndustry'
type FilterKey = 'sector' | 'customSector' | 'customIndustry' | 'customSubIndustry'
type Category = { id: number; parentId: number | null; name: string }
// 변경 내역 한 건 — 한 번의 배정(종목 하나 또는 일괄)과 종목마다의 이전 분류 이름(대분류부터, 없으면 빈 배열).
type HistoryAction = { id: string; entries: { code: string; before: string[] }[]; afterCategoryId: number; afterLabel: string }
// 열 키 이름은 폭 자리만 뜻한다: industry=야후 분류(국내 거래소 분류 자리), totalMarketValueKrw=시가총액(₩)(국내 규모+마켓 자리), parentSector·midSector·subSector=대·중·소분류.
// 국내: 종목코드 | 종목명 | 약칭 | 시가총액 | 규모 | 마켓 | NXT | 거래소 분류 | 대분류 | 중분류 | 소분류
// 일본: 종목코드 | 종목명 (영어) | 종목명 (한글) | 시가총액(¥) | 시가총액(₩) | 야후 분류 | 대분류 | 중분류 | 소분류
// 칸 폭은 국내 표의 좌표를 그대로 따른다(stockColumnWidthsForJapan). 국내 규모·마켓 묶음은 일본·미국 시가총액(₩)과, 국내 거래소 분류는 일본 야후 분류·미국 GICS 분류와 같은 칸이다.
// 일본 표의 열 이름(SortKey)이 국내 폭 표의 어느 열 자리인지 — 폭 표에 키가 없으면 좁은 창에서 숨긴 열이다.
const WIDTH_KEY_BY_SORT_KEY: Record<SortKey, StockColumnKey> = { code: 'stockCode', englishName: 'stockName', name: 'alias', marketCap: 'totalMarketValue', marketCapKrw: 'totalMarketValueKrw', sector: 'industry', customSector: 'parentSector', customIndustry: 'midSector', customSubIndustry: 'subSector' }
const COLUMN_WIDTH_KEYS: readonly StockColumnKey[] = ['stockCode', 'stockName', 'alias', 'totalMarketValue', 'totalMarketValueKrw', 'industry', 'parentSector', 'midSector', 'subSector']

export default function OverseasStockView({ source }: { source: OverseasStockSource }) {
  // 시장마다 다른 부분(종목 목록·시세·통화 단위와 환산·분류 열 이름·안내 문구)은 source로 받고, 분류 데이터 주소와 화면 구성은 모든 해외 시장이 같다.
  const { market, stocks, quotes: quotesQuery, unit, sectorColumnLabel, searchAriaLabel, tabStorageName } = source
  const { routeSegment, badgeLabel } = overseasMarketInfo(market)
  const NAMES_QUERY_KEY = [routeSegment, 'names'] as const
  const { data: session } = useSession()
  // MARKETRY 모드는 운영자가 제시하는 기준이라 모든 항목(종목명 한글·분류)이 수정 불가이고, 관리자는 내 기준 모드에서만 고친다.
  const isAdmin = isAdminSession(session)
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const canEdit = isAdmin && sheet === 'MINE'
  const queryClient = useQueryClient()
  const namesQuery = useQuery({ queryKey: NAMES_QUERY_KEY, queryFn: async () => (await client.get<Record<string, string>>(`/${routeSegment}/stock-names`)).data })
  const saveName = useMutation({ mutationFn: async ({ code, name }: { code: string; name: string }) => { await client.put(`/admin/${routeSegment}-stock-names/${code}`, { name }) }, onSuccess: () => queryClient.invalidateQueries({ queryKey: NAMES_QUERY_KEY }) })
  const { categories: categoryQuery, classifications: classificationsQuery, editBase, invalidate: invalidateClassification } = useOverseasClassificationData(market, sheet)
  const assignClassification = useMutation({ mutationFn: async ({ codes, categoryId }: { codes: string[]; categoryId: number }) => { await client.put(`${editBase}/assign`, { stockCodes: codes, categoryId }) }, onSuccess: invalidateClassification })
  const [orderMode, setOrderMode] = useState<'alpha' | 'cap'>('alpha')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'marketCap', direction: 'desc' })
  const [excluded, setExcluded] = useState<Record<FilterKey, Set<string>>>({ sector: new Set(), customSector: new Set(), customIndustry: new Set(), customSubIndustry: new Set() })
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  // 머리글 필터가 걸린 열은 좁은 창에서도 숨기지 않는다: 야후·GICS 분류(=국내 거래소 분류 자리) 필터가 걸리면 그 열을 남긴다.
  const pinnedColumns = useMemo<ReadonlySet<StockColumnKey>>(() => new Set<StockColumnKey>(excluded.sector.size > 0 ? ['industry' as const] : []), [excluded.sector])
  const koreanColumnWidths = useStockColumnWidths(tableContainerRef, pinnedColumns)
  const columnWidths = useMemo(() => stockColumnWidthsForJapan(koreanColumnWidths), [koreanColumnWidths])
  // 좁은 창에서 숨긴 열은 폭 표에 키가 없다(국내 표와 같은 규칙) — 머리글과 칸도 그 열을 그리지 않는다.
  const isColumnShown = (key: SortKey) => columnWidths[WIDTH_KEY_BY_SORT_KEY[key]] !== undefined
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const rows = useMemo(() => {
    const capByCode = new Map((quotesQuery.data?.quotes ?? []).map(quote => [quote.stockCode, quote.totalMarketValue / unit.perEok]))
    return stocks.map(stock => ({ ...stock, sector: yahooSectorKo(stock.sector), marketCapEok: capByCode.get(stock.code) ?? 0, name: namesQuery.data?.[stock.code] ?? stock.name, customSector: classificationsQuery.data?.[stock.code]?.sector ?? '', customIndustry: classificationsQuery.data?.[stock.code]?.industry ?? '', customSubIndustry: classificationsQuery.data?.[stock.code]?.subIndustry ?? '' }))
  }, [stocks, namesQuery.data, classificationsQuery.data, quotesQuery.data, unit.perEok])
  const filtered = useMemo(() => {
    const matcher = createStockMatcher(search, (stock: (typeof rows)[number]) => ({ code: stock.code, name: stock.englishName || '', alias: stock.name, labels: [stock.sector, stock.customSector, stock.customIndustry, stock.customSubIndustry] }))
    return rows.filter(stock => !excluded.sector.has(stock.sector || '-') && !excluded.customSector.has(stock.customSector || '-') && !excluded.customIndustry.has(stock.customIndustry || '-') && !excluded.customSubIndustry.has(stock.customSubIndustry || '-') && matcher(stock)).sort((a, b) => {
        const comparison = (sort.key === 'marketCap' || sort.key === 'marketCapKrw') ? a.marketCapEok - b.marketCapEok : (a[sort.key] || '').localeCompare(b[sort.key] || '', 'ko')
        return (sort.direction === 'asc' ? comparison : -comparison) || a.code.localeCompare(b.code)
      })
  }, [search, excluded, sort, rows])
  useEffect(() => {
    const visible = new Set(filtered.map(stock => stock.code))
    setSelected(previous => {
      const next = new Set([...previous].filter(code => visible.has(code)))
      return next.size === previous.size ? previous : next
    })
  }, [filtered])
  const { rowProps, selectionHint } = useRowRangeSelection(useMemo(() => filtered.map(stock => stock.code), [filtered]), tableContainerRef, selected, setSelected)
  const submitName = async (code: string, currentName: string) => {
    const name = draftName.trim()
    if (!name) { void appAlert('종목명 (한글)을 입력해 주세요.', { title: '종목명 (한글) 저장' }); return }
    if (name === currentName) { setEditingCode(null); return }
    const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase()
    const conflict = stocks.find(stock => stock.code !== code && normalize(namesQuery.data?.[stock.code] ?? stock.name) === normalize(name))
    if (conflict) { void appAlert(`다른 종목의 종목명 (한글)과 겹칩니다.\n겹치는 종목: ${conflict.code} ${namesQuery.data?.[conflict.code] ?? conflict.name}`, { title: '종목명 (한글) 저장' }); return }
    try { await saveName.mutateAsync({ code, name }); setEditingCode(null) }
    catch { void appAlert('종목명 (한글)을 저장하지 못했습니다. 다시 시도해 주세요.', { title: '종목명 (한글) 저장' }) }
  }
  const changeSort = (key: SortKey) => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
  const filterButton = (key: FilterKey, label: string) => <ColumnFilterButton label={label} getOptions={() => [...new Set(rows.map(stock => stock[key] || '-'))]} excluded={excluded[key]} onToggle={value => setExcluded(previous => {
    const next = new Set(previous[key])
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return { ...previous, [key]: next }
  })} onSelectAll={() => setExcluded(previous => ({ ...previous, [key]: new Set() }))} onSelectNone={values => setExcluded(previous => ({ ...previous, [key]: new Set(values) }))}
    selectOnlyOnSearch
    isProtected={key === 'customSector' ? isProtectedSectorName : undefined}
    hintOf={key === 'customIndustry' ? value => sectorParentHints.midSector.get(value) : key === 'customSubIndustry' ? value => sectorParentHints.subSector.get(value) : undefined}
    optionOrder={key === 'customSector' ? categoryChoices.levelOrder[0] : key === 'customIndustry' ? categoryChoices.levelOrder[1] : key === 'customSubIndustry' ? categoryChoices.levelOrder[2] : undefined}
    orderMode={key === 'customSector' || key === 'customIndustry' || key === 'customSubIndustry' ? { value: orderMode, onChange: setOrderMode } : undefined} />
  const columns: { key: SortKey; label: string; filter?: FilterKey }[] = [
    { key: 'code', label: '종목코드' }, { key: 'englishName', label: '종목명 (영어)' }, { key: 'name', label: '종목명 (한글)' }, { key: 'marketCap', label: `시가총액 (${unit.symbol})` }, { key: 'marketCapKrw', label: '시가총액 (₩)' }, { key: 'sector', label: sectorColumnLabel, filter: 'sector' }, { key: 'customSector', label: '대분류', filter: 'customSector' }, { key: 'customIndustry', label: '중분류', filter: 'customIndustry' }, { key: 'customSubIndustry', label: '소분류', filter: 'customSubIndustry' },
  ]
  const categoryChoices = useMemo(() => {
    const all = categoryQuery.data ?? []
    const totals = new Map<number, number>()
    const roots = all.filter(category => category.parentId === null)
    for (const row of rows) {
      const amount = row.marketCapEok
      let parentId: number | null = null
      for (const name of [row.customSector, row.customIndustry, row.customSubIndustry]) {
        const current = all.find(category => category.parentId === parentId && category.name === name)
        if (!current) break
        totals.set(current.id, (totals.get(current.id) ?? 0) + amount)
        parentId = current.id
      }
    }
    const sort = (list: Category[]) => list.sort((a, b) => {
      if (a.name === '미분류') return 1
      if (b.name === '미분류') return -1
      return (orderMode === 'cap' ? (totals.get(b.id) ?? 0) - (totals.get(a.id) ?? 0) : 0) || compareKoreanText(a.name, b.name)
    }).map(category => ({ ...category, label: category.name }))
    const parentOf = new Map(all.map(category => [category.id, category.parentId]))
    const depthOf = (category: Category) => { let depth = 0; let parent = parentOf.get(category.id) ?? null; while (parent !== null && depth < 3) { depth += 1; parent = parentOf.get(parent) ?? null } return depth }
    // 필터가 쓰는 단계별 전체 이름 순서 — 고른 보기 순서(가나다·시가총액)를 따른다.
    const levelOrder = [0, 1, 2].map(depth => sort(all.filter(category => depthOf(category) === depth)).map(category => category.name))
    return { all, roots: sort(roots), levelOrder, childrenOf: (parentId: number | undefined) => parentId === undefined ? [] : sort(all.filter(category => category.parentId === parentId)) }
  }, [categoryQuery.data, orderMode, rows])
  const sectorParentHints = useMemo(() => {
    const all = categoryQuery.data ?? []
    const byId = new Map(all.map(category => [category.id, category]))
    return buildSectorParentHints(all.map(category => {
      const path: string[] = []
      let current: Category | undefined = category
      while (current && path.length < 4) { path.unshift(current.name); current = current.parentId === null ? undefined : byId.get(current.parentId) }
      return path
    }))
  }, [categoryQuery.data])
  const findCategory = (name: string, parentId: number | null | undefined) => categoryChoices.all.find(category => category.parentId === parentId && category.name === name)
  const categoryOptions = (field: ClassificationField, sector = '', industry = '') => {
    const root = findCategory(sector, null)
    if (field === 'sector') return categoryChoices.roots
    if (field === 'industry') return categoryChoices.childrenOf(root?.id)
    return categoryChoices.childrenOf(findCategory(industry, root?.id)?.id)
  }
  // 변경 내역(실행 취소·다시 실행) — 한국 종목 탭과 같은 부품(ChangeHistoryControls). 종목마다 "이전 분류"를 기록해 두고, 되돌릴 때는 그 분류의 업종으로 다시 배정한다.
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([])
  const historyIdRef = useRef(0)
  const categoryById = (id: number) => categoryQuery.data?.find(category => category.id === id)
  const pathOfCategory = (id: number): string[] => {
    const path: string[] = []
    for (let current = categoryById(id); current; current = current.parentId === null ? undefined : categoryById(current.parentId)) path.unshift(current.name)
    return path
  }
  // 분류 이름은 시장 안에서 하나뿐이라 가장 깊은 이름으로 업종을 찾는다. 분류가 없던 종목은 미분류로 돌린다.
  const categoryIdOfPath = (path: string[]) => categoryQuery.data?.find(category => category.name === (path.at(-1) ?? '미분류'))?.id
  const describeAction = (action: HistoryAction) => action.entries.length === 1
    ? `${rows.find(row => row.code === action.entries[0].code)?.name ?? action.entries[0].code}\n[${action.entries[0].before.at(-1) ?? '-'}] → [${action.afterLabel}]`
    : `${action.entries.length}개 종목\n→ [${action.afterLabel}]`
  const applyAction = async (action: HistoryAction, direction: 'undo' | 'redo') => {
    if (direction === 'redo') { await assignClassification.mutateAsync({ codes: action.entries.map(entry => entry.code), categoryId: action.afterCategoryId }); return }
    const codesByCategory = new Map<number, string[]>()
    for (const entry of action.entries) {
      const categoryId = categoryIdOfPath(entry.before)
      if (categoryId === undefined) continue
      codesByCategory.set(categoryId, [...(codesByCategory.get(categoryId) ?? []), entry.code])
    }
    for (const [categoryId, codes] of codesByCategory) await assignClassification.mutateAsync({ codes, categoryId })
  }
  const runHistory = async (direction: 'undo' | 'redo', id?: string) => {
    const from = direction === 'undo' ? undoStack : redoStack
    const index = id === undefined ? from.length - 1 : from.findIndex(action => action.id === id)
    if (index < 0) return
    // 목록에서 항목을 고르면 맨 위(다음 차례)부터 그 항목까지 한 단계씩 순서대로 처리한다.
    const applied = from.slice(index).reverse()
    try {
      for (const action of applied) await applyAction(action, direction)
    } catch { void appAlert('변경을 되돌리지 못했습니다. 다시 시도해 주세요.', { title: '실행 취소 실패' }); return }
    if (direction === 'undo') { setUndoStack(previous => previous.slice(0, index)); setRedoStack(previous => [...previous, ...applied]) }
    else { setRedoStack(previous => previous.slice(0, index)); setUndoStack(previous => [...previous, ...applied]) }
  }
  const assignCategory = async (codes: string[], categoryId: number, bulk = false) => {
    const entries = codes.map(code => { const value = classificationsQuery.data?.[code]; return { code, before: [value?.sector, value?.industry, value?.subIndustry].filter((name): name is string => Boolean(name)) } })
    try {
      await assignClassification.mutateAsync({ codes, categoryId })
      const afterLabel = pathOfCategory(categoryId).at(-1) ?? ''
      setUndoStack(previous => [...previous.slice(-49), { id: String(historyIdRef.current++), entries, afterCategoryId: categoryId, afterLabel }])
      setRedoStack([])
      if (bulk) {
        void appAlert(`[${afterLabel}]\n일괄 적용 완료되었습니다.`, { title: '일괄 변경 완료' })
      }
    } catch { void appAlert('분류를 저장하지 못했습니다. 다시 시도해 주세요.', { title: bulk ? '일괄 변경 실패' : '분류 저장 실패' }) }
  }
  // 모드나 시장이 바뀌면 변경 내역은 비운다(다른 모드의 값과 섞이지 않게).
  useEffect(() => { setUndoStack([]); setRedoStack([]) }, [sheet, market])
  const classificationCell = (code: string, field: ClassificationField, value: string, sector: string, industry = '') => <AdminStockSectorCell value={value || '-'} options={categoryOptions(field, sector, industry)} onAssign={id => void assignCategory([code], id)} isHighlighted={false} rowHoverClass="hover:bg-[var(--brand)]/35" onHoverStart={() => {}} onHoverEnd={() => {}} onEditingChange={() => {}} contextLabel={field === 'industry' && sector ? `대분류: ${sector}` : field === 'subIndustry' && industry ? `중분류: ${industry}` : undefined} disabled={!canEdit || categoryQuery.isLoading || categoryQuery.isError || assignClassification.isPending || (field === 'industry' && !sector) || (field === 'subIndustry' && !industry)} disabledHint={field === 'subIndustry' ? '중분류를 먼저 지정해 주세요' : undefined} title={`${field === 'sector' ? '대분류' : field === 'industry' ? '중분류' : '소분류'} 개별 변경`} orderMode={{ value: orderMode, onChange: setOrderMode }} />
  const selectedSectors = new Set([...selected].map(code => rows.find(row => row.code === code)?.customSector || ''))
  const sharedSector = selectedSectors.size === 1 ? [...selectedSectors][0] : ''
  const selectedIndustries = new Set([...selected].map(code => rows.find(row => row.code === code)?.customIndustry || ''))
  const sharedIndustry = sharedSector && selectedIndustries.size === 1 ? [...selectedIndustries][0] : ''
  const allVisibleSelected = filtered.length > 0 && filtered.every(stock => selected.has(stock.code))
  const toggleVisible = () => setSelected(previous => {
    const next = new Set(previous)
    filtered.forEach(stock => allVisibleSelected ? next.delete(stock.code) : next.add(stock.code))
    return next
  })
  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }
  const isLoading = namesQuery.isLoading || classificationsQuery.isLoading || categoryQuery.isLoading || quotesQuery.isLoading
  const isError = namesQuery.isError || classificationsQuery.isError || categoryQuery.isError || quotesQuery.isError
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 flex-1 overflow-hidden bg-ui-background">
        <main ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="main-toolbar mt-[3px] mb-[8px] flex h-7 shrink-0 items-center gap-1 text-sm font-bold">
            <ToolbarModeText page="STOCK" label={badgeLabel} showChevron menu={customMenu('stock', market, true, sheet === 'MINE')} />
            <SearchBar inline query={search} onChange={setSearch} placeholder="검색" ariaLabel={searchAriaLabel} maxLength={STOCK_SEARCH_MAX_LENGTH} />
            <div className="min-w-0 flex-1" />
            <div className={`${FONT_BAR_MODE_STATUS} ml-2 flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy={sheet} /></div>
          </div>
          {isLoading || isError ? (
            // 로딩·오류 원은 작업 전처럼 스크롤 영역 밖의 메인 영역 가운데에 둔다.
            <MainAreaLoading>{isLoading ? <Spinner showElapsed /> : <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void namesQuery.refetch(); void classificationsQuery.refetch(); void categoryQuery.refetch(); void quotesQuery.refetch() }} />}</MainAreaLoading>
          ) : (
          <ScrollArea overlay viewportRef={tableContainerRef} scrollLabel="해외 종목 목록" className="min-h-0 flex-1 border border-ui-border">
            <table style={{ minWidth: stockColumnWidthsTotal(columnWidths) }} className="nes-table is-dark custom-page-table w-full table-fixed select-none text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:py-1">
              <StockTableColGroup keys={COLUMN_WIDTH_KEYS} widths={columnWidths} />
              <thead className="sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--ui-border)]"><tr style={{ height: STOCK_HEADER_ROW_PX }}><th className="bg-[var(--ui-panel)] px-0 text-center"><input type="checkbox" className="mx-auto my-0 block thin-check" checked={allVisibleSelected} disabled={!canEdit} onChange={toggleVisible} aria-label="표시된 종목 전체 선택" /></th>{columns.filter(column => isColumnShown(column.key)).map(column => <th key={column.key} scope="col" className="whitespace-nowrap bg-[var(--ui-panel)] px-0 text-center font-bold text-ui-white"><StockSortHeader label={column.label} state={sort.key === column.key ? sort.direction : null} onSort={() => changeSort(column.key)} filter={column.filter ? filterButton(column.filter, column.label) : undefined} /></th>)}</tr></thead>
              <tbody>{filtered.map((stock, index) => <tr key={stock.code} {...(canEdit ? { ...rowProps(index), onMouseDown: (event: MouseEvent<HTMLTableRowElement>) => { if (!(event.target as HTMLElement).closest('[data-no-row-select]')) rowProps(index).onMouseDown(event) } } : {})} className={`${selected.has(stock.code) ? 'bg-[var(--brand)]/20' : 'hover:bg-[var(--brand)]/10'}${canEdit ? '' : ' text-ui-muted'}`}><td className="px-0 text-center"><input type="checkbox" className="mx-auto my-0 block thin-check" checked={selected.has(stock.code)} disabled={!canEdit} onChange={() => {}} aria-label={`${stock.name} 선택`} /></td>{isColumnShown('code') && <td className="text-center text-ui-muted">{stock.code}</td>}{isColumnShown('englishName') && <td className="truncate pl-2 text-ui-muted" data-hint={stock.englishName || undefined}>{stock.englishName || '—'}</td>}{isColumnShown('name') && <td onClick={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} className={`truncate px-1 ${canEdit && !namesQuery.isLoading && !namesQuery.isError ? 'cursor-pointer hover:bg-[var(--brand)]/35' : ''}`}>{!canEdit ? <span className="px-1">{stock.name}</span> : editingCode === stock.code ? <input autoFocus aria-label={`${stock.code} 종목명 (한글)`} value={draftName} maxLength={100} disabled={saveName.isPending} onChange={event => setDraftName(event.target.value)} onBlur={() => { if (!saveName.isPending) setEditingCode(null) }} onKeyDown={event => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === 'Enter') void submitName(stock.code, stock.name); if (event.key === 'Escape') setEditingCode(null) }} className="nes-input is-dark block h-5 w-full rounded-md border-0 bg-[var(--ui-panel)] px-1 text-left text-sm text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]" /> : <button type="button" disabled={namesQuery.isLoading || namesQuery.isError} onClick={() => { setDraftName(stock.name); setEditingCode(stock.code) }} className="w-full truncate border-0 bg-transparent px-1 text-left text-ui-white disabled:opacity-50">{stock.name}</button>}</td>}{isColumnShown('marketCap') && <td className="whitespace-nowrap pr-3 text-right text-ui-muted">{toJoEokDecimal(stock.marketCapEok)} {unit.suffix}</td>}{isColumnShown('marketCapKrw') && <td className="whitespace-nowrap pr-3 text-right text-ui-muted">{toJoEokDecimal(stock.marketCapEok * unit.krwRate)} 원</td>}{isColumnShown('sector') && <td className="truncate pl-2 text-ui-muted" data-hint={stock.sector || undefined}>{stock.sector || '—'}</td>}{classificationCell(stock.code, 'sector', stock.customSector, stock.customSector)}{classificationCell(stock.code, 'industry', stock.customIndustry, stock.customSector)}{classificationCell(stock.code, 'subIndustry', stock.customSubIndustry, stock.customSector, stock.customIndustry)}</tr>)}</tbody>
            </table>
          </ScrollArea>
          )}
          {selectionHint.isOpen && <SelectionHintBubble onClose={selectionHint.close} />}
          {!isLoading && !isError && filtered.length === 0 && <EmptyMessage message={EMPTY_SEARCH_MESSAGE} topClass="top-1.5" />}
          <DisclaimerFooter />
        </main>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Stock" customTabLabel="종목" customTabIcon="stock-single" tabStorageName={tabStorageName} taxonomyAtBottom taxonomy={sheet} onlyTaxonomy="MARKETRY" snapshotTime={publishedAt} alsoTaxonomies={canUseMine ? ['MINE'] : undefined} withoutMiddle onSelectTaxonomy={next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')} stockCountLabel={`${filtered.length}/${stocks.length}종목`} showPreferenceActions={false} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={sheet === 'MINE' ? ['custom', 'adminOps'] : ['custom']}>
            <SettingsPanelGroup section="custom">
              {canEdit ? (
                <>
                <div className="settings-item"><div className="settings-custom-control">
                  <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">변경 내역</h2>
                  <ChangeHistoryControls undoStack={undoStack} redoStack={redoStack} describe={describeAction} onUndo={() => void runHistory('undo')} onRedo={() => void runHistory('redo')} onUndoItem={id => void runHistory('undo', id)} onRedoItem={id => void runHistory('redo', id)} />
                </div></div>
                <div className="settings-item"><div className="settings-custom-control">
              <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">일괄 변경</h2>
              <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">{selected.size ? `선택한 종목 ${selected.size}개의 분류를 한 번에 바꿉니다` : '표에서 종목을 먼저 선택해 주세요'}</p>
              <div className="grid max-w-full settings-control-inset grid-cols-3 gap-[6px]">
                <BulkAssignButton count={selected.size} options={categoryOptions('sector')} onAssign={id => void assignCategory([...selected], id, true)} label="대분류" title="대분류 일괄 변경" orderMode={{ value: orderMode, onChange: setOrderMode }} disabled={categoryQuery.isError || categoryQuery.isLoading || assignClassification.isPending} />
                <BulkAssignButton count={selected.size} options={categoryOptions('industry', sharedSector)} onAssign={id => void assignCategory([...selected], id, true)} label="중분류" title="중분류 일괄 변경" orderMode={{ value: orderMode, onChange: setOrderMode }} disabled={!sharedSector || categoryQuery.isError || categoryQuery.isLoading || assignClassification.isPending} disabledHint={'선택한 종목의 대분류가 같아야 합니다.\n다르면 대분류를 먼저 일괄적용해 주세요'} />
                <BulkAssignButton count={selected.size} options={categoryOptions('subIndustry', sharedSector, sharedIndustry)} onAssign={id => void assignCategory([...selected], id, true)} label="소분류" title="소분류 일괄 변경" orderMode={{ value: orderMode, onChange: setOrderMode }} disabled={!sharedIndustry || categoryQuery.isError || categoryQuery.isLoading || assignClassification.isPending} disabledHint={'선택한 종목의 중분류가 같아야 합니다.\n다르면 중분류를 먼저 일괄적용해 주세요'} />
              </div></div></div>
                </>
              ) : <div className="settings-empty-message"><span className="text-center">읽기 전용<br /><span className="text-ui-muted">{canUseMine ? '[내 기준] 모드만 쓰기 가능' : `계산: ${unit.rateNote}`}</span></span></div>}
            </SettingsPanelGroup>
            {sheet === 'MINE' && <SettingsPanelGroup section="adminOps"><div className="settings-item"><div className="settings-custom-control">
              <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">MARKETRY 분류</h2>
              <p className="settings-description m-0 mt-1 max-w-full text-xs font-medium text-ui-muted">내 기준을 MARKETRY로 업데이트·롤백</p>
              <div className="settings-button-area max-w-full settings-control-inset"><OverseasPublishControls market={market} /></div>
            </div></div></SettingsPanelGroup>}
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={handleCopy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
    </div>
  )
}
