import { useMemo, useRef, useState } from 'react'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import ToolbarModeText from '@/components/ToolbarModeText'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { STOCK_HEADER_ROW_PX, stockTableMinWidthPx, type StockColumnKey } from '@/utils/stockTableColumns'
import StockTableColGroup from '@/components/StockTableColGroup'
import ScreenshotModal from '@/components/ScreenshotModal'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import StockSortHeader from '@/components/StockSortHeader'
import ColumnFilterButton from '@/components/ColumnFilterButton'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import { appAlert } from '@/utils/appDialogBus'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import { createStockMatcher } from '@/utils/stockSearch'
import stocks from '@/data/japanStocks.json'

type ClassificationField = 'sector' | 'industry'
type SortKey = 'code' | 'name' | 'englishName' | 'marketCap' | 'sector' | 'industry' | 'customSector' | 'customIndustry'
type FilterKey = 'sector' | 'industry' | 'customSector' | 'customIndustry'
type Classification = { sector: string | null; industry: string | null }
const COLUMN_WIDTH_KEYS: readonly StockColumnKey[] = ['stockCode', 'stockName', 'alias', 'totalMarketValue', 'industry', 'parentSector', 'midSector', 'subSector']
const CLASSIFICATION_QUERY_KEY = ['admin', 'overseas-stock-classifications', 'JAPAN'] as const

// 제공된 시가총액 표기(엔)를 숫자로 변환해 표시값 기준으로 정렬한다.
function marketCapValue(value: string): number {
  const text = value.replaceAll(',', '')
  const jo = Number(text.match(/(\d+)조/)?.[1] ?? 0)
  const rest = text.split('조').at(-1) ?? ''
  const eok = Number(rest.match(/(\d+)억/)?.[1] ?? 0)
  const thousand = Number(rest.match(/(\d+)천억/)?.[1] ?? 0)
  return jo * 10000 + eok + thousand * 1000
}

export default function JapanStockPage() {
  const queryClient = useQueryClient()
  const namesQuery = useQuery({ queryKey: ['admin', 'japan-stock-names'], queryFn: async () => (await client.get<Record<string, string>>('/admin/japan-stock-names')).data })
  const saveName = useMutation({ mutationFn: async ({ code, name }: { code: string; name: string }) => { await client.put(`/admin/japan-stock-names/${code}`, { name }) }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'japan-stock-names'] }) })
  const classificationsQuery = useQuery({ queryKey: CLASSIFICATION_QUERY_KEY, queryFn: async () => (await client.get<Record<string, Classification>>('/admin/overseas-stock-classifications/JAPAN')).data })
  const saveClassification = useMutation({ mutationFn: async ({ code, field, value }: { code: string; field: ClassificationField; value: string | null }) => { await client.put(`/admin/overseas-stock-classifications/JAPAN/${code}/${field}`, { value }) }, onSuccess: () => queryClient.invalidateQueries({ queryKey: CLASSIFICATION_QUERY_KEY }) })
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [editingClassification, setEditingClassification] = useState<{ code: string; field: ClassificationField } | null>(null)
  const [draftClassification, setDraftClassification] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'marketCap', direction: 'desc' })
  const [excluded, setExcluded] = useState<Record<FilterKey, Set<string>>>({ sector: new Set(), industry: new Set(), customSector: new Set(), customIndustry: new Set() })
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const rows = useMemo(() => stocks.map(stock => ({ ...stock, name: namesQuery.data?.[stock.code] ?? stock.name, customSector: classificationsQuery.data?.[stock.code]?.sector ?? '', customIndustry: classificationsQuery.data?.[stock.code]?.industry ?? '' })), [namesQuery.data, classificationsQuery.data])
  const filtered = useMemo(() => {
    const matcher = createStockMatcher(search, (stock: (typeof rows)[number]) => ({ code: stock.code, name: stock.englishName || '', alias: stock.name, labels: [stock.sector, stock.industry, stock.customSector, stock.customIndustry] }))
    return rows.filter(stock => !excluded.sector.has(stock.sector || '-') && !excluded.industry.has(stock.industry || '-') && !excluded.customSector.has(stock.customSector || '-') && !excluded.customIndustry.has(stock.customIndustry || '-') && matcher(stock)).sort((a, b) => {
        const comparison = sort.key === 'marketCap' ? marketCapValue(a.marketCap) - marketCapValue(b.marketCap) : (a[sort.key] || '').localeCompare(b[sort.key] || '', 'ko')
        return (sort.direction === 'asc' ? comparison : -comparison) || a.code.localeCompare(b.code)
      })
  }, [search, excluded, sort, rows])
  const submitName = async (code: string, currentName: string) => {
    const name = draftName.trim()
    if (!name) { void appAlert('한글명을 입력해주세요.', { title: '한글명 저장' }); return }
    if (name === currentName) { setEditingCode(null); return }
    const normalize = (text: string) => text.replace(/\s+/g, '').toLowerCase()
    const conflict = stocks.find(stock => stock.code !== code && normalize(namesQuery.data?.[stock.code] ?? stock.name) === normalize(name))
    if (conflict) { void appAlert(`다른 종목의 한글명과 겹칩니다.\n겹치는 종목: ${conflict.code} ${namesQuery.data?.[conflict.code] ?? conflict.name}`, { title: '한글명 저장' }); return }
    try { await saveName.mutateAsync({ code, name }); setEditingCode(null) }
    catch { void appAlert('한글명을 저장하지 못했습니다. 다시 시도해주세요.', { title: '한글명 저장' }) }
  }
  const changeSort = (key: SortKey) => setSort(previous => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' }))
  const filterButton = (key: FilterKey, label: string) => <ColumnFilterButton label={label} getOptions={() => [...new Set(rows.map(stock => stock[key] || '-'))]} excluded={excluded[key]} onToggle={value => setExcluded(previous => {
    const next = new Set(previous[key])
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return { ...previous, [key]: next }
  })} onSelectAll={() => setExcluded(previous => ({ ...previous, [key]: new Set() }))} onSelectNone={values => setExcluded(previous => ({ ...previous, [key]: new Set(values) }))} />
  const columns: { key: SortKey; label: string; filter?: FilterKey }[] = [
    { key: 'code', label: '종목코드' }, { key: 'englishName', label: '종목명' }, { key: 'name', label: '한글명' }, { key: 'marketCap', label: '시가총액' }, { key: 'sector', label: '야후 섹터', filter: 'sector' }, { key: 'customSector', label: '섹터', filter: 'customSector' }, { key: 'industry', label: '야후 업종', filter: 'industry' }, { key: 'customIndustry', label: '업종', filter: 'customIndustry' },
  ]
  const submitClassification = async (code: string, field: ClassificationField, currentValue: string) => {
    const value = draftClassification.trim()
    if (value === currentValue) { setEditingClassification(null); return }
    try { await saveClassification.mutateAsync({ code, field, value: value || null }); setEditingClassification(null) }
    catch { void appAlert('분류를 저장하지 못했습니다. 다시 시도해주세요.', { title: '분류 저장' }) }
  }
  const classificationCell = (code: string, field: ClassificationField, value: string) => {
    const label = field === 'sector' ? '섹터' : '업종'
    const isEditing = editingClassification?.code === code && editingClassification.field === field
    return <td className={`truncate px-1 ${!classificationsQuery.isLoading && !classificationsQuery.isError ? 'cursor-pointer hover:bg-[var(--brand)]/35' : ''}`}>{isEditing ? <input autoFocus aria-label={`${code} ${label}`} value={draftClassification} maxLength={12} disabled={saveClassification.isPending} onChange={event => setDraftClassification(event.target.value.slice(0, 12))} onBlur={() => { if (!saveClassification.isPending) setEditingClassification(null) }} onKeyDown={event => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === 'Enter') void submitClassification(code, field, value); if (event.key === 'Escape') setEditingClassification(null) }} className="nes-input is-dark h-5 w-full rounded-md border-0 bg-[var(--ui-panel)] px-1 text-left text-sm text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]" /> : <button type="button" aria-label={`${code} ${label} 수정`} disabled={classificationsQuery.isLoading || classificationsQuery.isError} onClick={() => { setDraftClassification(value); setEditingClassification({ code, field }) }} className="w-full truncate border-0 bg-transparent px-1 text-left text-ui-white disabled:opacity-50">{value || '-'}</button>}</td>
  }
  const allVisibleSelected = filtered.length > 0 && filtered.every(stock => selected.has(stock.code))
  const toggleStock = (code: string) => setSelected(previous => {
    const next = new Set(previous)
    if (next.has(code)) next.delete(code)
    else next.add(code)
    return next
  })
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
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <main ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="main-toolbar mt-[3px] mb-[8px] flex h-7 shrink-0 items-center gap-1 text-sm font-bold">
            <ToolbarModeText page="CUSTOM" label="J-STOCK" />
            <SearchBar inline query={search} onChange={setSearch} placeholder="종목코드 · 종목명 · 한글명 · 업종 검색" ariaLabel="일본 종목 검색" />
          </div>
          {namesQuery.isError && <div role="alert" className="mb-2 text-sm text-ui-muted">저장된 한글명을 불러오지 못했습니다. <button type="button" className="border-0 bg-transparent text-[var(--brand)]" onClick={() => void namesQuery.refetch()}>다시 시도</button></div>}
          {classificationsQuery.isError && <div role="alert" className="mb-2 text-sm text-ui-muted">저장된 분류를 불러오지 못했습니다. <button type="button" className="border-0 bg-transparent text-[var(--brand)]" onClick={() => void classificationsQuery.refetch()}>다시 시도</button></div>}
          <div className="min-h-0 flex-1 overflow-auto border border-ui-border">
            <table style={{ minWidth: stockTableMinWidthPx(COLUMN_WIDTH_KEYS) }} className="nes-table is-dark custom-page-table w-full table-fixed select-none text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:py-1 [&_th]:border-ui-white/20 [&_th]:border-b-0 [&_th]:py-1">
              <StockTableColGroup keys={COLUMN_WIDTH_KEYS} />
              <thead className="sticky top-0 z-10 [&_th]:shadow-[inset_0_-1px_0_var(--ui-border)]"><tr style={{ height: STOCK_HEADER_ROW_PX }}><th className="bg-[var(--ui-panel)] px-0 text-center"><input type="checkbox" className="mx-auto my-0 block thin-check" checked={allVisibleSelected} onChange={toggleVisible} aria-label="표시된 종목 전체 선택" /></th>{columns.map(column => <th key={column.key} scope="col" className="whitespace-nowrap bg-[var(--ui-panel)] px-0 text-center font-bold text-ui-white"><StockSortHeader label={column.label} state={sort.key === column.key ? sort.direction : null} onSort={() => changeSort(column.key)} filter={column.filter ? filterButton(column.filter, column.label) : undefined} /></th>)}</tr></thead>
              <tbody>{filtered.map(stock => <tr key={stock.code} className={selected.has(stock.code) ? 'bg-[var(--brand)]/20' : 'hover:bg-[var(--brand)]/10'}><td className="px-0 text-center"><input type="checkbox" className="mx-auto my-0 block thin-check" checked={selected.has(stock.code)} onChange={() => toggleStock(stock.code)} aria-label={`${stock.name} 선택`} /></td><td className="text-center text-ui-muted">{stock.code}</td><td className="truncate pl-2 text-ui-muted" data-hint={stock.englishName || undefined}>{stock.englishName || '—'}</td><td className={`truncate px-1 ${!namesQuery.isLoading && !namesQuery.isError ? 'cursor-pointer hover:bg-[var(--brand)]/35' : ''}`}>{editingCode === stock.code ? <input autoFocus aria-label={`${stock.code} 한글명`} value={draftName} maxLength={100} disabled={saveName.isPending} onChange={event => setDraftName(event.target.value)} onBlur={() => { if (!saveName.isPending) setEditingCode(null) }} onKeyDown={event => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === 'Enter') void submitName(stock.code, stock.name); if (event.key === 'Escape') setEditingCode(null) }} className="nes-input is-dark h-5 w-full rounded-md border-0 bg-[var(--ui-panel)] px-1 text-left text-sm text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]" /> : <button type="button" disabled={namesQuery.isLoading || namesQuery.isError} onClick={() => { setDraftName(stock.name); setEditingCode(stock.code) }} className="w-full truncate border-0 bg-transparent px-1 text-left text-ui-white disabled:opacity-50">{stock.name}</button>}</td><td className="whitespace-nowrap pr-4 text-right text-ui-muted">{stock.marketCap}</td><td className="truncate pl-2 text-ui-muted" data-hint={stock.sector || undefined}>{stock.sector || '—'}</td>{classificationCell(stock.code, 'sector', stock.customSector)}<td className="truncate pl-2 text-ui-muted" data-hint={stock.industry || undefined}>{stock.industry || '—'}</td>{classificationCell(stock.code, 'industry', stock.customIndustry)}</tr>)}</tbody>
            </table>
            {filtered.length === 0 && <p className="p-6 text-center text-ui-muted">검색 결과가 없습니다.</p>}
          </div>
          <DisclaimerFooter />
        </main>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Custom" stockCountLabel={`${filtered.length}/${stocks.length}종목`} showPreferenceActions={false} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={['custom', 'adminOps']}>
            <SettingsPanelGroup section="custom"><div className="settings-empty-message"><span className="text-center">읽기 전용</span></div></SettingsPanelGroup>
            <SettingsPanelGroup section="adminOps"><div className="settings-empty-message"><span className="text-center">한글명은 관리자 공통으로 저장<br /><span className="text-ui-muted">시가총액은 제공받은 목록의 스냅샷<br />업종은 Yahoo Finance 조회값</span></span></div></SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={handleCopy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
    </div>
  )
}
