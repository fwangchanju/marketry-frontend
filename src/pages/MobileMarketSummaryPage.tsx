import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import MobileTopBar from '@/components/MobileTopBar'
import PhonePathStockChart from '@/components/PhonePathStockChart'
import { chartSectorPath } from '@/utils/chartSectorPath'
import { useStockChart } from '@/hooks/useStockChart'
import PhoneSectorMapFrame from '@/components/PhoneSectorMapFrame'
import PhoneMapShell from '@/components/PhoneMapShell'
import { usePhoneMapInfoPopup } from '@/hooks/usePhoneMapInfoPopup'
import { PHONE_PATH_CANVAS_ZOOM, phonePathBarLeftShift } from '@/utils/phonePathBar'
import PathBar, { type PathCrumb } from '@/components/PathBar'
import MapToolbar from '@/components/MapToolbar'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import { SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import MobileMapHeatmapFrame from '@/components/MobileMapHeatmapFrame'
import { MAP_MOBILE_CAPTURE_FRAME_HEIGHT, SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import Spinner, { MOBILE_LOADING_SIZE_CLASS } from '@/components/Spinner'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useLongPress } from '@/hooks/useLongPress'
import { IDENTITY, panTransform, pinchTransform, type Point, type ZoomTransform } from '@/utils/mapZoom'
import type { HeatmapItem } from '@/types/api'
import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { collectAllItems } from '@/hooks/useFilteredHeatmap'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { useFontsVersion } from '@/utils/stockLabelFit'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { changeDirectionOf } from '@/utils/changeDirection'
import { toPctSigned } from '@/utils/format'
import { calculateSectorLayoutWeights, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import { mapStretchFor, mapTileMethod } from '@/utils/mapStretch'
import { limitDepth } from '@/hooks/useFilteredHeatmap'
import { toDisplayGroup } from '@/utils/mobileMapHeatmap'
import type { MarketQuery } from '@/types/api'
import { marketRoute } from '@/utils/marketRoute'
import { collectAtDepth, isInDepthRange } from '@/utils/sectorDepth'
import { summarizeSector, type SectorSummary } from '@/utils/sectorAverage'
import { indexSectorsByPath, sectorPathKey } from '@/utils/sectorPath'
import { resolveMobileStockSelection } from '@/utils/mobileStockSelection'
import { captureSwipeArrivalOverlay } from '@/utils/mobileSwipeArrivalOverlay'

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

function stockLayoutValue(stock: HeatmapItem, ratio: number) {
  return ratio <= 0 ? 1 : Math.pow(Math.max(stock.totalMarketValue, 0), ratio / 100)
}

function MobileStockHeatmap({ stocks, boxSizeRatio, colorScale, decimalPlaces, onSelect, onLongPress }: {
  stocks: HeatmapItem[]
  boxSizeRatio: number
  colorScale: ReturnType<typeof useGlobalSettings>['colorScale']
  decimalPlaces: number
  onSelect: (stock: HeatmapItem) => void
  // 길게 누르면 눌린 칸과 함께 PC용 팝업을 연다.
  onLongPress: (stock: HeatmapItem, target: HTMLElement) => void
}) {
  const { bind: bindLongPress, consumeClick } = useLongPress()
  const ref = useRef<HTMLDivElement>(null)
  const fontsVersion = useFontsVersion() // 글꼴이 늦게 로드돼 글자 폭이 달라지면 이름을 다시 맞추려고 다시 그리게 한다.
  const [size, setSize] = useState({ width: 0, height: 0 })
  // 두 손가락으로 확대하고 한 손가락으로 이동한다. 박스는 확대한 좌표·크기로 다시 놓아서, 커진 박스에는 이름이 새로 들어간다.
  // 종목 구성이 바뀌면(다른 업종·마켓으로 이동) 확대를 풀고 처음 크기로 돌아간다 — 확대 값에 그때의 종목 구성을 함께 적어 두고, 다르면 처음 크기로 본다.
  const stocksSignature = useMemo(() => stocks.map(stock => stock.stockCode).join(','), [stocks])
  const [zoomState, setZoomState] = useState<{ signature: string; transform: ZoomTransform }>({ signature: '', transform: IDENTITY })
  const zoom = zoomState.signature === stocksSignature ? zoomState.transform : IDENTITY
  const setZoom = (transform: ZoomTransform) => setZoomState({ signature: stocksSignature, transform })
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<{ start: ZoomTransform; origin: Point; distance: number } | null>(null)
  const suppressClickRef = useRef(false)
  const localPoint = (event: React.PointerEvent<HTMLElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const beginGesture = () => {
    const points = [...pointersRef.current.values()]
    const start = zoom
    if (points.length >= 2) {
      gestureRef.current = { start, origin: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) }
    } else if (points.length === 1) {
      gestureRef.current = { start, origin: points[0], distance: 0 }
    } else {
      gestureRef.current = null
    }
  }
  const handleZoomPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (pointersRef.current.size === 0) suppressClickRef.current = false
    pointersRef.current.set(event.pointerId, localPoint(event))
    if (pointersRef.current.size >= 2) suppressClickRef.current = true
    beginGesture()
  }
  const handleZoomPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return
    pointersRef.current.set(event.pointerId, localPoint(event))
    const gesture = gestureRef.current
    if (!gesture) return
    const points = [...pointersRef.current.values()]
    if (points.length >= 2 && gesture.distance > 0) {
      suppressClickRef.current = true
      const mid = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      setZoom(pinchTransform(gesture.start, gesture.distance, gesture.origin, Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), mid, size.width, size.height))
    } else if (points.length === 1 && gesture.start.scale > 1) {
      const dx = points[0].x - gesture.origin.x
      const dy = points[0].y - gesture.origin.y
      if (suppressClickRef.current || Math.hypot(dx, dy) > 8) {
        suppressClickRef.current = true
        setZoom(panTransform(gesture.start, dx, dy, size.width, size.height))
      }
    }
  }
  const handleZoomPointerEnd = (event: React.PointerEvent<HTMLElement>) => {
    pointersRef.current.delete(event.pointerId)
    // 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 이동한다.
    beginGesture()
  }
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
    const layoutRoot: HierarchyRectangularNode<typeof root.data> = treemap<typeof root.data>().tile(treemapSquarify).size([size.width, size.height]).paddingInner(0)(root)
    return layoutRoot.leaves().map(leaf => ({
      stock: (leaf.data as { stock: HeatmapItem }).stock,
      x: leaf.x0,
      y: leaf.y0,
      width: leaf.x1 - leaf.x0,
      height: leaf.y1 - leaf.y0,
    }))
  }, [boxSizeRatio, size, stocks])

  return (
    <div ref={ref} data-mobile-map-scale={zoom.scale} onPointerDown={handleZoomPointerDown} onPointerMove={handleZoomPointerMove} onPointerUp={handleZoomPointerEnd} onPointerCancel={handleZoomPointerEnd} onClickCapture={event => { if (suppressClickRef.current) { suppressClickRef.current = false; event.stopPropagation() } }} style={{ touchAction: 'none' }} className="relative h-full min-h-0 w-full overflow-hidden bg-ui-surface p-1">
      {boxes.map(box => {
        const { stock } = box
        const x = box.x * zoom.scale + zoom.x + 1
        const y = box.y * zoom.scale + zoom.y + 1
        const width = box.width * zoom.scale - 2
        const height = box.height * zoom.scale - 2
        // 화면 밖으로 나간 박스는 그리지 않는다.
        if (x + width < 0 || y + height < 0 || x > size.width || y > size.height) return null
        const color = resolveHeatmapColor(stock.changeRate, colorScale)
        // 확대된 박스 전체 크기에 업종 지도와 같은 글자 계산을 적용한다. 화면에 잘린 조각은 별도로 기준 삼지 않는다.
        const name = stock.alias ?? stock.stockName
        const rateText = toPctSigned(stock.changeRate, decimalPlaces)
        const label = layoutOverviewLabel(name, rateText, width, height, fontsVersion, { splitInsideWord: true })
        const press = bindLongPress(target => onLongPress(stock, target))
        return (
          <button key={stock.stockCode} type="button" aria-label={`${stock.stockName} ${toPctSigned(stock.changeRate, decimalPlaces)}`} onClick={() => { if (!consumeClick()) onSelect(stock) }} {...press} className="select-none [-webkit-touch-callout:none] absolute flex flex-col items-center justify-center overflow-hidden border-0 p-0.5 text-center leading-tight text-white" style={{ left: x, top: y, width, height, backgroundColor: color }}>
            {label.lines.length > 0 && <span className="max-w-full overflow-hidden font-medium" style={{ fontSize: label.nameSize }}>{label.lines.map((line, index) => <span key={index} className="block whitespace-nowrap">{line}</span>)}</span>}
            {label.rateSize !== null && <span className="tabular-nums" style={{ fontSize: label.rateSize }}>{rateText}</span>}
          </button>
        )
      })}
      {zoom.scale > 1.05 && <button type="button" onClick={() => setZoom(IDENTITY)} className="absolute bottom-2 left-2 z-10 h-[32px] rounded-[4px] border-0 bg-ui-panel/95 px-3 text-[13px] font-medium text-ui-white shadow-lg">원래 크기</button>}
    </div>
  )
}

// sector = 업종 분류 지도(`/summary/korea`), graph = 그룹 등락률(`/graph/...`).
export default function MobileMarketSummaryPage({ mode }: { mode: 'sector' | 'graph' }) {
  const isGraph = mode === 'graph'
  // 화면 확대 차단은 공통 셸(PhoneMapShell)이 zoomMode로 관리한다. 종목 지도는 확대한 화면 안을 이동할 수 있다.
  // 지도 화면에서도 지수를 미리 받아 둔다. 지도에서 그룹 등락률로 스와이프할 때 지수가 도착 뒤에야 조회되면
  // 미리보기와 전환 순간에 지수만 비어 보인다(2026-11-22 사용자 제보).
  const { data: marketSummary, isLoading: isMarketSummaryLoading, isFetching: isMarketSummaryFetching } = useMarketSummary()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const frameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const pageContentRef = useRef<HTMLElement>(null)
  // 종목 지도로 넘어갈 때 덮개로 남길 미리보기 판.
  const swipePreviewCanvasRef = useRef<HTMLDivElement>(null)
  const {
    market,
    taxonomy,
    data,
    isLoading: isBaseLoading,
    isError,
    refetchHeatmap,
    filteredRootNodes,
    rootNodes,
    excludedMarketValueTiers,
    colorScale,
    strongIndustryColor,
    marketValueDepthRange,
    weightedAvgDepthRange,
    simpleAvgDepthRange,
    upDownCountDepthRange,
    topPickSectorKeys,
    boxLabelMinAreaPercent,
    stockLabelMode,
    maxDepth,
    changeRateMode,
    changeRateChoice,
    pinnedSnapshotTime,
    rangeStartTime,
    isAfterHoursControlsVisible,
    isAfterHoursSelectable,
    onChangeChangeRateMode,
    liveSnapshotTime,
    onChangePinnedSnapshotTime,
    onSelectRange,
    rangeExcludedStocks,
    isRefetchingHeatmap,
  } = useGlobalSettings({ allowChangeRateMode: true, defaultTaxonomy: 'MARKETRY', taxonomyStorageKey: 'mobile.taxonomySelection' })
  const [majorSelection, setMajorSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [midSelection, setMidSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [stockSelection, setStockSelection] = useState<{ market: MarketQuery; key: string; categoryName: string } | null>(null)
  const [graphEntryOffset, setGraphEntryOffset] = useState(0)
  // 모바일 화면 설정은 저장 버튼 없이 이 브라우저에 바로 기억한다. 분류 모드와 상관없이 공통이다(화면 취향은 브라우저 저장, 2026-10-03 결정).
  const [graphDepth] = useLocalPersistedState<number>('mobile.graphDepth', 1)
  const [viewMode, setViewMode] = useState<'sector' | 'stock'>('sector')
  // 업종·종목 칸 팝업은 해외 화면과 같은 공통 훅을 쓴다. 지도 경계는 이 페이지의 판을 기준으로 잡는다.
  const { popup: infoPopup, close: closeInfoPopup, openStockPopup: openStockPopupBase, openSectorPopup: openSectorPopupBase } = usePhoneMapInfoPopup({ currencyUnit: '원', mapBoundsRef: pageContentRef })
  // 분류 단계: MARKETRY·내 기준은 대·중·소분류(3단계), 거래소는 1단계. 눌러서 들어갈 때 하위 분류가 있으면 그 분류로, 없으면 바로 종목으로 간다.
  // 박스 크기는 PC 설정과 따로 두고, 폰의 기본은 시총 비례(100)다. 동일 0 · 균형 50 · 시총 비례 100.
  const [storedBoxSizeMarketCapRatio, onChangeBoxSizeMarketCapRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  const boxSizeMarketCapRatio = normalizeMobileBoxSizeRatio(storedBoxSizeMarketCapRatio)
  // 경로의 맨 앞은 전체일 때 국내 증시, 그 밖에는 고른 마켓 이름이다.
  // 경로 줄 첫 이름은 툴바 배지와 같은 표기를 쓴다(K-STOCK / KOSPI / KOSDAQ).
  const marketLabel = market === 'ALL_STOCK' ? 'K-STOCK' : market === 'KOSPI' ? 'KOSPI' : 'KOSDAQ'
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : 3
  const majorName = majorSelection?.market === market ? majorSelection.name : null
  const midName = midSelection?.market === market ? midSelection.name : null
  const stockCategoryName = stockSelection?.market === market ? stockSelection.categoryName : null
  const setMajorName = (name: string | null) => setMajorSelection(name ? { market, name } : null)
  const setMidName = (name: string | null) => setMidSelection(name ? { market, name } : null)
  const setSelectedStocks = (item: MobileSectorItem | null) => setStockSelection(item ? { market, key: item.key, categoryName: item.name } : null)
  const major = majorName ? filteredRootNodes.find(node => node.sectorName === majorName) ?? null : null
  const mid = major && midName ? major.children.find(node => node.sectorName === midName) ?? null : null

  // 모바일 업종 집계는 선택 필터에 잘리기 전 원본 트리를 기준으로 찾는다. 거래소 업종은 모든 sectorId가 0이라 id로 찾지 않는다.
  const originalSectorsByPath = useMemo(() => indexSectorsByPath(rootNodes), [rootNodes])

  const marketItems = useMemo(() => {
    const summaryOf = (path: string) => {
      const original = originalSectorsByPath.get(path)
      return original ? summarizeSector(original, excludedMarketValueTiers) : null
    }
    const parent = mid ?? major
    if (isGraph && !parent && graphDepth > 1 && selectableDepth > 1) {
      const effectiveGraphDepth = Math.min(graphDepth, selectableDepth)
      return collectAtDepth(filteredRootNodes, effectiveGraphDepth, new Set<number>(), new Set<string>(), effectiveGraphDepth < 3)
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
    return filteredRootNodes
      .map(node => toMobileSectorItem(node, node.sectorName, summaryOf(node.sectorName)))
      .filter((item): item is MobileSectorItem => item !== null)
  }, [selectableDepth, filteredRootNodes, originalSectorsByPath, excludedMarketValueTiers, major, mid, isGraph, graphDepth])

  // 선택은 업종 키로 유지하고, 종목은 매번 갱신된 트리에서 찾는다. 없어진 업종은 빈 목록으로 표시한다.
  const selectedStocks = resolveMobileStockSelection(stockSelection, market, marketItems)

  const mapItems: MobileSectorMapItem[] = useMemo(() => {
    const layoutWeights = calculateSectorLayoutWeights(marketItems, boxSizeMarketCapRatio)
    return marketItems.map(({ key, name, marketValue, changeRate }, index) => ({
      key, name, marketValue, layoutValue: layoutWeights[index], changeRate,
    }))
  }, [boxSizeMarketCapRatio, marketItems])
  const stockScope = mid ?? major
  const stockContextItems = useMemo(() => {
    const stocks = selectedStocks ?? (stockScope ? collectAllItems(stockScope) : filteredRootNodes.flatMap(collectAllItems))
    return [...stocks].sort((a, b) => b.totalMarketValue - a.totalMarketValue)
  }, [filteredRootNodes, selectedStocks, stockScope])
  const stockHeatmapItems = stockContextItems.slice(0, STOCK_MAP_COUNT)
  // 종목·업종 데이터 구조는 한국만 다르므로 여기서 공통 훅이 받는 형태로 맞춘다(행 구성과 토글은 훅이 맡는다).
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
  // 폰 판 안에서만 맨 앞 막대를 위 툴바 첫 배지 왼쪽에 맞춘다(세로는 그대로).
  const pathBarLeftShift = phonePathBarLeftShift(4)
  const phonePathCrumbs: PathCrumb[] = pathCrumbs.map(crumb => crumb.go
    ? { key: crumb.key, label: crumb.label, onClick: crumb.go }
    : { key: crumb.key, label: crumb.label, current: true })
  // 종목 단계에서 누르면 종목 지도와 같은 차트를 연다.
  const { chartStock, openChart, closeChart } = useStockChart()
  const openStockChart = (stock: HeatmapItem) => {
    closeInfoPopup()
    openChart({ code: stock.stockCode, name: stock.stockName, sectorPath: chartSectorPath(phonePathCrumbs) })
  }
  const pathNav = (
    <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${pathBarLeftShift}px)` }}>
      <PathBar
        variant="phone"
        currentAria="location"
        accentColor={strongIndustryColor}
        crumbs={phonePathCrumbs}
      />
    </header>
  )
  // 경로 줄도 그래프 글자와 같은 판 기준 값으로 그린다. 810px 판의 16px·32px가 390px 폰에서 화면 16px·32px로 보인다.
  // 셸의 스와이프 대상 밖에 두면 다음 페이지 미리보기에 이 자리가 비어 당겨지는 동안 빈 띠가 보인다.
  const renderPathNav = () => <div style={{ zoom: PHONE_PATH_CANVAS_ZOOM }}>{pathNav}</div>

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
  const popupNavigationKey = `${market}|${majorName ?? ''}|${midName ?? ''}|${stockSelection ? 'stock' : ''}|${viewMode}`

  // 들어간 단계 = 브라우저 기록 한 칸(PC 지도 화면과 같은 방식). 대분류·중분류·종목으로 한 단계 들어갈 때마다 칸을 쌓아서
  // 뒤로가기가 사이트를 떠나지 않고 한 단계씩 위로 올라가게 한다. 전체 화면에서 한 번 더 누르면 원래대로 이전 페이지로 나간다.
  const depth = Math.max(0, (major ? 1 : 0) + (mid ? 1 : 0) + (selectedStocks ? 1 : 0) - (isGraph ? graphEntryOffset : 0))
  const historyDepthRef = useRef(0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyLocationRef = useRef('') // 칸을 쌓은 주소(시장이 바뀌어 주소가 달라졌으면 go()로 정리하지 않는다)
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
      const isMobileSectorRoute = path === '/summary/korea' || path === '/summary/korea/kospi' || path === '/summary/korea/kosdaq'
      if (!path.startsWith('/map/') && !path.startsWith('/graph/') && !isMobileSectorRoute) return
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
    setGraphEntryOffset(0)
    if (pathname.startsWith('/map/') || pathname.startsWith('/graph/')) {
      // 종목 지도에서 업종을 보던 중이어도 마켓을 바꾸면 그 마켓의 전체 종목 지도로 간다(업종 이름이 마켓마다 다를 수 있다).
      navigate(marketRoute(isGraph ? '/graph' : '/map', nextMarket), { replace: true })
    } else {
      // 업종 지도는 시장을 경로로 구분한다. ?market=은 옛 주소 호환용으로만 읽고 새로 만들지는 않는다.
      const next = new URLSearchParams(searchParams)
      next.delete('market')
      const rest = next.toString()
      navigate(`${marketRoute('/summary', nextMarket)}${rest ? `?${rest}` : ''}`, { replace: true })
    }
  }

  const graphItems: MobileGraphItem[] = viewMode === 'stock'
    ? stockContextItems.map(stock => ({ key: stock.stockCode, name: stock.alias ?? stock.stockName, value: stock.changeRate, onSelect: () => openStockChart(stock) }))
    : marketItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate, onSelect: () => selectSector(item.name) }))
  const showLiveIndexes = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
  // 지수 막대가 heatmap과 다른 쿼리에서 오므로, 지수까지 준비된 뒤 한 번에 그린다.
  // 캐시가 있어도 백그라운드 refetch 중이면 값이 바뀌면서 업종 줄이 밀리므로, 응답이 확정될 때까지 기다린다(2026-11-22 사용자 제보).
  const isLoading = isBaseLoading || (isGraph && showLiveIndexes && (isMarketSummaryLoading || isMarketSummaryFetching))
  if (isGraph && showLiveIndexes && !major && !mid && viewMode === 'sector') {
    for (const index of marketSummary?.marketOverviews.items ?? []) {
      if (index.market === 'KOSPI' || index.market === 'KOSDAQ') {
        const indexMarket = index.market
        graphItems.push({ key: `market-index:${indexMarket}`, name: indexMarket === 'KOSPI' ? '코스피' : '코스닥', value: index.changeRate, reference: true, onSelect: () => selectMarket(indexMarket) })
      }
    }
  }
  const swipeGraphItems: MobileGraphItem[] = mapItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate }))
  if (showLiveIndexes) {
    for (const index of marketSummary?.marketOverviews.items ?? []) {
      if (index.market === 'KOSPI' || index.market === 'KOSDAQ') {
        swipeGraphItems.push({ key: `market-index:${index.market}`, name: index.market === 'KOSPI' ? '코스피' : '코스닥', value: index.changeRate, reference: true })
      }
    }
  }

  // 상단 제목을 누를 때마다 종목 지도 → 업종 지도 → 그룹 등락률 → 종목 지도로 이동한다(마켓은 유지).
  const titleTo = !isGraph ? marketRoute('/graph', market) : marketRoute('/map', market)
  const titleLabel = !isGraph ? '그룹 등락률로 이동' : '종목 지도로 이동'
  // 왼쪽으로 밀면 업종 지도 → 그룹 등락률 → 종목 지도, 오른쪽으로 밀면 그 반대다.
  const swipeTarget = (direction: 'next' | 'previous'): 'stock' | 'sector' | 'graph' => isGraph
    ? (direction === 'next' ? 'stock' : 'sector')
    : (direction === 'next' ? 'graph' : 'stock')
  const routeForMode = (targetMode: 'stock' | 'sector' | 'graph') => marketRoute(targetMode === 'stock' ? '/map' : targetMode === 'sector' ? '/summary' : '/graph', market)
  // 스와이프 미리보기의 종목 지도는 목적지(/map)와 같은 루트 트리를 그린다. 예전 상위 30종목 전용 지도와 달리
  // 업종별 박스와 전체 종목이 보이도록, MapPage가 최상위에서 쓰는 것과 같은 filteredRootNodes·뎁스 제한을 쓴다.
  const swipeMapGroups = useMemo(
    () => (maxDepth != null && maxDepth > 0 ? limitDepth(filteredRootNodes, maxDepth) : filteredRootNodes).map(toDisplayGroup),
    [filteredRootNodes, maxDepth],
  )
  // 도착 화면(MapPage)의 폰 판과 같은 행 지표를 써야 전환 뒤 첫 행이 바뀌지 않는다.
  const swipeCaptureRowMetric = isInDepthRange(simpleAvgDepthRange, 0) && !isInDepthRange(weightedAvgDepthRange, 0)
    ? 'simpleAvgChangeRate'
    : 'weightedAvgChangeRate'
  // 그룹 등락률 미리보기는 지수까지 준비된 뒤에 그린다. 지도에서는 지수 조회가 화면 로딩에 포함되지 않으므로
  // 미리보기에서 따로 기다리지 않으면 막대만 먼저 뜨고 지수가 뒤따라온다.
  const isGraphPreviewLoading = isLoading || (showLiveIndexes && (isMarketSummaryLoading || isMarketSummaryFetching))
  const renderSwipePreview = (targetMode: 'stock' | 'sector' | 'graph') => targetMode === 'graph'
    ? isGraphPreviewLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
      : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} /></div>
        : <MobileGraphBars items={swipeGraphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />
    : targetMode === 'stock'
      ? isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
        : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} /></div>
          : swipeMapGroups.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p>
            // 종목 지도 도착지는 MapPage의 8px 폰 판이다. 예전처럼 4px 판으로 그리면 전환이 끝날 때 지도가 한 번 커져 보인다.
            : <div ref={swipePreviewCanvasRef} style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${frameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
                <div className="flex h-full min-h-0 flex-col bg-ui-background">
                  <MobileMapHeatmapFrame
                    path={[]}
                    marketLabel={market === 'KOSPI' ? 'KOSPI' : market === 'KOSDAQ' ? 'KOSDAQ' : 'K-STOCK'}
                    strongIndustryColor={strongIndustryColor}
                    heatmapProps={{
                      groups: swipeMapGroups,
                      selfSectorName: null,
                      depth: 0,
                      onSelectSector: () => {},
                      onExcludeSector: () => {},
                      heightClassName: 'min-h-0 flex-1',
                      marketValueDepthRange,
                      weightedAvgDepthRange,
                      simpleAvgDepthRange,
                      upDownCountDepthRange,
                      boxSizeMarketCapRatio,
                      stretch: mapStretchFor(taxonomy),
                      tile: mapTileMethod(),
                      canExclude: false,
                      colorScale,
                      labelMinAreaPercent: boxLabelMinAreaPercent,
                      stockLabelMode,
                      stockPopupOnHover: false,
                      decimalPlaces: MOBILE_DECIMAL_PLACES,
                      topPickSectorKeys,
                      strongIndustryColor,
                      captureRowMetric: swipeCaptureRowMetric,
                      zoomOutRequestDepth: null,
                      onZoomOutComplete: () => {},
                    }}
                  />
                </div>
              </div>
      : isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
        : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} /></div>
          : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p>
            : <div className="relative flex h-full min-h-0 flex-col bg-ui-surface"><MobileSectorMap items={mapItems} colorScale={colorScale} onSelect={() => undefined} decimalPlaces={MOBILE_DECIMAL_PLACES} /></div>

  // 스와이프 자체는 공통 셸이 맡는다. 종목 지도는 도착지와 같은 8px 판, 업종 지도는 공통 업종 지도 판, 그룹 등락률은 이 화면과 같은 4px 판으로 그린다.
  const frameStyle = { width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${frameScale})`, transformOrigin: 'top left' } as const
  const swipePreview = (direction: 'next' | 'previous') => {
    const targetMode = swipeTarget(direction)
    if (targetMode === 'stock') return renderSwipePreview(targetMode)
    if (targetMode === 'sector') {
      return (
        <PhoneSectorMapFrame scale={frameScale} crumbs={[{ key: 'market', label: marketLabel, current: true }]}>
          {renderSwipePreview(targetMode)}
        </PhoneSectorMapFrame>
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
      <PhoneMapShell
        zoomMode="blocked"
        infoPopup={infoPopup}
        onCloseInfoPopup={closeInfoPopup}
        navigationKey={popupNavigationKey}
        onSwipe={direction => navigate(routeForMode(swipeTarget(direction)))}
        onBeforeSwipeNavigate={direction => { if (swipeTarget(direction) === 'stock') captureSwipeArrivalOverlay(swipePreviewCanvasRef.current) }}
        nextPreview={() => swipePreview('next')}
        previousPreview={() => swipePreview('previous')}
        topBar={<MobileTopBar title={isGraph ? '그룹 등락률' : '업종 지도'} titleTo={titleTo} titleLabel={titleLabel} />}
        toolbar={
          <MapToolbar
            market={market}
            menuBasePath={isGraph ? '/graph' : '/summary'}
            marketLabel={market === 'ALL_STOCK' ? 'K-STOCK' : market === 'KOSPI' ? 'KOSPI' : 'KOSDAQ'}
            snapshotTime={data?.snapshotTime ?? null}
            liveSnapshotTime={liveSnapshotTime}
            pinnedSnapshotTime={pinnedSnapshotTime}
            rangeStartTime={rangeStartTime}
            isPastSnapshot={pinnedSnapshotTime !== undefined}
            colorScale={colorScale}
            onChangePinnedSnapshotTime={onChangePinnedSnapshotTime}
            onSelectRange={onSelectRange}
            rangeExcludedStocks={rangeExcludedStocks}
            refetchHeatmap={refetchHeatmap}
            isRefetchingHeatmap={isRefetchingHeatmap}
            changeRateChoice={changeRateChoice}
            onChangeChangeRateMode={onChangeChangeRateMode}
            isAfterHoursControlsVisible={isAfterHoursControlsVisible}
            isAfterHoursSelectable={isAfterHoursSelectable}
            modeStatusText={null}
            refreshHelpText={SNAPSHOT_REFRESH_HELP}
            refreshSpinMs={REFRESH_BUTTON_SPIN_MS}
          />
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
        {(isGraph || !isLoading) && renderPathNav()}
        <div className="min-h-0 flex-1">
        {isLoading ? <div className="flex h-full items-center justify-center"><Spinner showElapsed className={MOBILE_LOADING_SIZE_CLASS} /></div>
          : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} /></div>
            : isGraph ? <MobileGraphBars items={graphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />
            : viewMode === 'stock' ? stockHeatmapItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p> : <MobileStockHeatmap stocks={stockHeatmapItems} boxSizeRatio={boxSizeMarketCapRatio} colorScale={colorScale} decimalPlaces={MOBILE_DECIMAL_PLACES} onSelect={openStockChart} onLongPress={(stock, target) => openStockPopup(stock, target)} />
            : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p> : <div className="relative flex h-full min-h-0 flex-col bg-ui-surface"><MobileSectorMap items={mapItems} colorScale={colorScale} onSelect={selectSector} onLongPress={(item, target) => openSectorPopup(marketItems.find(sector => sector.key === item.key) ?? item, target)} decimalPlaces={MOBILE_DECIMAL_PLACES} /></div>}
        </div>
        </div>
        </div>
      </section>
        </div>}
        current="korea"
        boxSize={boxSizeMarketCapRatio}
        onChangeBoxSize={onChangeBoxSizeMarketCapRatio}
      />
        <PhonePathStockChart chartStock={chartStock} crumbs={phonePathCrumbs} market="korea" closeChart={closeChart} />
      </>
  )
}
