import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MobileTopBar from '@/components/MobileTopBar'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import Spinner from '@/components/Spinner'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePageSetting } from '@/hooks/usePageSetting'
import type { HeatmapItem } from '@/types/api'
import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { collectAllItems } from '@/hooks/useFilteredHeatmap'
import { isLightColor, resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { toCount, toDateTimeLabel, toJoEok, toPctSigned } from '@/utils/format'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import type { MarketQuery } from '@/types/api'
import { marketRoute } from '@/utils/marketRoute'

const MARKETS: { value: MarketQuery; label: string }[] = [
  { value: 'ALL_STOCK', label: '전체' },
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
]
const FIRST_STOCKS_SHOWN = 10
const STOCKS_PER_MORE = 10
const STOCK_MAP_COUNTS = [8, 12, 20] as const

function stockLayoutValue(stock: HeatmapItem, ratio: number) {
  return ratio <= 0 ? 1 : Math.pow(Math.max(stock.totalMarketValue, 0), ratio / 100)
}

type MobileSectorItem = OverviewMapItem & {
  node: FilteredHeatmapSectorNode | null
  stocks: HeatmapItem[]
  isDirectStocks?: boolean
}

function toMobileSectorItem(node: FilteredHeatmapSectorNode, path: string, boxSizeRatio: number): MobileSectorItem | null {
  const stocks = collectAllItems(node)
  const marketValue = stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0)
  if (marketValue <= 0 || stocks.length === 0) return null
  const changeRate = stocks.reduce((sum, stock) => sum + stock.changeRate * stock.totalMarketValue, 0) / marketValue
  const advancers = stocks.filter(stock => stock.changeRate > 0).length
  const decliners = stocks.filter(stock => stock.changeRate < 0).length
  return {
    key: path,
    name: node.sectorName,
    marketValue,
    layoutValue: stocks.reduce((sum, stock) => sum + stockLayoutValue(stock, boxSizeRatio), 0),
    changeRate,
    advancers,
    decliners,
    unchanged: stocks.length - advancers - decliners,
    node,
    stocks,
  }
}

function toDirectStocksItem(stocks: HeatmapItem[], parentPath: string, boxSizeRatio: number): MobileSectorItem | null {
  if (!stocks.length) return null
  const marketValue = stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0)
  if (marketValue <= 0) return null
  return {
    key: `${parentPath}>direct-stocks`,
    name: '직접 종목',
    marketValue,
    layoutValue: stocks.reduce((sum, stock) => sum + stockLayoutValue(stock, boxSizeRatio), 0),
    changeRate: stocks.reduce((sum, stock) => sum + stock.changeRate * stock.totalMarketValue, 0) / marketValue,
    advancers: stocks.filter(stock => stock.changeRate > 0).length,
    decliners: stocks.filter(stock => stock.changeRate < 0).length,
    unchanged: stocks.filter(stock => stock.changeRate === 0).length,
    node: null,
    stocks,
    isDirectStocks: true,
  }
}

function MobileStockHeatmap({ stocks, boxSizeRatio, colorScale, decimalPlaces, onSelect }: {
  stocks: HeatmapItem[]
  boxSizeRatio: number
  colorScale: ReturnType<typeof useGlobalSettings>['colorScale']
  decimalPlaces: number
  onSelect: (stock: HeatmapItem) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const fontsVersion = useFontsVersion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const boxes = useMemo(() => {
    if (size.width <= 0 || size.height <= 0 || stocks.length === 0) return []
    const root = hierarchy<{ stock?: HeatmapItem; children?: { stock: HeatmapItem }[] }>({ children: stocks.map(stock => ({ stock })) })
      .sum(node => node.stock ? stockLayoutValue(node.stock, boxSizeRatio) : 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    const layoutRoot: HierarchyRectangularNode<typeof root.data> = treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(2)(root)
    return layoutRoot.leaves().map(leaf => ({
      stock: (leaf.data as { stock: HeatmapItem }).stock,
      x: leaf.x0,
      y: leaf.y0,
      width: leaf.x1 - leaf.x0,
      height: leaf.y1 - leaf.y0,
    }))
  }, [boxSizeRatio, size, stocks])

  return (
    <div ref={ref} className="relative h-full min-h-0 w-full overflow-hidden border border-ui-border bg-ui-surface p-1">
      {boxes.map(({ stock, x, y, width, height }) => {
        const color = resolveHeatmapColor(stock.changeRate, colorScale)
        const label = layoutOverviewLabel(stock.alias ?? stock.stockName, toPctSigned(stock.changeRate, decimalPlaces), width, height, fontsVersion)
        return (
          <button key={stock.stockCode} type="button" aria-label={`${stock.stockName} ${toPctSigned(stock.changeRate, decimalPlaces)}`} onClick={() => onSelect(stock)} className="absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight text-white" style={{ left: x, top: y, width, height, backgroundColor: color }}>
            {label.lines.length > 0 && <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize }}>{label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}</span>}
            {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize }}>{toPctSigned(stock.changeRate, decimalPlaces)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function MobileStockList({ stocks, colorScale, decimalPlaces }: { stocks: HeatmapItem[]; colorScale: ReturnType<typeof useGlobalSettings>['colorScale']; decimalPlaces: number }) {
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase('ko-KR')
  const [showMoreFor, setShowMoreFor] = useState({ query: '', count: FIRST_STOCKS_SHOWN })
  const limit = showMoreFor.query === normalizedSearch ? showMoreFor.count : FIRST_STOCKS_SHOWN
  const sortedStocks = useMemo(
    () => [...stocks]
      .filter(stock => !normalizedSearch || `${stock.stockName} ${stock.alias ?? ''} ${stock.stockCode}`.toLocaleLowerCase('ko-KR').includes(normalizedSearch))
      .sort((a, b) => b.totalMarketValue - a.totalMarketValue),
    [stocks, normalizedSearch],
  )
  const visibleStocks = sortedStocks.slice(0, limit)

  return (
    <section aria-label="종목 목록" className="mt-5">
      <label htmlFor="mobile-stock-search" className="mb-2 block text-sm font-semibold text-ui-white">종목 찾기</label>
      <input
        id="mobile-stock-search"
        type="search"
        value={search}
        onChange={event => setSearch(event.target.value)}
        placeholder="종목명 또는 종목코드"
        className="h-11 w-full border border-ui-border bg-ui-panel px-3 text-base text-ui-white placeholder:text-ui-muted focus:border-brand focus:outline-none"
      />
      <p className="mt-3 text-sm text-ui-muted">시가총액 순 · {toCount(sortedStocks.length)}종목</p>
      <ul className="mt-2 divide-y divide-ui-border border-y border-ui-border">
        {visibleStocks.map(stock => {
          const color = resolveHeatmapColor(stock.changeRate, colorScale)
          const textColor = isLightColor(color) ? 'var(--ui-surface)' : 'var(--ui-white)'
          return (
            <li key={stock.stockCode} className="flex min-h-16 items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-ui-white">{stock.alias ?? stock.stockName}</p>
                <p className="mt-0.5 text-xs text-ui-muted">{stock.stockCode} · 시가총액 {toJoEok(stock.totalMarketValue / 100_000_000)}</p>
              </div>
              <span className="shrink-0 px-2 py-1 text-sm font-bold tabular-nums" style={{ backgroundColor: color, color: textColor }}>
                {toPctSigned(stock.changeRate, decimalPlaces)}
              </span>
            </li>
          )
        })}
      </ul>
      {sortedStocks.length === 0 && <p className="py-8 text-center text-sm text-ui-muted">일치하는 종목이 없습니다.</p>}
      {visibleStocks.length < sortedStocks.length && (
          <button type="button" onClick={() => setShowMoreFor(current => ({ query: normalizedSearch, count: (current.query === normalizedSearch ? current.count : FIRST_STOCKS_SHOWN) + STOCKS_PER_MORE }))} className="mt-3 min-h-11 w-full border border-ui-border bg-ui-panel text-sm font-semibold text-ui-white hover:bg-ui-control">
          종목 더 보기 ({toCount(sortedStocks.length - visibleStocks.length)}개 남음)
        </button>
      )}
    </section>
  )
}

export default function MobileMarketSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const {
    settingsModalProps,
    market,
    taxonomy,
    data,
    isLoading,
    isError,
    refetchHeatmap,
    filteredRootNodes,
    colorScale,
    decimalPlaces,
    boxSizeMarketCapRatio,
    onChangeBoxSizeMarketCapRatio,
  } = useGlobalSettings({ allowChangeRateMode: true })
  const [majorSelection, setMajorSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [midSelection, setMidSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [stockSelection, setStockSelection] = useState<{ market: MarketQuery; stocks: HeatmapItem[]; categoryName: string } | null>(null)
  const [viewMode, setViewMode] = useState<'sector' | 'stock'>('sector')
  const [stockMapCount, setStockMapCount] = useState<number>(12)
  const [focusedStockCode, setFocusedStockCode] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [groupDepth, setGroupDepth] = usePageSetting<number>('groupPage.depth', 2)
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : 3
  const effectiveGroupDepth = Math.min(groupDepth, selectableDepth)
  const majorName = majorSelection?.market === market ? majorSelection.name : null
  const midName = midSelection?.market === market ? midSelection.name : null
  const selectedStocks = stockSelection?.market === market ? stockSelection.stocks : null
  const stockCategoryName = stockSelection?.market === market ? stockSelection.categoryName : null
  const setMajorName = (name: string | null) => setMajorSelection(name ? { market, name } : null)
  const setMidName = (name: string | null) => setMidSelection(name ? { market, name } : null)
  const setSelectedStocks = (stocks: HeatmapItem[] | null, categoryName = '') => setStockSelection(stocks ? { market, stocks, categoryName } : null)
  const major = majorName ? filteredRootNodes.find(node => node.sectorName === majorName) ?? null : null
  const mid = major && midName ? major.children.find(node => node.sectorName === midName) ?? null : null

  const marketItems = useMemo(() => {
    const parent = mid ?? major
    if (parent && (mid || effectiveGroupDepth >= 2)) {
      const children = parent.children
        .map(node => toMobileSectorItem(node, `${major?.sectorName}>${parent.sectorName}>${node.sectorName}`, boxSizeMarketCapRatio))
        .filter((item): item is MobileSectorItem => item !== null)
      const directItems = toDirectStocksItem(parent.items, parent.sectorName, boxSizeMarketCapRatio)
      return directItems ? [...children, directItems] : children
    }
    return filteredRootNodes
      .map(node => toMobileSectorItem(node, node.sectorName, boxSizeMarketCapRatio))
      .filter((item): item is MobileSectorItem => item !== null)
  }, [boxSizeMarketCapRatio, effectiveGroupDepth, filteredRootNodes, major, mid])

  const mapItems: OverviewMapItem[] = marketItems.map(({ key, name, marketValue, layoutValue, changeRate, simpleAvg, advancers, decliners, unchanged }) => ({
    key, name, marketValue, layoutValue, changeRate, simpleAvg, advancers, decliners, unchanged,
  }))
  const stockScope = mid ?? major
  const stockContextItems = useMemo(() => {
    const stocks = selectedStocks ?? (stockScope ? collectAllItems(stockScope) : filteredRootNodes.flatMap(collectAllItems))
    return [...stocks].sort((a, b) => b.totalMarketValue - a.totalMarketValue)
  }, [filteredRootNodes, selectedStocks, stockScope])
  const stockHeatmapItems = stockContextItems.slice(0, stockMapCount)
  const focusedStock = stockHeatmapItems.find(stock => stock.stockCode === focusedStockCode) ?? null
  const heading = viewMode === 'stock'
    ? `${stockCategoryName || stockScope?.sectorName || '전체 시장'} 주식 히트맵`
    : mid ? `${mid.sectorName} 소분류 업종 히트맵` : major ? `${major.sectorName} 중분류 업종 히트맵` : '국내 업종 히트맵'
  const taxonomyLabel = taxonomy === 'MINE' ? '내 기준' : taxonomy === 'MARKETRY' ? 'MARKETRY' : '거래소'

  const selectSector = (name: string) => {
    const selected = marketItems.find(item => item.name === name)
    if (!selected) return
    if (selected.isDirectStocks) {
      setSelectedStocks(selected.stocks, selected.name)
      setViewMode('stock')
      return
    }
    if (!major && effectiveGroupDepth >= 2 && selected.node?.children.length) {
      setMajorName(selected.node.sectorName)
      setMidName(null)
      setSelectedStocks(null)
      return
    }
    if (major && !mid && effectiveGroupDepth >= 3 && selected.node?.children.length) {
      setMidName(selected.node.sectorName)
      setSelectedStocks(null)
      return
    }
    if (major && !mid && effectiveGroupDepth === 2) setMidName(selected.node?.sectorName ?? selected.name)
    setSelectedStocks(selected.stocks, selected.name)
    setViewMode('stock')
  }

  const selectViewMode = (nextMode: 'sector' | 'stock') => {
    setViewMode(nextMode)
    setFocusedStockCode(null)
    if (nextMode === 'sector') setSelectedStocks(null)
  }

  // 들어간 단계 = 브라우저 기록 한 칸(PC 지도 화면과 같은 방식). 대분류·중분류·종목으로 한 단계 들어갈 때마다 칸을 쌓아서
  // 뒤로가기가 사이트를 떠나지 않고 한 단계씩 위로 올라가게 한다. 전체 화면에서 한 번 더 누르면 원래대로 이전 페이지로 나간다.
  const depth = (major ? 1 : 0) + (mid ? 1 : 0) + (selectedStocks ? 1 : 0)
  const historyDepthRef = useRef(0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyLocationRef = useRef('') // 칸을 쌓은 주소(시장이 바뀌어 주소가 달라졌으면 go()로 정리하지 않는다)
  const historyNormalizedRef = useRef(false)
  const reduceToDepth = (target: number) => {
    let current = depth
    if (current > target && selectedStocks) { setStockSelection(null); setViewMode('sector'); current -= 1 }
    if (current > target && mid) { setMidSelection(null); current -= 1 }
    if (current > target && major) setMajorSelection(null)
    setFocusedStockCode(null)
  }
  useEffect(() => {
    // 다른 페이지에 갔다가 뒤로가기로 돌아오면 쌓인 칸만 남고 화면은 처음 상태라, 칸을 걷어 내 기준 칸으로 돌아간다.
    if (historyNormalizedRef.current) return
    historyNormalizedRef.current = true
    const stacked = window.history.state?.mobileMapDepth
    if (typeof stacked === 'number' && stacked > 0) {
      historyConsumingRef.current = true
      window.history.go(-stacked)
    }
  }, [])
  useEffect(() => {
    if (depth > historyDepthRef.current) {
      for (let k = historyDepthRef.current + 1; k <= depth; k++) window.history.pushState({ ...(window.history.state ?? {}), mobileMapDepth: k }, '')
      historyDepthRef.current = depth
      historyLocationRef.current = window.location.pathname + window.location.search
    } else if (depth < historyDepthRef.current) {
      const stale = historyDepthRef.current - depth
      historyDepthRef.current = depth
      if (window.location.pathname + window.location.search === historyLocationRef.current) {
        historyConsumingRef.current = true
        window.history.go(-stale)
      }
    }
  }, [depth])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        return
      }
      // 이 지도 화면 안에서의 이동만 다룬다 — 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      const path = window.location.pathname
      if (path !== '/home' && !path.startsWith('/map')) return
      const target: number = typeof e.state?.mobileMapDepth === 'number' ? e.state.mobileMapDepth : 0
      if (target < depth) {
        historyDepthRef.current = target
        reduceToDepth(target)
      } else if (target > depth) {
        // 앞으로가기로 들어갔던 단계는 복원할 수 없어, 지금 화면에 맞는 칸으로 되돌린다.
        historyConsumingRef.current = true
        window.history.go(-(target - depth))
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reduceToDepth는 매 렌더 새 함수이고 depth로 충분히 갱신된다
  }, [depth])

  const selectMarket = (nextMarket: MarketQuery) => {
    setMajorName(null)
    setMidName(null)
    setSelectedStocks(null)
    setViewMode('sector')
    setFocusedStockCode(null)
    if (pathname.startsWith('/map/')) {
      navigate(marketRoute('/map', nextMarket), { replace: true })
    } else {
      const next = new URLSearchParams(searchParams)
      next.set('market', nextMarket)
      setSearchParams(next, { replace: true })
    }
  }

  return (
    <main className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-ui-background text-ui-white">
      <MobileTopBar title="HEATMAP" />
      <header className="shrink-0 border-b border-ui-border px-3 pb-2 pt-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">{heading}</h1>
          </div>
          {data?.snapshotTime && <time className="shrink-0 text-[10px] tabular-nums text-ui-muted">{toDateTimeLabel(data.snapshotTime)}</time>}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <nav aria-label="시장 선택" className="flex gap-1">
            {MARKETS.map(option => <button key={option.value} type="button" aria-pressed={market === option.value} onClick={() => selectMarket(option.value)} className={`min-h-9 border px-3 text-xs font-semibold ${market === option.value ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-panel text-ui-text'}`}>{option.label}</button>)}
          </nav>
          <nav aria-label="히트맵 종류" className="flex gap-1">
            <button type="button" aria-pressed={viewMode === 'sector'} onClick={() => selectViewMode('sector')} className={`min-h-9 px-2 text-xs font-semibold ${viewMode === 'sector' ? 'border-b-2 border-brand text-brand' : 'text-ui-muted'}`}>업종</button>
            <button type="button" aria-pressed={viewMode === 'stock'} onClick={() => selectViewMode('stock')} className={`min-h-9 px-2 text-xs font-semibold ${viewMode === 'stock' ? 'border-b-2 border-brand text-brand' : 'text-ui-muted'}`}>주식</button>
          </nav>
        </div>
        {(major || mid || selectedStocks) && <nav aria-label="업종 이동 경로" className="mt-1 flex min-h-8 items-center gap-1 overflow-x-auto whitespace-nowrap text-xs">
          <button type="button" onClick={() => { setMajorName(null); setMidName(null); setSelectedStocks(null); setViewMode('sector') }} className="font-semibold text-brand">전체</button>
          {major && <><span className="text-ui-muted">›</span><button type="button" onClick={() => { setMidName(null); setSelectedStocks(null); setViewMode('sector') }} className="text-ui-text">{major.sectorName}</button></>}
          {mid && <><span className="text-ui-muted">›</span><button type="button" onClick={() => { setSelectedStocks(null); setViewMode('sector') }} className="text-ui-text">{mid.sectorName}</button></>}
          {stockCategoryName && <><span className="text-ui-muted">›</span><span>{stockCategoryName}</span></>}
        </nav>}
      </header>

      <section aria-label={viewMode === 'sector' ? '업종 히트맵' : '주식 히트맵'} className="relative min-h-0 flex-1 p-1">
        {isLoading ? <div className="flex h-full items-center justify-center"><Spinner showElapsed /></div>
          : isError ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><p className="text-sm text-ui-text">시장 지도를 불러오지 못했습니다.</p><button type="button" onClick={refetchHeatmap} className="min-h-11 px-4 font-semibold text-brand underline underline-offset-4">다시 불러오기</button></div>
            : viewMode === 'stock' ? stockHeatmapItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p> : <>
              <MobileStockHeatmap stocks={stockHeatmapItems} boxSizeRatio={boxSizeMarketCapRatio} colorScale={colorScale} decimalPlaces={decimalPlaces} onSelect={stock => setFocusedStockCode(stock.stockCode)} />
              {focusedStock && <button type="button" onClick={() => setSettingsOpen(true)} className="absolute bottom-20 left-3 right-3 flex items-center justify-between gap-3 border border-ui-border bg-ui-panel/95 px-3 py-2 text-left shadow-lg" aria-live="polite">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{focusedStock.alias ?? focusedStock.stockName}</span><span className="block text-xs text-ui-muted">{focusedStock.stockCode} · 시가총액 {toJoEok(focusedStock.totalMarketValue / 100_000_000)}</span></span>
                <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: resolveHeatmapColor(focusedStock.changeRate, colorScale) }}>{toPctSigned(focusedStock.changeRate, decimalPlaces)}</span>
              </button>}
            </> : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p> : <div className="flex h-full min-h-0 flex-col border border-ui-border bg-ui-surface p-1"><OverviewMap items={mapItems} colorScale={colorScale} onSelect={selectSector} /></div>}
      </section>

      <button type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)} className="fixed inset-x-0 bottom-0 z-30 flex min-h-[calc(3.75rem+env(safe-area-inset-bottom))] items-center justify-between border-t border-ui-border bg-ui-panel px-4 pb-[env(safe-area-inset-bottom)] text-left shadow-[0_-6px_24px_rgba(0,0,0,0.25)]">
        <span><span className="block text-sm font-bold">지도 설정 <span aria-hidden="true">⌃</span></span><span className="mt-0.5 block text-[11px] text-ui-muted">{taxonomyLabel} · 박스 {boxSizeMarketCapRatio}%{viewMode === 'stock' ? ` · ${stockHeatmapItems.length}종목` : ''}</span></span>
        <span className="text-xs text-brand">설정 바꾸기</span>
      </button>

      {settingsOpen && <>
        <button type="button" aria-label="설정 닫기" onClick={() => setSettingsOpen(false)} className="mobile-settings-backdrop-enter fixed inset-0 z-40 bg-black/55" />
        <section role="dialog" aria-modal="true" aria-label="지도 설정" className="mobile-settings-sheet-enter fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto border-t border-ui-border bg-ui-panel px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2 shadow-[0_-12px_36px_rgba(0,0,0,0.45)]">
          <button type="button" onClick={() => setSettingsOpen(false)} className="mx-auto mb-3 block h-1 w-10 rounded-full bg-ui-muted" aria-label="설정 닫기" />
          <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-bold">지도 설정</h2><button type="button" onClick={() => setSettingsOpen(false)} className="min-h-9 px-2 text-sm font-semibold text-brand">닫기</button></div>
          <div>
            <h3 className="mb-2 text-sm font-semibold">분류 기준</h3>
            <div role="radiogroup" aria-label="분류 기준" className="grid grid-cols-3 gap-2">
              {[
                { key: 'MARKETRY' as const, label: 'MARKETRY' },
                { key: 'KRX' as const, label: '거래소' },
                { key: 'MINE' as const, label: '내 기준' },
              ].map(option => {
                const selected = option.key === 'KRX' ? taxonomy === 'KRX' || taxonomy === 'NXT' : taxonomy === option.key
                return <button key={option.key} type="button" role="radio" aria-checked={selected} onClick={() => {
                  if (selected) return
                  settingsModalProps.onSelectTaxonomy(option.key)
                  setMajorName(null); setMidName(null); setSelectedStocks(null); setViewMode('sector'); setFocusedStockCode(null)
                }} className={`min-h-10 border px-1 text-sm font-semibold ${selected ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-background text-ui-text'}`}>{option.label}</button>
              })}
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-semibold">박스 크기</h3><p className="text-xs text-ui-muted">시가총액 반영</p></div>
            <div className="grid grid-cols-3 gap-2">
              {[{ value: 0, label: '균등' }, { value: 50, label: '균형' }, { value: 100, label: '시총 비례' }].map(option => <button key={option.value} type="button" aria-pressed={boxSizeMarketCapRatio === option.value} onClick={() => onChangeBoxSizeMarketCapRatio(option.value)} className={`min-h-10 border px-1 text-sm font-semibold ${boxSizeMarketCapRatio === option.value ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-background text-ui-text'}`}>{option.label} <span className="text-xs opacity-70">{option.value}%</span></button>)}
            </div>
          </div>
          {viewMode === 'sector' && selectableDepth > 1 && !major && !selectedStocks && <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">업종 분류 단계</h3>
            <div className="grid grid-cols-3 gap-2">{['대분류', '중분류', '소분류'].map((label, index) => { const value = index + 1; const disabled = value > selectableDepth; const selected = effectiveGroupDepth === value; return <button key={label} type="button" aria-pressed={selected} disabled={disabled} onClick={() => setGroupDepth(value)} className={`min-h-10 border px-1 text-sm font-semibold ${selected ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-background text-ui-text'} disabled:opacity-35`}>{label}</button> })}</div>
          </div>}
          {viewMode === 'stock' && <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">지도에 표시할 종목</h3><div role="group" aria-label="주식 히트맵 표시 종목 수" className="flex gap-1">{STOCK_MAP_COUNTS.map(count => <button key={count} type="button" aria-pressed={stockMapCount === count} onClick={() => { setStockMapCount(count); setFocusedStockCode(null) }} className={`min-h-9 min-w-10 border px-2 text-xs font-semibold ${stockMapCount === count ? 'border-brand bg-brand-surface text-ui-white' : 'border-ui-border bg-ui-background text-ui-text'}`}>{count}개</button>)}</div></div>
            <p className="text-xs text-ui-muted">시가총액 상위 종목을 지도에 표시합니다. 아래 목록에서 찾아볼 수 있어요.</p>
            <MobileStockList key={`${stockScope?.sectorName ?? 'all'}:${stockContextItems.length}`} stocks={stockContextItems} colorScale={colorScale} decimalPlaces={decimalPlaces} />
          </div>}
        </section>
      </>}
    </main>
  )
}
