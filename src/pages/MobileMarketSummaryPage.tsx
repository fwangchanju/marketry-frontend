import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from 'd3-hierarchy'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ReturnArrowIcon } from '@/components/icons/AppIcons'
import MobileTopBar from '@/components/MobileTopBar'
import { navigateWithMobileSlide } from '@/utils/mobilePageTransition'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import Spinner from '@/components/Spinner'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useLongPress } from '@/hooks/useLongPress'
import { IDENTITY, panTransform, pinchTransform, type Point, type ZoomTransform } from '@/utils/mapZoom'
import type { HeatmapItem } from '@/types/api'
import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { collectAllItems } from '@/hooks/useFilteredHeatmap'
import { isLightColor, resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { toJoEok, toPctSigned, toSnapshotDateLabel, toSnapshotTimeOnlyLabel } from '@/utils/format'
import { layoutOverviewLabel } from '@/utils/overviewLabel'
import { calculateSectorLayoutWeights, MOBILE_BALANCED_BOX_SIZE_RATIO, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import { useFontsVersion } from '@/utils/stockLabelFit'
import type { MarketQuery } from '@/types/api'
import { marketRoute } from '@/utils/marketRoute'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector, type SectorSummary } from '@/utils/sectorAverage'
import { indexSectorsByPath, sectorPathKey } from '@/utils/sectorPath'
import { resolveMobileStockSelection } from '@/utils/mobileStockSelection'

const MARKETS: { value: MarketQuery; label: string }[] = [
  { value: 'ALL_STOCK', label: '국내 증시' },
  { value: 'KOSPI', label: '코스피' },
  { value: 'KOSDAQ', label: '코스닥' },
]
// 설정창은 첫 진입 때 닫고, MAP↔GRAPH를 오갈 때는 이 탭의 메모리에 상태를 이어간다.
let settingsOpenMemory = false

// 주식 지도에 그리는 종목 수(시가총액 상위) — 설정에서 고르지 않고 고정한다.
const STOCK_MAP_COUNT = 30
const MOBILE_SETTINGS_BAR_HEIGHT = 24
const MOBILE_PAGE_SWIPE_EDGE_GUARD = 24
const MOBILE_DECIMAL_PLACES = 1

function stockLayoutValue(stock: HeatmapItem, ratio: number) {
  return ratio <= 0 ? 1 : Math.pow(Math.max(stock.totalMarketValue, 0), ratio / 100)
}

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
    advancers: stocks.filter(stock => stock.changeRate > 0).length,
    decliners: stocks.filter(stock => stock.changeRate < 0).length,
    unchanged: stocks.filter(stock => stock.changeRate === 0).length,
    node: null,
    stocks,
    isDirectStocks: true,
  }
}

function MobileStockHeatmap({ stocks, boxSizeRatio, colorScale, decimalPlaces, onSelect, onLongPress }: {
  stocks: HeatmapItem[]
  boxSizeRatio: number
  colorScale: ReturnType<typeof useGlobalSettings>['colorScale']
  decimalPlaces: number
  onSelect: (stock: HeatmapItem) => void
  // 길게 누르면 팝업을 연다(짧게 누르는 것과 달리 이미 떠 있어도 닫지 않는다).
  onLongPress: (stock: HeatmapItem) => void
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
        const press = bindLongPress(() => onLongPress(stock))
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

// stock = 마켓 전체 상위 30개 종목 지도(`/map/...`), sector = 업종 분류 지도(`/home?map`), graph = 그룹 등락률(`/graph/...`).
export default function MobileMarketSummaryPage({ mode = 'stock' }: { mode?: 'stock' | 'sector' | 'graph' }) {
  const isGraph = mode === 'graph'
  const isStockMode = mode === 'stock'
  const isSectorMode = mode === 'sector'
  const { data: marketSummary, refetch: refetchMarketSummary } = useMarketSummary(isGraph)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { pathname } = location
  const navigate = useNavigate()
  const pageContentRef = useRef<HTMLElement>(null)
  const pageRootRef = useRef<HTMLElement>(null)
  const settingsSectionRef = useRef<HTMLElement>(null)
  const pullGestureRef = useRef<{ startX: number; startY: number; eligible: boolean; inOpenSettings: boolean; scrollable: HTMLElement | null } | null>(null)
  const refreshInProgressRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const refreshActionRef = useRef<() => Promise<void>>(async () => {})
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)
  const {
    settingsModalProps,
    market,
    taxonomy,
    data,
    isLoading,
    isError,
    refetchHeatmap,
    filteredRootNodes,
    rootNodes,
    excludedMarketValueTiers,
    colorScale,
    strongIndustryColor,
    changeRateMode,
    changeRateChoice,
    pinnedSnapshotTime,
    rangeStartTime,
  } = useGlobalSettings({ allowChangeRateMode: true, defaultTaxonomy: 'MARKETRY', taxonomyStorageKey: 'mobile.taxonomySelection' })
  const [majorSelection, setMajorSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [midSelection, setMidSelection] = useState<{ market: MarketQuery; name: string } | null>(null)
  const [stockSelection, setStockSelection] = useState<{ market: MarketQuery; key: string; categoryName: string } | null>(null)
  const [graphEntryOffset, setGraphEntryOffset] = useState(0)
  const [graphDepth, setGraphDepth] = usePageSetting<number>('mobile.graphDepth', 1)
  const [viewModeState, setViewMode] = useState<'sector' | 'stock'>('sector')
  const viewMode = isStockMode ? 'stock' : viewModeState
  const [focusedStockCode, setFocusedStockCode] = useState<string | null>(null)
  // 길게 눌러 연 종목 카드는 저절로 닫히지 않고(같은 종목을 다시 길게 누르면 닫힌다), 짧게 눌러 연 카드는 잠깐 보였다 사라진다.
  const [stockPinned, setStockPinned] = useState(false)
  const [focusedSectorKey, setFocusedSectorKey] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpenState] = useState(settingsOpenMemory)
  const setSettingsOpen = (open: boolean) => {
    settingsOpenMemory = open
    setSettingsOpenState(open)
  }
  refreshActionRef.current = async () => {
    await Promise.all([refetchHeatmap(), ...(isGraph ? [refetchMarketSummary()] : [])])
  }
  useEffect(() => {
    const root = pageRootRef.current
    if (!root) return
    const findScrollableAncestor = (target: EventTarget | null) => {
      let element = target instanceof HTMLElement ? target : target instanceof Element ? target.parentElement : null
      while (element && element !== root) {
        const style = window.getComputedStyle(element)
        if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) return element
        element = element.parentElement
      }
      return null
    }
    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0]
      if (!touch) return
      const inOpenSettings = settingsOpenMemory && settingsSectionRef.current?.contains(event.target as Node)
      const scrollable = findScrollableAncestor(event.target)
      pullGestureRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        inOpenSettings: Boolean(inOpenSettings),
        scrollable,
        eligible: !inOpenSettings && (!scrollable || scrollable.scrollTop <= 0),
      }
    }
    const onTouchMove = (event: TouchEvent) => {
      const gesture = pullGestureRef.current
      const touch = event.touches[0]
      if (!gesture || !touch || refreshInProgressRef.current) return
      const dx = touch.clientX - gesture.startX
      const dy = touch.clientY - gesture.startY
      if (gesture.inOpenSettings) {
        // 설정 내용은 스크롤을 허용하되, 맨 위에서 바깥쪽으로 당겨 브라우저가 갱신하는 동작은 막는다.
        if (dy > 8 && Math.abs(dx) <= Math.abs(dy) && (!gesture.scrollable || gesture.scrollable.scrollTop <= 0)) event.preventDefault()
        return
      }
      if (!gesture.eligible) return
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        gesture.eligible = false
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }
      if (dy > 8) {
        event.preventDefault()
        pullDistanceRef.current = Math.min(dy, 88)
        setPullDistance(pullDistanceRef.current)
      }
    }
    const onTouchEnd = (cancelled: boolean) => {
      const gesture = pullGestureRef.current
      pullGestureRef.current = null
      if (cancelled || !gesture?.eligible || pullDistanceRef.current < 64 || refreshInProgressRef.current) {
        pullDistanceRef.current = 0
        setPullDistance(0)
        return
      }
      refreshInProgressRef.current = true
      setIsPullRefreshing(true)
      pullDistanceRef.current = 64
      setPullDistance(64)
      const finishRefresh = () => {
        refreshInProgressRef.current = false
        setIsPullRefreshing(false)
        pullDistanceRef.current = 0
        setPullDistance(0)
      }
      void refreshActionRef.current().then(finishRefresh, finishRefresh)
    }
    const onTouchEndEvent = () => onTouchEnd(false)
    const onTouchCancelEvent = () => onTouchEnd(true)
    root.addEventListener('touchstart', onTouchStart, { passive: true })
    root.addEventListener('touchmove', onTouchMove, { passive: false })
    root.addEventListener('touchend', onTouchEndEvent, { passive: true })
    root.addEventListener('touchcancel', onTouchCancelEvent, { passive: true })
    return () => {
      root.removeEventListener('touchstart', onTouchStart)
      root.removeEventListener('touchmove', onTouchMove)
      root.removeEventListener('touchend', onTouchEndEvent)
      root.removeEventListener('touchcancel', onTouchCancelEvent)
    }
  }, [])
  // 열린 채로 새 페이지가 만들어지면 내용 높이를 알 수 있는 첫 그리기 직후에 한 번 더 그려서 높이를 맞춘다.
  const [, setHeightTick] = useState(0)
  const [settingsLayoutReady, setSettingsLayoutReady] = useState(false)
  useLayoutEffect(() => { if (settingsOpenMemory) setHeightTick(tick => tick + 1) }, [])
  // 새 페이지의 첫 렌더에서는 설정 내용 ref가 아직 없어 높이가 0이다. 측정된 높이로 맞출 때
  // 열림 애니메이션이 재생되지 않도록 한 프레임 뒤에 사용자 조작용 전환을 켠다.
  useEffect(() => { setSettingsLayoutReady(true) }, [])
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const settingsContentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ y: number; start: number; max: number; moved: boolean } | null>(null)
  const suppressClickRef = useRef(false)
  const pageSwipeRef = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const pageSwipeSettleTimerRef = useRef<number | null>(null)
  const [pageSwipePreview, setPageSwipePreviewState] = useState<{
    direction: 'next' | 'previous'
    targetMode: 'stock' | 'sector' | 'graph'
    offset: number
    settling: 'finish' | 'cancel' | null
  } | null>(null)
  const pageSwipePreviewRef = useRef(pageSwipePreview)
  const setPageSwipePreview = (preview: typeof pageSwipePreview) => {
    pageSwipePreviewRef.current = preview
    setPageSwipePreviewState(preview)
  }
  const suppressPageClickRef = useRef(false)
  // 설정창이 열리는 최대 높이 — 화면의 40%(손잡이 줄 24px 제외)다. 눕힌 폰처럼 화면이 낮으면(500px 이하, index.css의 모바일 판정과 같은 기준)
  // 40%가 내용보다 작아 아래 줄이 잘리므로 60%까지 열어 준다. CSS 한도(아래 max-h)도 같은 값이다.
  const settingsHeight = () => Math.min(settingsContentRef.current?.scrollHeight ?? 0, window.innerHeight * (window.innerHeight <= 500 ? 0.6 : 0.4) - MOBILE_SETTINGS_BAR_HEIGHT)

  useEffect(() => () => {
    if (pageSwipeSettleTimerRef.current !== null) window.clearTimeout(pageSwipeSettleTimerRef.current)
  }, [])

  // 분류 단계: MARKETRY·내 기준은 대·중·소분류(3단계), 거래소는 1단계. 눌러서 들어갈 때 하위 분류가 있으면 그 분류로, 없으면 바로 종목으로 간다.
  // 박스 크기는 PC 설정과 따로 두고, 폰의 기본은 시총 비례(100)다. 동일 0 · 균형 50 · 시총 비례 100.
  const [storedBoxSizeMarketCapRatio, onChangeBoxSizeMarketCapRatio] = usePageSetting<number>('mobile.boxSizeMarketCapRatio', 100)
  const boxSizeMarketCapRatio = normalizeMobileBoxSizeRatio(storedBoxSizeMarketCapRatio)
  // 경로의 맨 앞은 전체일 때 국내 증시, 그 밖에는 고른 마켓 이름이다.
  const marketLabel = market === 'ALL_STOCK' ? '국내 증시' : MARKETS.find(option => option.value === market)?.label ?? '국내 증시'
  const marketHeadingLabel = isStockMode ? `${marketLabel} 상위 ${STOCK_MAP_COUNT}` : marketLabel
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : 3
  // 모바일 종목 지도는 마켓 상위 30개로 고정한다. 업종 하위 탐색은 업종 지도 안에서만 한다.
  const majorName = isStockMode ? null : majorSelection?.market === market ? majorSelection.name : null
  const midName = isStockMode ? null : midSelection?.market === market ? midSelection.name : null
  const stockCategoryName = stockSelection?.market === market ? stockSelection.categoryName : null
  const setMajorName = (name: string | null) => setMajorSelection(name ? { market, name } : null)
  const setMidName = (name: string | null) => setMidSelection(name ? { market, name } : null)
  const setSelectedStocks = (item: MobileSectorItem | null) => setStockSelection(item ? { market, key: item.key, categoryName: item.name } : null)
  const major = majorName ? filteredRootNodes.find(node => node.sectorName === majorName) ?? null : null
  const mid = major && midName ? major.children.find(node => node.sectorName === midName) ?? null : null

  useEffect(() => {
    if (!isStockMode || !searchParams.has('sector')) return
    const next = new URLSearchParams(searchParams)
    next.delete('sector')
    setSearchParams(next, { replace: true })
  }, [isStockMode, searchParams, setSearchParams])

  // 모바일 업종 집계는 선택 필터에 잘리기 전 원본 트리를 기준으로 찾는다. 거래소 업종은 모든 sectorId가 0이라 id로 찾지 않는다.
  const originalSectorsByPath = useMemo(() => indexSectorsByPath(rootNodes), [rootNodes])

  const marketItems = useMemo(() => {
    const summaryOf = (path: string) => {
      const original = originalSectorsByPath.get(path)
      return original ? summarizeSector(original, excludedMarketValueTiers) : null
    }
    const parent = mid ?? major
    if (isGraph && !parent && graphDepth > 1 && selectableDepth > 1) {
      return collectAtDepth(filteredRootNodes, Math.min(graphDepth, selectableDepth), new Set<number>())
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
  const focusedStock = stockHeatmapItems.find(stock => stock.stockCode === focusedStockCode) ?? null
  // 종목 정보 카드는 손가락으로 가리지 않게 위쪽에 띄운다. 짧게 눌러 연 카드는 2초 뒤 저절로 닫고, 길게 눌러 연 카드는 닫을 때까지 둔다.
  useEffect(() => {
    if (!focusedStockCode || stockPinned) return
    const timer = window.setTimeout(() => setFocusedStockCode(null), 2000)
    return () => window.clearTimeout(timer)
  }, [focusedStockCode, stockPinned])
  // 업종 정보 카드는 업종을 길게 눌렀을 때 종목 카드처럼 위쪽에 띄우고, 같은 업종을 다시 길게 누르거나 카드를 눌러 닫을 때까지 둔다. 업종 목록이 바뀌어 없어지면 보이지 않는다.
  const focusedSector = marketItems.find(item => item.key === focusedSectorKey) ?? null
  const heading = viewMode === 'stock'
    ? `${stockCategoryName || stockScope?.sectorName || '전체 시장'} 주식 히트맵`
    : mid ? `${mid.sectorName} 소분류 업종 히트맵` : major ? `${major.sectorName} 중분류 업종 히트맵` : '국내 업종 히트맵'

  // 위쪽 경로 — PC 지도 화면과 같다: 앞 단계는 이름 오른쪽에 ↩ 아이콘이 붙은 버튼(누르면 그 단계로 되돌아감), 마지막(현재 위치)은 강조색 글씨다.
  const pathCrumbs: { key: string; label: string; go: (() => void) | null }[] = [
    { key: 'market', label: marketHeadingLabel, go: isStockMode ? (major ? () => navigate(marketRoute('/map', market)) : null) : major || mid || selectedStocks ? () => { setMajorName(null); setMidName(null); setSelectedStocks(null); setGraphEntryOffset(0); setViewMode('sector') } : null },
    ...(major && (!isGraph || graphEntryOffset < 1) ? [{ key: 'major', label: major.sectorName, go: mid || selectedStocks ? () => { setMidName(null); setSelectedStocks(null); setViewMode('sector') } : null }] : []),
    ...(mid && (!isGraph || graphEntryOffset < 2) ? [{ key: 'mid', label: mid.sectorName, go: selectedStocks ? () => { setSelectedStocks(null); setViewMode('sector') } : null }] : []),
    ...(stockCategoryName ? [{ key: 'stock', label: stockCategoryName, go: null }] : []),
  ]

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

  // 들어간 단계 = 브라우저 기록 한 칸(PC 지도 화면과 같은 방식). 대분류·중분류·종목으로 한 단계 들어갈 때마다 칸을 쌓아서
  // 뒤로가기가 사이트를 떠나지 않고 한 단계씩 위로 올라가게 한다. 전체 화면에서 한 번 더 누르면 원래대로 이전 페이지로 나간다.
  const depth = isStockMode ? 0 : Math.max(0, (major ? 1 : 0) + (mid ? 1 : 0) + (selectedStocks ? 1 : 0) - (isGraph ? graphEntryOffset : 0))
  const historyDepthRef = useRef(0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyLocationRef = useRef('') // 칸을 쌓은 주소(시장이 바뀌어 주소가 달라졌으면 go()로 정리하지 않는다)
  const historyNormalizedRef = useRef(false)
  const reduceToDepth = (target: number) => {
    if (isGraph && target === 0 && graphEntryOffset > 0) {
      setMajorSelection(null); setMidSelection(null); setStockSelection(null); setGraphEntryOffset(0); setViewMode('sector'); setFocusedStockCode(null)
      return
    }
    let current = depth
    if (current > target && selectedStocks) { setStockSelection(null); setViewMode('sector'); current -= 1 }
    if (current > target && mid) { setMidSelection(null); current -= 1 }
    if (current > target && major) { setMajorSelection(null); setViewMode('sector') }
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
      const isMobileSectorRoute = path === '/home' && new URLSearchParams(window.location.search).has('map')
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
    setFocusedStockCode(null)
    setGraphEntryOffset(0)
    if (pathname.startsWith('/map/') || pathname.startsWith('/graph/')) {
      // 종목 지도에서 업종을 보던 중이어도 마켓을 바꾸면 그 마켓의 전체 종목 지도로 간다(업종 이름이 마켓마다 다를 수 있다).
      navigate(marketRoute(isGraph ? '/graph' : '/map', nextMarket), { replace: true })
    } else {
      const next = new URLSearchParams(searchParams)
      next.set('market', nextMarket)
      setSearchParams(next, { replace: true })
    }
  }

  const graphItems: MobileGraphItem[] = viewMode === 'stock'
    ? stockContextItems.map(stock => ({ key: stock.stockCode, name: stock.alias ?? stock.stockName, value: stock.changeRate }))
    : marketItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate, onSelect: () => selectSector(item.name) }))
  const showLiveIndexes = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
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

  // 상단 제목을 누를 때마다 종목 지도 → 업종 지도 → 그룹 등락률 → 가이드 → 종목 지도로 이동한다(마켓은 유지).
  const titleTo = isStockMode ? `/home?map&market=${market}` : isSectorMode ? marketRoute('/graph', market) : `/info/guide?market=${market}`
  const titleLabel = isStockMode ? '업종 지도로 이동' : isSectorMode ? '그룹 등락률로 이동' : '가이드로 이동'
  const modeForSwipe = (direction: 'next' | 'previous') => {
    const order = ['stock', 'sector', 'graph'] as const
    const index = order.indexOf(mode)
    return order[(index + (direction === 'next' ? 1 : order.length - 1)) % order.length]
  }
  const routeForMode = (targetMode: 'stock' | 'sector' | 'graph') => targetMode === 'stock'
    ? marketRoute('/map', market)
    : targetMode === 'sector'
      ? `/home?map&market=${market}`
      : marketRoute('/graph', market)
  const finishSwipe = (finish: boolean) => {
    const preview = pageSwipePreviewRef.current
    if (!preview) return
    setPageSwipePreview({ ...preview, settling: finish ? 'finish' : 'cancel' })
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180
    if (pageSwipeSettleTimerRef.current !== null) window.clearTimeout(pageSwipeSettleTimerRef.current)
    pageSwipeSettleTimerRef.current = window.setTimeout(() => {
      pageSwipeSettleTimerRef.current = null
      if (finish) navigate(routeForMode(preview.targetMode))
      else setPageSwipePreview(null)
    }, duration)
  }
  const transitionToNextMode = () => {
    if (pageSwipePreviewRef.current) return
    if (isGraph) {
      navigateWithMobileSlide(navigate, titleTo)
      return
    }
    const direction = 'next' as const
    setPageSwipePreview({ direction, targetMode: modeForSwipe(direction), offset: 0, settling: null })
    requestAnimationFrame(() => finishSwipe(true))
  }
  const beginPageSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const mobilePointer = event.pointerType === 'touch' || event.pointerType === 'pen'
      || (event.pointerType === 'mouse' && window.matchMedia('(max-width: 767px)').matches)
    if (!mobilePointer) return
    if (event.clientX <= MOBILE_PAGE_SWIPE_EDGE_GUARD || event.clientX >= window.innerWidth - MOBILE_PAGE_SWIPE_EDGE_GUARD) return
    if (pageSwipePreviewRef.current) return
    const map = (event.target as HTMLElement).closest<HTMLElement>('[data-mobile-map-scale]')
    if (map && Number(map.dataset.mobileMapScale) > 1.05) return
    if (pageSwipeRef.current) {
      if (pageSwipeRef.current.pointerId !== event.pointerId) pageSwipeRef.current = null
      return
    }
    pageSwipeRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  const movePageSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const start = pageSwipeRef.current
    if (!start || start.pointerId !== event.pointerId || pageSwipePreviewRef.current?.settling) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) < 4 || Math.abs(dx) < Math.abs(dy) * 1.1) return
    const direction = dx < 0 ? 'next' : 'previous'
    const width = pageContentRef.current?.clientWidth ?? window.innerWidth
    const offset = Math.max(-width, Math.min(width, dx))
    setPageSwipePreview({ direction, targetMode: modeForSwipe(direction), offset, settling: null })
  }
  const endPageSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const start = pageSwipeRef.current
    if (!start || start.pointerId !== event.pointerId) return
    pageSwipeRef.current = null
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    const preview = pageSwipePreviewRef.current
    if (!preview || Math.abs(dx) < Math.max(24, (pageContentRef.current?.clientWidth ?? window.innerWidth) * 0.08) || Math.abs(dx) < Math.abs(dy) * 1.1) {
      if (preview) finishSwipe(false)
      return
    }
    suppressPageClickRef.current = true
    window.setTimeout(() => { suppressPageClickRef.current = false }, 0)
    finishSwipe(true)
  }

  const swipePreviewTransform = pageSwipePreview
    ? pageSwipePreview.settling === 'finish' ? 'translateX(0)'
      : pageSwipePreview.settling === 'cancel' ? (pageSwipePreview.direction === 'next' ? 'translateX(100%)' : 'translateX(-100%)')
        : pageSwipePreview.direction === 'next' ? `translateX(calc(100% + ${pageSwipePreview.offset}px))` : `translateX(calc(-100% + ${pageSwipePreview.offset}px))`
    : ''
  const currentSwipeTransform = pageSwipePreview
    ? pageSwipePreview.settling === 'finish' ? (pageSwipePreview.direction === 'next' ? 'translateX(-100%)' : 'translateX(100%)')
      : pageSwipePreview.settling === 'cancel' ? 'translateX(0)'
        : `translateX(${pageSwipePreview.offset}px)`
    : ''
  const swipeTransition = pageSwipePreview?.settling
    ? `transform ${window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180}ms cubic-bezier(0.2, 0.7, 0.2, 1)`
    : 'none'
  const renderSwipePreview = () => pageSwipePreview?.targetMode === 'graph'
    ? isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
      : isError ? <div className="flex h-full items-center justify-center text-center text-sm text-ui-text">시장 데이터를 불러오지 못했습니다.</div>
        : <MobileGraphBars items={swipeGraphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />
    : pageSwipePreview?.targetMode === 'stock'
      ? isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
        : isError ? <div className="flex h-full items-center justify-center text-center text-sm text-ui-text">시장을 불러오지 못했습니다.</div>
          : stockHeatmapItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p>
            : <MobileStockHeatmap stocks={stockHeatmapItems} boxSizeRatio={boxSizeMarketCapRatio} colorScale={colorScale} decimalPlaces={MOBILE_DECIMAL_PLACES} onSelect={() => undefined} onLongPress={() => undefined} />
      : isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div>
        : isError ? <div className="flex h-full items-center justify-center text-center text-sm text-ui-text">시장을 불러오지 못했습니다.</div>
          : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p>
            : <div className="relative flex h-full min-h-0 flex-col bg-ui-surface p-1"><MobileSectorMap items={mapItems} colorScale={colorScale} onSelect={() => undefined} decimalPlaces={MOBILE_DECIMAL_PLACES} /></div>

  return (
    <main ref={pageRootRef} className="fixed inset-0 flex h-[100dvh] flex-col overflow-hidden bg-ui-background text-ui-white">
      {pullDistance > 0 && <div role="status" aria-label={isPullRefreshing ? '새로고침 중' : '새로고침하려면 더 당기세요'} className="pointer-events-none absolute left-1/2 top-2 z-30 rounded-full bg-ui-panel/95 p-2 shadow-lg" style={{ transform: `translate(-50%, ${Math.max(0, pullDistance - 32)}px)` }}><span aria-hidden="true" className={`block h-6 w-6 rounded-full border-2 border-ui-border border-t-[var(--brand)] ${isPullRefreshing || pullDistance >= 64 ? 'animate-spin' : ''}`} /></div>}
      <MobileTopBar
        title={isGraph ? '그룹 등락률' : isSectorMode ? '업종 지도' : '종목 지도'}
        titleTo={titleTo}
        titleLabel={titleLabel}
        onTitleClick={transitionToNextMode}
        showDivider={false}
      />
      <h1 className="sr-only">{isGraph ? heading.replace('히트맵', '등락률 그래프') : heading}</h1>
      {/* 경로 줄은 맨 처음(국내 증시)에서도 항상 둔다 — 단계에 들어갈 때마다 지도 크기가 달라지지 않게 한다. */}
      <header className="shrink-0 bg-ui-background px-3 py-0">
        <nav aria-label="업종 이동 경로" className="flex h-[32px] items-center overflow-x-auto whitespace-nowrap text-[16px] leading-none font-bold">
          <span aria-hidden="true" className="h-4 w-[4px] shrink-0 bg-ui-white" />
          {pathCrumbs.map(crumb => crumb.go
            ? <button key={crumb.key} type="button" onClick={crumb.go} style={{ fontFamily: 'inherit', fontWeight: 'inherit' }} className="flex h-full shrink-0 items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-ui-white active:bg-ui-white/15">{crumb.label}<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></button>
            : <span key={crumb.key} aria-current="location" className="shrink-0 px-2 text-ui-white">{crumb.label}</span>)}
        </nav>
      </header>

      <section
        ref={pageContentRef}
        aria-label={isGraph ? (viewMode === 'sector' ? '업종 등락률 그래프' : '종목 등락률 그래프') : (viewMode === 'sector' ? '업종 히트맵' : '주식 히트맵')}
        onPointerDownCapture={beginPageSwipe}
        onPointerMoveCapture={movePageSwipe}
        onPointerUpCapture={endPageSwipe}
        onPointerCancelCapture={event => {
          if (pageSwipeRef.current?.pointerId !== event.pointerId) return
          pageSwipeRef.current = null
          if (pageSwipePreviewRef.current) finishSwipe(false)
        }}
        onClickCapture={event => { if (suppressPageClickRef.current) { suppressPageClickRef.current = false; event.preventDefault(); event.stopPropagation() } }}
        className="relative min-h-0 flex-1 touch-pan-y overflow-hidden"
      >
        <div className="absolute inset-0 p-1" style={{ transform: currentSwipeTransform, transition: swipeTransition, willChange: pageSwipePreview ? 'transform' : undefined }}>
        {isLoading ? <div className="flex h-full items-center justify-center"><Spinner showElapsed /></div>
          : isError ? <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><p className="text-sm text-ui-text">시장 지도를 불러오지 못했습니다.</p><button type="button" onClick={refetchHeatmap} className="min-h-11 px-4 font-semibold text-brand underline underline-offset-4">다시 불러오기</button></div>
            : isGraph ? <MobileGraphBars items={graphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />
            : viewMode === 'stock' ? stockHeatmapItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 종목이 없습니다.</p> : <>
              <MobileStockHeatmap stocks={stockHeatmapItems} boxSizeRatio={boxSizeMarketCapRatio} colorScale={colorScale} decimalPlaces={MOBILE_DECIMAL_PLACES} onSelect={stock => { setStockPinned(false); setFocusedStockCode(current => current === stock.stockCode ? null : stock.stockCode) }} onLongPress={stock => {
                if (stockPinned && focusedStockCode === stock.stockCode) { setStockPinned(false); setFocusedStockCode(null) } else { setStockPinned(true); setFocusedStockCode(stock.stockCode) }
              }} />
              {focusedStock && <button type="button" aria-label="종목 정보 닫기" onClick={() => setFocusedStockCode(null)} className="absolute left-3 right-3 top-3 flex flex-col gap-1 rounded-[6px] border-0 bg-ui-panel/95 px-3 py-2 text-left shadow-lg" aria-live="polite">
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="truncate text-[16px] font-semibold">{focusedStock.stockName}</span>
                  <span className="shrink-0 rounded-[4px] px-2 py-1 text-[15px] font-bold tabular-nums" style={{ backgroundColor: resolveHeatmapColor(focusedStock.changeRate, colorScale), color: isLightColor(resolveHeatmapColor(focusedStock.changeRate, colorScale)) ? 'var(--ui-on-light)' : 'var(--ui-on-dark)' }}>{toPctSigned(focusedStock.changeRate, MOBILE_DECIMAL_PLACES)}</span>
                </span>
                <span className="block text-[12px] leading-snug text-ui-muted">
                  종목코드 {focusedStock.stockCode} · <span className="whitespace-nowrap">시가총액 {toJoEok(focusedStock.totalMarketValue / 100_000_000)}</span>
                </span>
              </button>}
            </> : marketItems.length === 0 ? <p className="flex h-full items-center justify-center text-sm text-ui-muted">표시할 업종이 없습니다.</p> : <div className="relative flex h-full min-h-0 flex-col bg-ui-surface">
              {focusedSector && <button type="button" aria-label="업종 정보 닫기" onClick={() => setFocusedSectorKey(null)} className="absolute left-3 right-3 top-3 z-10 flex flex-col gap-1 rounded-[6px] border-0 bg-ui-panel/95 px-3 py-2 text-left shadow-lg" aria-live="polite">
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span className="truncate text-[16px] font-semibold">{focusedSector.name}</span>
                  <span className="shrink-0 rounded-[4px] px-2 py-1 text-[15px] font-bold tabular-nums" style={{ backgroundColor: resolveHeatmapColor(focusedSector.changeRate, colorScale), color: isLightColor(resolveHeatmapColor(focusedSector.changeRate, colorScale)) ? 'var(--ui-on-light)' : 'var(--ui-on-dark)' }}>{toPctSigned(focusedSector.changeRate, MOBILE_DECIMAL_PLACES)}</span>
                </span>
                <span className="block text-[12px] leading-snug tabular-nums text-ui-muted">
                  {focusedSector.simpleAvg !== undefined && <>동일 가중 {focusedSector.simpleAvg === null ? '-' : toPctSigned(focusedSector.simpleAvg, MOBILE_DECIMAL_PLACES)} · </>}
                  ▲{focusedSector.advancers ?? 0} ▼{focusedSector.decliners ?? 0} ■{focusedSector.unchanged ?? 0} · <span className="whitespace-nowrap">시가총액 {toJoEok(focusedSector.marketValue / 100_000_000)}</span>
                </span>
              </button>}
              <MobileSectorMap items={mapItems} colorScale={colorScale} onSelect={selectSector} onLongPress={item => setFocusedSectorKey(current => current === item.key ? null : item.key)} decimalPlaces={MOBILE_DECIMAL_PLACES} />
            </div>}
        </div>
        {pageSwipePreview && <div aria-hidden="true" inert className="absolute inset-0 p-1" style={{ transform: swipePreviewTransform, transition: swipeTransition, pointerEvents: 'none', willChange: 'transform' }}>
          {renderSwipePreview()}
        </div>}
      </section>

      <section ref={settingsSectionRef} data-mobile-settings-panel role="region" aria-label="설정" className="relative z-10 mx-1 shrink-0 rounded-t-[16px] rounded-b-none border-t border-ui-border bg-ui-panel shadow-[0_-6px_24px_rgba(0,0,0,0.25)]">
        <div className="relative h-[24px]">
        <button type="button" aria-label={settingsOpen ? '설정 닫기' : '설정 열기'} aria-expanded={settingsOpen} onClick={() => {
          if (suppressClickRef.current) { suppressClickRef.current = false; return }
          setSettingsOpen(!settingsOpen)
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
        }} onPointerCancel={() => { dragRef.current = null; setDragHeight(null) }} className="absolute left-1/2 top-0 flex h-[24px] w-16 -translate-x-1/2 touch-none items-center justify-center border-0 bg-transparent p-0 text-ui-white before:absolute before:left-1/2 before:top-1/2 before:h-[48px] before:w-[48px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']">
          <span aria-hidden="true" className="h-1 w-12 -translate-y-0.5 rounded-full bg-ui-muted" />
        </button>
        {data?.snapshotTime && <span className="absolute left-3 top-0 flex h-[24px] items-center overflow-hidden whitespace-nowrap text-ellipsis text-[11px] tabular-nums text-ui-muted min-[360px]:text-[12px] min-[400px]:text-[13px]" style={{ maxWidth: 'calc(50% - 2.5rem)' }}>{toSnapshotDateLabel(data.snapshotTime)} {toSnapshotTimeOnlyLabel(data.snapshotTime)}</span>}
        </div>
        <div style={{ height: dragHeight === null ? (settingsOpen ? `${settingsHeight()}px` : '0px') : `${dragHeight}px`, transition: dragHeight === null && settingsLayoutReady ? 'height 240ms ease-out' : 'none' }} className="overflow-hidden motion-reduce:!transition-none">
          <div ref={settingsContentRef} inert={!settingsOpen && dragHeight === null} className="max-h-[calc(40dvh-24px)] [@media(max-height:500px)]:max-h-[calc(60dvh-24px)] overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
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
                  setMajorName(null); setMidName(null); setSelectedStocks(null); setGraphEntryOffset(0); setViewMode('sector'); setFocusedStockCode(null)
                }} className={`${SETTING_CHIP_CLASS} ${selected ? 'bg-brand-surface text-ui-on-dark' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>
              })}
            </div>
          </SettingRow>
          <SettingRow label="마켓">
            <div role="radiogroup" aria-label="마켓 선택" className="grid flex-1 grid-cols-3 gap-1.5">
              {MARKETS.map(option => <button key={option.value} type="button" role="radio" aria-checked={market === option.value} onClick={() => selectMarket(option.value)} className={`${SETTING_CHIP_CLASS} ${market === option.value ? 'bg-brand-surface text-ui-on-dark' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>)}
            </div>
          </SettingRow>
          {isGraph && <SettingRow label="업종 단계">
            <div role="radiogroup" aria-label="업종 분류 단계" className="grid flex-1 grid-cols-3 gap-1.5">
              {[{ value: 1, label: '대분류' }, { value: 2, label: '중분류' }, { value: 3, label: '소분류' }].map(option => <button key={option.value} type="button" role="radio" aria-checked={Math.min(graphDepth, selectableDepth) === option.value} disabled={option.value > selectableDepth} onClick={() => {
                setGraphDepth(option.value); setMajorName(null); setMidName(null); setSelectedStocks(null); setGraphEntryOffset(0); setViewMode('sector'); setFocusedStockCode(null)
              }} className={`${SETTING_CHIP_CLASS} disabled:opacity-35 ${Math.min(graphDepth, selectableDepth) === option.value ? 'bg-brand-surface text-ui-on-dark' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>)}
            </div>
          </SettingRow>}
          {!isGraph && <SettingRow label="박스 크기">
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {[{ value: 0, label: '동일' }, { value: MOBILE_BALANCED_BOX_SIZE_RATIO, label: '균형' }, { value: 100, label: '시총 비례' }].map(option => <button key={option.value} type="button" aria-pressed={boxSizeMarketCapRatio === option.value} onClick={() => onChangeBoxSizeMarketCapRatio(option.value)} className={`${SETTING_CHIP_CLASS} ${boxSizeMarketCapRatio === option.value ? 'bg-brand-surface text-ui-on-dark' : 'bg-ui-control text-ui-white'}`}>{option.label}</button>)}
            </div>
          </SettingRow>}
          </div>
        </div>
      </section>
    </main>
  )
}
