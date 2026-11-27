import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useNavigate } from 'react-router-dom'
import { chartSectorPath } from '@/utils/chartSectorPath'
import { useOpenStockChart } from '@/utils/chartRoute'
import MobileSectorMapFrame from '@/components/MobileSectorMapFrame'
import MobileMapShell from '@/components/MobileMapShell'
import { useMobileMapInfoPopup } from '@/hooks/useMobileMapInfoPopup'
import { MOBILE_PATH_CANVAS_ZOOM, mobilePathBarLeftShift } from '@/utils/mobilePathBar'
import PathBar, { type PathCrumb } from '@/components/PathBar'
import MobileMapHeatmapFrame from '@/components/MobileMapHeatmapFrame'
import { MAP_MOBILE_CAPTURE_FRAME_HEIGHT, SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import Spinner, { MOBILE_LOADING_SIZE_CLASS } from '@/components/Spinner'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import type { HeatmapItem } from '@/types/api'
import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { collectAllItems } from '@/hooks/useFilteredHeatmap'
import { changeDirectionOf } from '@/utils/changeDirection'
import { calculateSectorLayoutWeights, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector, type SectorSummary } from '@/utils/sectorAverage'
import { indexSectorsByPath, sectorPathKey } from '@/utils/sectorPath'
import { resolveMobileStockSelection } from '@/utils/mobileStockSelection'
import { captureSwipeArrivalOverlay } from '@/utils/mobileSwipeArrivalOverlay'

import type Heatmap from '@/components/Heatmap'
import MarketToolbarContent from '@/components/MarketToolbarContent'
import MobileStockHeatmap from '@/components/MobileStockHeatmap'
import Toolbar from '@/components/Toolbar'
import type { MobileMapMarket } from '@/utils/mobileMarketRoutes'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import type { MarketColors, MarketScreenData } from '@/markets/marketContract'
import type { marketMenu } from '@/utils/marketMenu'
import type { MarketValueExclusions } from '@/utils/marketValueTier'

// 주식 지도에 그리는 종목 수(시가총액 상위) — 설정에서 고르지 않고 고정한다.
const STOCK_MAP_COUNT = 30
const MOBILE_DECIMAL_PLACES = 1
type MobileSectorItem = MobileSectorMapItem & {
  node: FilteredHeatmapSectorNode | null
  stocks: HeatmapItem[]
  simpleAvg?: number | null
  advancers?: number
  decliners?: number
  unchanged?: number
  isDirectStocks?: boolean
}

// 모바일 지도 전용 업종 집계로 수치와 박스 면적을 만든다. `stocks`는 현재 분류 트리에서 볼 종목들이다.
function toMobileSectorItem(node: FilteredHeatmapSectorNode, path: string, summary: SectorSummary | null): MobileSectorItem | null {
  if (!summary || summary.marketValue <= 0) return null
  const stocks = collectAllItems(node)
  return {
    key: path,
    name: node.sectorName,
    marketValue: summary.marketValue,
    changeRate: summary.weightedAvg,
    simpleAvg: summary.simpleAvg,
    advancers: summary.advancers,
    decliners: summary.decliners,
    unchanged: summary.unchanged,
    node,
    stocks,
  }
}

function toDirectStocksItem(stocks: HeatmapItem[], parentPath: string): MobileSectorItem | null {
  if (!stocks.length) return null
  const marketValue = stocks.reduce((sum, stock) => sum + stock.totalMarketValue, 0)
  if (marketValue <= 0) return null
  return {
    key: `${parentPath}>direct-stocks`,
    name: '나머지',
    marketValue,
    changeRate: stocks.reduce((sum, stock) => sum + stock.changeRate * stock.totalMarketValue, 0) / marketValue,
    advancers: stocks.filter(stock => changeDirectionOf(stock.changeRate) === 'up').length,
    decliners: stocks.filter(stock => changeDirectionOf(stock.changeRate) === 'down').length,
    unchanged: stocks.filter(stock => changeDirectionOf(stock.changeRate) === 'flat').length,
    node: null,
    stocks,
    isDirectStocks: true,
  }
}

export interface MobileMarketData {
  market: MarketScreenData
  // 같은 시장 안의 구분(코스피·코스닥 등). 바뀌면 열어 둔 업종 단계를 처음으로 돌린다.
  scope: string
  filteredNodes: FilteredHeatmapSectorNode[]
  excludedTiers: MarketValueExclusions
  // 눌러서 들어갈 수 있는 분류 단계 수.
  selectableDepth: number
  // 지수를 받거나 다시 받는 중. 막대와 지수를 함께 그리려고 기다린다.
  isIndexPending: boolean
  colors: Pick<MarketColors, 'colorScale' | 'strongIndustryColor'>
  // 종목 지도로 스와이프할 때 따라올 미리보기. 박스 크기는 이 화면이 넣는다.
  mapPreview: Omit<ComponentProps<typeof Heatmap>, 'boxSizeMarketCapRatio' | 'heightClassName' | 'onSelectSector' | 'onExcludeSector' | 'selfSectorName' | 'depth' | 'zoomOutRequestDepth' | 'onZoomOutComplete' | 'canExclude' | 'stockPopupOnHover'>
  routes: { summary: string; graph: string; map: string }
  menus: { summary: ReturnType<typeof marketMenu>; graph: ReturnType<typeof marketMenu> }
  sheetMarket: MobileMapMarket
  chartMarket: 'korea' | 'japan' | 'usa'
  onSelectIndex: ((key: string) => void) | null
}

// 모든 시장의 MOBILE 업종 지도(sector)와 그룹 등락률(graph). 시장 이름을 보고 갈라지지 않는다.
// MOBILE 업종 지도·그룹 등락률의 단계(대분류·중분류·종목 선택과 보기 모드)를 기록 칸에 적어 두는 모양.
interface SavedMobileView {
  majorSelection: { scope: string; name: string } | null
  midSelection: { scope: string; name: string } | null
  stockSelection: { scope: string; key: string; categoryName: string } | null
  graphEntryOffset: number
  viewMode: 'sector' | 'stock'
  depth: number
}
function readSavedMobileView(): SavedMobileView | null {
  if (typeof window === 'undefined') return null
  const saved: unknown = window.history.state?.mobileMapView
  if (!saved || typeof saved !== 'object') return null
  const view = saved as SavedMobileView
  return typeof view.depth === 'number' && (view.viewMode === 'sector' || view.viewMode === 'stock') && view.depth > 0 ? view : null
}

export default function MobileMarketScreen({ mode, data }: { mode: 'sector' | 'graph'; data: MobileMarketData }) {
  const { market, scope, filteredNodes, excludedTiers, selectableDepth, isIndexPending, mapPreview, routes, menus, sheetMarket, chartMarket, onSelectIndex } = data
  const { colorScale, strongIndustryColor } = data.colors
  const { tree: rootNodes, label: marketLabel, indexBars, state, currencyUnit } = market
  const isGraph = mode === 'graph'
  // 화면 확대 차단은 공통 셸(MobileMapShell)이 zoomMode로 관리한다. 종목 지도는 확대한 화면 안을 이동할 수 있다.
  const navigate = useNavigate()
  const frameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const pageContentRef = useRef<HTMLElement>(null)
  // 종목 지도로 넘어갈 때 덮개로 남길 미리보기 판.
  const swipePreviewCanvasRef = useRef<HTMLDivElement>(null)
  // 종목 차트 화면 등 다른 화면에 갔다가 뒤로가기로 돌아오면, 그 기록 칸에 적어 둔 단계(mobileMapView)로 다시 연다(2026-11-27).
  const [savedView] = useState(readSavedMobileView)
  const [majorSelection, setMajorSelection] = useState<{ scope: string; name: string } | null>(savedView?.majorSelection ?? null)
  const [midSelection, setMidSelection] = useState<{ scope: string; name: string } | null>(savedView?.midSelection ?? null)
  const [stockSelection, setStockSelection] = useState<{ scope: string; key: string; categoryName: string } | null>(savedView?.stockSelection ?? null)
  const [graphEntryOffset, setGraphEntryOffset] = useState(savedView?.graphEntryOffset ?? 0)
  // 모바일 화면 설정은 저장 버튼 없이 이 브라우저에 바로 기억한다. 분류 모드와 상관없이 공통이다(화면 취향은 브라우저 저장, 2026-10-03 결정).
  const [graphDepth] = useLocalPersistedState<number>('mobile.graphDepth', 1)
  const [viewMode, setViewMode] = useState<'sector' | 'stock'>(savedView?.viewMode ?? 'sector')
  const { popup: infoPopup, close: closeInfoPopup, openStockPopup: openStockPopupBase, openSectorPopup: openSectorPopupBase } = useMobileMapInfoPopup({ currencyUnit, mapBoundsRef: pageContentRef })
  // 박스 크기는 PC 설정과 따로 두고, MOBILE의 기본은 시총 비례(100)다. 동일 0 · 균형 50 · 시총 비례 100.
  const [storedBoxSizeMarketCapRatio, onChangeBoxSizeMarketCapRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  useCarriedBoxSize(onChangeBoxSizeMarketCapRatio)
  const boxSizeMarketCapRatio = normalizeMobileBoxSizeRatio(storedBoxSizeMarketCapRatio)
  const majorName = majorSelection?.scope === scope ? majorSelection.name : null
  const midName = midSelection?.scope === scope ? midSelection.name : null
  const stockCategoryName = stockSelection?.scope === scope ? stockSelection.categoryName : null
  const setMajorName = (name: string | null) => setMajorSelection(name ? { scope, name } : null)
  const setMidName = (name: string | null) => setMidSelection(name ? { scope, name } : null)
  const setSelectedStocks = (item: MobileSectorItem | null) => setStockSelection(item ? { scope, key: item.key, categoryName: item.name } : null)
  const major = majorName ? filteredNodes.find(node => node.sectorName === majorName) ?? null : null
  const mid = major && midName ? major.children.find(node => node.sectorName === midName) ?? null : null

  // 모바일 업종 집계는 선택 필터에 잘리기 전 원본 트리를 기준으로 찾는다. 거래소 업종은 모든 sectorId가 0이라 id로 찾지 않는다.
  const originalSectorsByPath = useMemo(() => indexSectorsByPath(rootNodes), [rootNodes])

  const marketItems = useMemo(() => {
    const summaryOf = (path: string) => {
      const original = originalSectorsByPath.get(path)
      return original ? summarizeSector(original, excludedTiers) : null
    }
    const parent = mid ?? major
    if (isGraph && !parent && graphDepth > 1 && selectableDepth > 1) {
      const effectiveGraphDepth = Math.min(graphDepth, selectableDepth)
      return collectAtDepth(filteredNodes, effectiveGraphDepth, new Set<number>(), new Set<string>(), effectiveGraphDepth < 3)
        .map(({ node, pathKey }) => toMobileSectorItem(node as FilteredHeatmapSectorNode, pathKey, summaryOf(pathKey)))
        .filter((item): item is MobileSectorItem => item !== null)
    }
    if (parent && (mid || selectableDepth >= 2)) {
      const children = parent.children
        .map(node => {
          const parentPath = mid ? sectorPathKey(major?.sectorName ?? '', mid.sectorName) : parent.sectorName
          const path = sectorPathKey(parentPath, node.sectorName)
          return toMobileSectorItem(node, path, summaryOf(path))
        })
        .filter((item): item is MobileSectorItem => item !== null)
      const directItems = toDirectStocksItem(parent.items, parent.sectorName)
      return directItems ? [...children, directItems] : children
    }
    return filteredNodes
      .map(node => toMobileSectorItem(node, node.sectorName, summaryOf(node.sectorName)))
      .filter((item): item is MobileSectorItem => item !== null)
  }, [selectableDepth, filteredNodes, originalSectorsByPath, excludedTiers, major, mid, isGraph, graphDepth])

  // 선택은 업종 키로 유지하고, 종목은 매번 갱신된 트리에서 찾는다. 없어진 업종은 빈 목록으로 표시한다.
  const selectedStocks = resolveMobileStockSelection(stockSelection, scope, marketItems)

  const mapItems: MobileSectorMapItem[] = useMemo(() => {
    const layoutWeights = calculateSectorLayoutWeights(marketItems, boxSizeMarketCapRatio)
    return marketItems.map(({ key, name, marketValue, changeRate }, index) => ({
      key, name, marketValue, layoutValue: layoutWeights[index], changeRate,
    }))
  }, [boxSizeMarketCapRatio, marketItems])
  const stockScope = mid ?? major
  const stockContextItems = useMemo(() => {
    const stocks = selectedStocks ?? (stockScope ? collectAllItems(stockScope) : filteredNodes.flatMap(collectAllItems))
    return [...stocks].sort((a, b) => b.totalMarketValue - a.totalMarketValue)
  }, [filteredNodes, selectedStocks, stockScope])
  const stockHeatmapItems = stockContextItems.slice(0, STOCK_MAP_COUNT)
  const openStockPopup = (stock: HeatmapItem, target: HTMLElement) => openStockPopupBase({
    key: stock.stockCode, name: stock.stockName, changeRate: stock.changeRate,
    currentPrice: stock.currentPrice, marketValue: stock.totalMarketValue,
  }, target, MOBILE_DECIMAL_PLACES)
  const openSectorPopup = (item: MobileSectorMapItem & Partial<MobileSectorItem>, target: HTMLElement) => openSectorPopupBase(item, target, MOBILE_DECIMAL_PLACES)
  // 위쪽 경로 — PC 지도 화면과 같다: 앞 단계는 이름 오른쪽에 ↩ 아이콘이 붙은 버튼(누르면 그 단계로 되돌아감), 마지막(현재 위치)은 강조색 글씨다.
  const pathCrumbs: { key: string; label: string; go: (() => void) | null }[] = [
    { key: 'market', label: marketLabel, go: major || mid || selectedStocks ? () => { setMajorName(null); setMidName(null); setSelectedStocks(null); setGraphEntryOffset(0); setViewMode('sector') } : null },
    ...(major && (!isGraph || graphEntryOffset < 1) ? [{ key: 'major', label: major.sectorName, go: mid || selectedStocks ? () => { setMidName(null); setSelectedStocks(null); setViewMode('sector') } : null }] : []),
    ...(mid && (!isGraph || graphEntryOffset < 2) ? [{ key: 'mid', label: mid.sectorName, go: selectedStocks ? () => { setSelectedStocks(null); setViewMode('sector') } : null }] : []),
    ...(stockCategoryName ? [{ key: 'stock', label: stockCategoryName, go: null }] : []),
  ]
  // 업종 지도와 그룹 등락률이 같은 경로 줄을 쓴다.
  // MOBILE 판 안에서만 맨 앞 막대를 위 툴바 첫 배지 왼쪽에 맞춘다(세로는 그대로).
  const pathBarLeftShift = mobilePathBarLeftShift(4)
  const mobilePathCrumbs: PathCrumb[] = pathCrumbs.map(crumb => crumb.go
    ? { key: crumb.key, label: crumb.label, onClick: crumb.go }
    : { key: crumb.key, label: crumb.label, current: true })
  // 종목 단계에서 누르면 종목 지도와 같은 차트를 연다.
  const openChartPage = useOpenStockChart()
  const openStockChart = (stock: HeatmapItem) => {
    closeInfoPopup()
    openChartPage(chartMarket, { code: stock.stockCode, name: stock.stockName }, { sectorPath: chartSectorPath(mobilePathCrumbs), marketLabel })
  }
  const pathNav = (
    <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${pathBarLeftShift}px)` }}>
      <PathBar
        variant="mobile"
        currentAria="location"
        accentColor={strongIndustryColor}
        crumbs={mobilePathCrumbs}
      />
    </header>
  )
  // 경로 줄도 그래프 글자와 같은 판 기준 값으로 그린다. 810px 판의 16px·32px가 390px MOBILE에서 화면 16px·32px로 보인다.
  // 셸의 스와이프 대상 밖에 두면 다음 페이지 미리보기에 이 자리가 비어 당겨지는 동안 빈 띠가 보인다.
  const renderPathNav = () => <div style={{ zoom: MOBILE_PATH_CANVAS_ZOOM }}>{pathNav}</div>

  const selectSector = (name: string) => {
    const selected = marketItems.find(item => item.name === name)
    if (!selected) return
    if (isGraph && !major && !mid && graphDepth > 1 && selected.node) {
      const path = selected.key.split('>')
      if (path.length > 1) {
        setMajorName(path[0])
        if (path.length > 2) setMidName(path[1])
        const hasChildren = selected.node.children.length > 0
        if (hasChildren && path.length === 2) setMidName(path[1])
        else { setSelectedStocks(selected); setViewMode('stock') }
        setGraphEntryOffset(path.length - 1)
        return
      }
    }
    if (selected.isDirectStocks) {
      setSelectedStocks(selected)
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
    setSelectedStocks(selected)
    setViewMode('stock')
  }
  // 시장·업종 경로·보기 모드를 셸에 알린다. 팝업 닫기는 셸이 이 신호로 한 곳에서 처리한다.
  const popupNavigationKey = `${scope}|${majorName ?? ''}|${midName ?? ''}|${stockSelection ? 'stock' : ''}|${viewMode}`

  // 들어간 단계 = 브라우저 기록 한 칸(PC 지도 화면과 같은 방식). 대분류·중분류·종목으로 한 단계 들어갈 때마다 칸을 쌓아서
  // 뒤로가기가 사이트를 떠나지 않고 한 단계씩 위로 올라가게 한다. 전체 화면에서 한 번 더 누르면 원래대로 이전 페이지로 나간다.
  const depth = Math.max(0, (major ? 1 : 0) + (mid ? 1 : 0) + (selectedStocks ? 1 : 0) - (isGraph ? graphEntryOffset : 0))
  // 돌아와 단계를 다시 연 경우는 기록 칸이 이미 그 깊이만큼 쌓여 있다.
  const historyDepthRef = useRef(savedView?.depth ?? 0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyLocationRef = useRef(savedView ? window.location.pathname + window.location.search : '') // 칸을 쌓은 주소(시장이 바뀌어 주소가 달라졌으면 go()로 정리하지 않는다)
  const historyNormalizedRef = useRef(false)
  const reduceToDepth = (target: number) => {
    if (isGraph && target === 0 && graphEntryOffset > 0) {
      setMajorSelection(null); setMidSelection(null); setStockSelection(null); setGraphEntryOffset(0); setViewMode('sector')
      return
    }
    let current = depth
    if (current > target && selectedStocks) { setStockSelection(null); setViewMode('sector'); current -= 1 }
    if (current > target && mid) { setMidSelection(null); current -= 1 }
    if (current > target && major) { setMajorSelection(null); setViewMode('sector') }
  }
  useEffect(() => {
    // 다른 페이지에 갔다가 뒤로가기로 돌아왔는데 칸에 적어 둔 단계가 없으면(예전 기록) 화면은 처음 상태라, 칸을 걷어 내 기준 칸으로 돌아간다.
    // 단계가 적혀 있으면 그 단계로 이미 다시 열었으므로 칸을 그대로 둔다.
    if (historyNormalizedRef.current) return
    historyNormalizedRef.current = true
    if (savedView) return
    const stacked = window.history.state?.mobileMapDepth
    if (typeof stacked === 'number' && stacked > 0) {
      historyConsumingRef.current = true
      window.history.go(-stacked)
    }
  }, [savedView])
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
  // 지금 단계를 지금 기록 칸에 적어 둔다 — 다른 화면에 갔다가 돌아오면 이 값으로 다시 연다(위 칸 쌓기 다음에 실행돼 맨 위 칸에 적힌다).
  useEffect(() => {
    const view: SavedMobileView = { majorSelection, midSelection, stockSelection, graphEntryOffset, viewMode, depth }
    window.history.replaceState({ ...(window.history.state ?? {}), mobileMapView: view }, '')
  }, [majorSelection, midSelection, stockSelection, graphEntryOffset, viewMode, depth])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        return
      }
      // 이 지도 화면 안에서의 이동만 다룬다 — 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      const path = window.location.pathname
      if (!path.startsWith('/map/') && !path.startsWith('/graph/') && !path.startsWith('/summary/')) return
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

  const graphItems: MobileGraphItem[] = viewMode === 'stock'
    ? stockContextItems.map(stock => ({ key: stock.stockCode, name: stock.alias ?? stock.stockName, value: stock.changeRate, onSelect: () => openStockChart(stock) }))
    : marketItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate, onSelect: () => selectSector(item.name) }))
  const isError = state.status === 'error'
  const refetch = state.status === 'error' ? state.retry : undefined
  // 지수 막대가 다른 조회에서 오므로 지수까지 준비된 뒤 한 번에 그린다. 다시 받는 중에도 값이 바뀌며 줄이 밀리지 않게 기다린다.
  const isLoading = state.status === 'loading' || (isGraph && !isError && isIndexPending)
  const referenceItems: MobileGraphItem[] = indexBars.flatMap(bar => bar.value === null ? [] : [{ key: bar.key, name: bar.name, value: bar.value, reference: true }])
  if (isGraph && !major && !mid && viewMode === 'sector') graphItems.push(...referenceItems.map(item => onSelectIndex ? { ...item, onSelect: () => onSelectIndex(item.key) } : item))
  const swipeGraphItems: MobileGraphItem[] = [...mapItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate })), ...referenceItems]

  // 왼쪽으로 밀면 업종 지도 → 그룹 등락률 → 종목 지도, 오른쪽으로 밀면 그 반대다.
  const swipeTarget = (direction: 'next' | 'previous'): 'stock' | 'sector' | 'graph' => isGraph
    ? (direction === 'next' ? 'stock' : 'sector')
    : (direction === 'next' ? 'graph' : 'stock')
  const routeForMode = (targetMode: 'stock' | 'sector' | 'graph') => targetMode === 'stock' ? routes.map : targetMode === 'sector' ? routes.summary : routes.graph
  // 그룹 등락률 미리보기는 지수까지 준비된 뒤에 그린다. 지도에서는 지수 조회가 화면 로딩에 포함되지 않으므로
  // 미리보기에서 따로 기다리지 않으면 막대만 먼저 뜨고 지수가 뒤따라온다.
  const isGraphPreviewLoading = isLoading || isIndexPending
  const renderSwipePreview = (targetMode: 'stock' | 'sector' | 'graph') => targetMode === 'graph'
    ? isGraphPreviewLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
      : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetch} /></div>
        : <MobileGraphBars items={swipeGraphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />
    : targetMode === 'stock'
      ? isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
        : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetch} /></div>
          : mapPreview.groups.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p>
            // 종목 지도 도착지는 MapScreen의 8px MOBILE 판이다. 예전처럼 4px 판으로 그리면 전환이 끝날 때 지도가 한 번 커져 보인다.
            : <div ref={swipePreviewCanvasRef} style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${frameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
                <div className="flex h-full min-h-0 flex-col bg-ui-background">
                  <MobileMapHeatmapFrame
                    path={[]}
                    marketLabel={marketLabel}
                    strongIndustryColor={strongIndustryColor}
                    heatmapProps={{ ...mapPreview, selfSectorName: null, depth: 0, onSelectSector: () => {}, onExcludeSector: () => {}, heightClassName: 'min-h-0 flex-1', boxSizeMarketCapRatio, canExclude: false, stockPopupOnHover: false, zoomOutRequestDepth: null, onZoomOutComplete: () => {} }}
                  />
                </div>
              </div>
      : isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
        : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetch} /></div>
          : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p>
            : <div className="relative flex h-full min-h-0 flex-col bg-ui-surface"><MobileSectorMap items={mapItems} colorScale={colorScale} onSelect={() => undefined} decimalPlaces={MOBILE_DECIMAL_PLACES} /></div>

  // 스와이프 자체는 공통 셸이 맡는다. 종목 지도는 도착지와 같은 8px 판, 업종 지도는 공통 업종 지도 판, 그룹 등락률은 이 화면과 같은 4px 판으로 그린다.
  const frameStyle = { width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${frameScale})`, transformOrigin: 'top left' } as const
  const swipePreview = (direction: 'next' | 'previous') => {
    const targetMode = swipeTarget(direction)
    if (targetMode === 'stock') return renderSwipePreview(targetMode)
    if (targetMode === 'sector') {
      return (
        <MobileSectorMapFrame scale={frameScale} crumbs={[{ key: 'market', label: marketLabel, current: true }]}>
          {renderSwipePreview(targetMode)}
        </MobileSectorMapFrame>
      )
    }
    return (
      <div className="flex flex-col" style={frameStyle}>
        <div className="relative min-h-0 flex-1 overflow-hidden p-1">
          <div className="flex h-full flex-col">
            {renderPathNav()}
            <div className="min-h-0 flex-1">{renderSwipePreview(targetMode)}</div>
          </div>
        </div>
      </div>
    )
  }

  // 업종 지도와 그룹 등락률은 같은 판 양식(상단 줄·툴바·가운데 판·하단 설정 줄)을 쓴다.
  return (
      <>
      <MobileMapShell
        zoomMode="blocked"
        infoPopup={infoPopup}
        onCloseInfoPopup={closeInfoPopup}
        navigationKey={popupNavigationKey}
        onSwipe={direction => navigate(routeForMode(swipeTarget(direction)))}
        onBeforeSwipeNavigate={direction => { if (swipeTarget(direction) === 'stock') captureSwipeArrivalOverlay(swipePreviewCanvasRef.current) }}
        nextPreview={() => swipePreview('next')}
        previousPreview={() => swipePreview('previous')}
        pageTitle={isGraph ? 'GRAPH' : 'SECTOR'}
        boxSizeDisabled={isGraph}
        toolbar={
          <Toolbar><MarketToolbarContent page={isGraph ? 'GRAPH' : 'SUMMARY'} market={market} menu={isGraph ? menus.graph : menus.summary} right={null} /></Toolbar>
        }
        frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * frameScale}
        frame={<div className="flex flex-col" style={frameStyle}>
      <section
        ref={pageContentRef}
        aria-label={isGraph ? (viewMode === 'sector' ? '업종 등락률 그래프' : '종목 등락률 그래프') : (viewMode === 'sector' ? '업종 히트맵' : '주식 히트맵')}
        className="relative min-h-0 flex-1 touch-pan-y overflow-hidden"
      >
        <div className="absolute inset-0 p-1">
        <div className="flex h-full flex-col">
        {!isLoading && !isError && renderPathNav()}
        <div className="min-h-0 flex-1">
        {isLoading ? <div className="flex h-full items-center justify-center"><Spinner delayReveal showElapsed className={MOBILE_LOADING_SIZE_CLASS} /></div>
          : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetch} /></div>
            : isGraph ? <MobileGraphBars items={graphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />
            : viewMode === 'stock' ? stockHeatmapItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p> : <MobileStockHeatmap stocks={stockHeatmapItems} boxSizeRatio={boxSizeMarketCapRatio} colorScale={colorScale} decimalPlaces={MOBILE_DECIMAL_PLACES} onSelect={openStockChart} onLongPress={(stock, target) => openStockPopup(stock, target)} />
            : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p> : <div className="relative flex h-full min-h-0 flex-col bg-ui-surface"><MobileSectorMap items={mapItems} colorScale={colorScale} onSelect={selectSector} onLongPress={(item, target) => openSectorPopup(marketItems.find(sector => sector.key === item.key) ?? item, target)} decimalPlaces={MOBILE_DECIMAL_PLACES} /></div>}
        </div>
        </div>
        </div>
      </section>
        </div>}
        current={sheetMarket}
        boxSize={boxSizeMarketCapRatio}
        onChangeBoxSize={onChangeBoxSizeMarketCapRatio}
      />
      </>
  )
}
