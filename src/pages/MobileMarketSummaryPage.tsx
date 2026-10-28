import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ReturnArrowIcon } from '@/components/icons/AppIcons'
import MobileTopBar from '@/components/MobileTopBar'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import Spinner from '@/components/Spinner'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePageSetting } from '@/hooks/usePageSetting'
import type { HeatmapItem } from '@/types/api'
import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { collectAllItems } from '@/hooks/useFilteredHeatmap'
import { isLightColor, resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { toJoEok, toPctSigned, toSnapshotDateLabel, toSnapshotTimeOnlyLabel } from '@/utils/format'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import type { MarketQuery } from '@/types/api'
import { marketRoute } from '@/utils/marketRoute'

const MARKETS: { value: MarketQuery; label: string }[] = [
  { value: 'ALL_STOCK', label: '국내 증시' },
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
]
// 주식 지도에 그리는 종목 수(시가총액 상위) — 설정에서 고르지 않고 고정한다.
const STOCK_MAP_COUNT = 30

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
    <div ref={ref} className="relative h-full min-h-0 w-full overflow-hidden bg-ui-surface p-1">
      {boxes.map(({ stock, x, y, width, height }) => {
        const color = resolveHeatmapColor(stock.changeRate, colorScale)
        const label = layoutOverviewLabel(stock.alias ?? stock.stockName, toPctSigned(stock.changeRate, decimalPlaces), width, height, fontsVersion, STOCK_LABEL_OPTIONS)
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

// 종목명은 공백이 없는 경우가 많아, 칸이 좁으면 이름 중간에서 두 줄로 나눈다.
const STOCK_LABEL_OPTIONS = { splitInsideWord: true }

const SETTING_CHIP_CLASS = 'h-[32px] rounded-[4px] border-0 px-1 text-[13px] font-medium'

// 설정 줄 한 칸 — 이름은 왼쪽, 선택지는 오른쪽에 한 줄로 둬서 설정 줄이 낮게 유지된다.
function SettingRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-[80px] shrink-0"><h3 className="text-[12px] font-semibold leading-tight">{label}</h3>{hint && <p className="text-[11px] leading-tight text-ui-muted">{hint}</p>}</div>
      {children}
    </div>
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
  } = useGlobalSettings({ allowChangeRateMode: true, defaultTaxonomy: 'MARKETRY' })
  const [majorSelection, setMajorSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [midSelection, setMidSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [stockSelection, setStockSelection] = useState<{ market: MarketQuery; stocks: HeatmapItem[]; categoryName: string } | null>(null)
  const [viewMode, setViewMode] = useState<'sector' | 'stock'>('sector')
  const [focusedStockCode, setFocusedStockCode] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const settingsContentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ y: number; start: number; max: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const settingsHeight = () => Math.min(settingsContentRef.current?.scrollHeight ?? 0, window.innerHeight * 0.4 - 28)

  // 분류 단계: MARKETRY·내 기준은 대·중·소분류(3단계), 거래소는 1단계. 눌러서 들어갈 때 하위 분류가 있으면 그 분류로, 없으면 바로 종목으로 간다.
  // 박스 크기는 PC 설정과 따로 두고, 폰의 기본은 시총 비례(100)다. 동일 0 · 균형 50 · 시총 비례 100.
  const [boxSizeMarketCapRatio, onChangeBoxSizeMarketCapRatio] = usePageSetting<number>('mobile.boxSizeMarketCapRatio', 100)
  // 경로의 맨 앞은 전체일 때 국내 증시, 그 밖에는 고른 마켓 이름이다.
  const marketLabel = market === 'ALL_STOCK' ? '국내 증시' : MARKETS.find(option => option.value === market)?.label ?? '국내 증시'
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : 3
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
    if (parent && (mid || selectableDepth >= 2)) {
      const children = parent.children
        .map(node => toMobileSectorItem(node, `${major?.sectorName}>${parent.sectorName}>${node.sectorName}`, boxSizeMarketCapRatio))
        .filter((item): item is MobileSectorItem => item !== null)
      const directItems = toDirectStocksItem(parent.items, parent.sectorName, boxSizeMarketCapRatio)
      return directItems ? [...children, directItems] : children
    }
    return filteredRootNodes
      .map(node => toMobileSectorItem(node, node.sectorName, boxSizeMarketCapRatio))
      .filter((item): item is MobileSectorItem => item !== null)
  }, [boxSizeMarketCapRatio, selectableDepth, filteredRootNodes, major, mid])

  const mapItems: OverviewMapItem[] = marketItems.map(({ key, name, marketValue, layoutValue, changeRate, simpleAvg, advancers, decliners, unchanged }) => ({
    key, name, marketValue, layoutValue, changeRate, simpleAvg, advancers, decliners, unchanged,
  }))
  const stockScope = mid ?? major
  const stockContextItems = useMemo(() => {
    const stocks = selectedStocks ?? (stockScope ? collectAllItems(stockScope) : filteredRootNodes.flatMap(collectAllItems))
    return [...stocks].sort((a, b) => b.totalMarketValue - a.totalMarketValue)
  }, [filteredRootNodes, selectedStocks, stockScope])
  const stockHeatmapItems = stockContextItems.slice(0, STOCK_MAP_COUNT)
  const focusedStock = stockHeatmapItems.find(stock => stock.stockCode === focusedStockCode) ?? null
  // 종목 정보 카드는 손가락으로 가리지 않게 위쪽에 띄우고, 가만두면 5초 뒤 저절로 닫는다.
  useEffect(() => {
    if (!focusedStockCode) return
    const timer = window.setTimeout(() => setFocusedStockCode(null), 5000)
    return () => window.clearTimeout(timer)
  }, [focusedStockCode])
  const heading = viewMode === 'stock'
    ? `${stockCategoryName || stockScope?.sectorName || '전체 시장'} 주식 히트맵`
    : mid ? `${mid.sectorName} 소분류 업종 히트맵` : major ? `${major.sectorName} 중분류 업종 히트맵` : '국내 업종 히트맵'

  // 위쪽 경로 — PC 지도 화면과 같다: 앞 단계는 이름 오른쪽에 ↩ 아이콘이 붙은 버튼(누르면 그 단계로 되돌아감), 마지막(현재 위치)은 강조색 글씨다.
  const pathCrumbs: { key: string; label: string; go: (() => void) | null }[] = [
    { key: 'market', label: marketLabel, go: major || mid || selectedStocks ? () => { setMajorName(null); setMidName(null); setSelectedStocks(null); setViewMode('sector') } : null },
    ...(major ? [{ key: 'major', label: major.sectorName, go: mid || selectedStocks ? () => { setMidName(null); setSelectedStocks(null); setViewMode('sector') } : null }] : []),
    ...(mid ? [{ key: 'mid', label: mid.sectorName, go: selectedStocks ? () => { setSelectedStocks(null); setViewMode('sector') } : null }] : []),
    ...(stockCategoryName ? [{ key: 'stock', label: stockCategoryName, go: null }] : []),
  ]

  const selectSector = (name: string) => {
    const selected = marketItems.find(item => item.name === name)
    if (!selected) return
    if (selected.isDirectStocks) {
      setSelectedStocks(selected.stocks, selected.name)
      setViewMode('stock')
      return
    }
    if (!major && selectableDepth >= 2 && selected.node?.children.length) {
      setMajorName(selected.node.sectorName)
      setMidName(null)
      setSelectedStocks(null)
      return
    }
    if (major && !mid && selectableDepth >= 3 && selected.node?.children.length) {
      setMidName(selected.node.sectorName)
      setSelectedStocks(null)
      return
    }
    if (major && !mid) setMidName(selected.node?.sectorName ?? selected.name)
    setSelectedStocks(selected.stocks, selected.name)
    setViewMode('stock')
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
      <MobileTopBar title="MAP" />
      <h1 className="sr-only">{heading}</h1>
      {/* 경로 줄은 맨 처음(국내 증시)에서도 항상 둔다 — 단계에 들어갈 때마다 지도 크기가 달라지지 않게 한다. */}
      <header className="shrink-0 px-3 py-0.5">
        <nav aria-label="업종 이동 경로" className="flex h-[36px] items-center overflow-x-auto whitespace-nowrap text-[15px] leading-none font-bold">
          {pathCrumbs.map(crumb => crumb.go
            ? <button key={crumb.key} type="button" onClick={crumb.go} style={{ fontFamily: 'inherit' }} className="flex h-full shrink-0 items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-ui-white active:bg-ui-white/35">{crumb.label}<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></button>
            : <span key={crumb.key} aria-current="location" className="shrink-0 px-2 text-[var(--accent)]">{crumb.label}</span>)}
        </nav>
      </header>

      <section aria-label={viewMode === 'sector' ? '업종 히트맵' : '주식 히트맵'} className="relative min-h-0 flex-1 p-1">
        {isLoading ? <div className="flex h-full items-center justify-center"><Spinner showElapsed /></div>
          : isError ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><p className="text-sm text-ui-text">시장 지도를 불러오지 못했습니다.</p><button type="button" onClick={refetchHeatmap} className="min-h-11 px-4 font-semibold text-brand underline underline-offset-4">다시 불러오기</button></div>
            : viewMode === 'stock' ? stockHeatmapItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p> : <>
              <MobileStockHeatmap stocks={stockHeatmapItems} boxSizeRatio={boxSizeMarketCapRatio} colorScale={colorScale} decimalPlaces={decimalPlaces} onSelect={stock => setFocusedStockCode(current => current === stock.stockCode ? null : stock.stockCode)} />
              {focusedStock && <button type="button" aria-label="종목 정보 닫기" onClick={() => setFocusedStockCode(null)} className="absolute left-3 right-3 top-3 flex items-center justify-between gap-3 rounded-[6px] border-0 bg-ui-panel/95 px-3 py-2 text-left shadow-lg" aria-live="polite">
                <span className="min-w-0"><span className="block truncate text-sm font-semibold">{focusedStock.stockName}</span><span className="block text-xs text-ui-muted">{focusedStock.stockCode} · 시가총액 {toJoEok(focusedStock.totalMarketValue / 100_000_000)}</span></span>
                <span className="shrink-0 rounded-[4px] px-2 py-1 text-[13px] font-bold tabular-nums" style={{ backgroundColor: resolveHeatmapColor(focusedStock.changeRate, colorScale), color: isLightColor(resolveHeatmapColor(focusedStock.changeRate, colorScale)) ? 'var(--ui-surface)' : 'var(--ui-white)' }}>{toPctSigned(focusedStock.changeRate, decimalPlaces)}</span>
              </button>}
            </> : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p> : <div className="flex h-full min-h-0 flex-col bg-ui-surface p-1"><OverviewMap items={mapItems} colorScale={colorScale} onSelect={selectSector} /></div>}
      </section>

      <section role="region" aria-label="설정" className="relative z-10 shrink-0 rounded-t-[16px] border-t border-ui-border bg-ui-panel shadow-[0_-6px_24px_rgba(0,0,0,0.25)]">
        <button type="button" aria-label={settingsOpen ? '설정 닫기' : '설정 열기'} aria-expanded={settingsOpen} onClick={() => {
          if (suppressClickRef.current) { suppressClickRef.current = false; return }
          setSettingsOpen(open => !open)
        }} onPointerDown={event => {
          if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
          const max = settingsHeight()
          dragRef.current = { y: event.clientY, start: settingsOpen ? max : 0, max, moved: false }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerMove={event => {
          const drag = dragRef.current
          if (!drag) return
          const delta = drag.y - event.clientY
          if (Math.abs(delta) > 5) drag.moved = true
          if (drag.moved) setDragHeight(Math.max(0, Math.min(drag.max, drag.start + delta)))
        }} onPointerUp={event => {
          const drag = dragRef.current
          if (!drag) return
          if (drag.moved) {
            setSettingsOpen(drag.start + drag.y - event.clientY > drag.max / 2)
            suppressClickRef.current = true
          }
          dragRef.current = null
          setDragHeight(null)
        }} onPointerCancel={() => { dragRef.current = null; setDragHeight(null) }} className="relative flex h-[28px] w-full touch-none items-center justify-center border-0 bg-transparent p-0 text-ui-white before:absolute before:left-1/2 before:top-1/2 before:h-[48px] before:w-[48px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']">
          {!settingsOpen && data?.snapshotTime && <span className="absolute left-3 top-0 flex h-[28px] items-center text-[13px] tabular-nums text-ui-muted">{toSnapshotDateLabel(data.snapshotTime)} {toSnapshotTimeOnlyLabel(data.snapshotTime)}</span>}
          <span aria-hidden="true" className="h-1 w-10 rounded-full bg-ui-muted" />
        </button>
        <div style={{ height: dragHeight === null ? (settingsOpen ? `${settingsHeight()}px` : '0px') : `${dragHeight}px`, transition: dragHeight === null ? 'height 240ms ease-out' : 'none' }} className="overflow-hidden motion-reduce:!transition-none">
          <div ref={settingsContentRef} inert={!settingsOpen && dragHeight === null} className="max-h-[calc(40dvh-28px)] overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <SettingRow label="마켓">
            <div role="radiogroup" aria-label="마켓 선택" className="grid flex-1 grid-cols-3 gap-1.5">
              {MARKETS.map(option => <button key={option.value} type="button" role="radio" aria-checked={market === option.value} onClick={() => selectMarket(option.value)} className={`${SETTING_CHIP_CLASS} ${market === option.value ? 'bg-brand-surface text-ui-white' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>)}
            </div>
          </SettingRow>
          <SettingRow label="박스 크기">
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {[{ value: 0, label: '동일' }, { value: 50, label: '균형' }, { value: 100, label: '시총 비례' }].map(option => <button key={option.value} type="button" aria-pressed={boxSizeMarketCapRatio === option.value} onClick={() => onChangeBoxSizeMarketCapRatio(option.value)} className={`${SETTING_CHIP_CLASS} ${boxSizeMarketCapRatio === option.value ? 'bg-brand-surface text-ui-white' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>)}
            </div>
          </SettingRow>
          <SettingRow label="분류 기준">
            <div role="radiogroup" aria-label="분류 기준" className="grid flex-1 grid-cols-3 gap-1.5">
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
                }} className={`${SETTING_CHIP_CLASS} ${selected ? 'bg-brand-surface text-ui-white' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>
              })}
            </div>
          </SettingRow>
          </div>
        </div>
      </section>
    </main>
  )
}
