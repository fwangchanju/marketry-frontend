import MainAreaLoading from '@/components/MainAreaLoading'
import { revealMobileCapture } from '@/utils/revealMobileCapture'
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useSettled } from '@/hooks/useSettled'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import MobileSectorMapFrame from '@/components/MobileSectorMapFrame'
import MobileMapShell from '@/components/MobileMapShell'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { calculateSectorLayoutWeights, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import { MOBILE_PATH_CANVAS_ZOOM, mobilePathBarLeftShift } from '@/utils/mobilePathBar'
import PathBar, { type PathCrumb } from '@/components/PathBar'
import { applyStockMoves, type StockMoves } from '@/utils/stockMoves'
import type { StockDrop } from '@/hooks/useStockDrag'
import { useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import SettingsPanel, {
  SettingsPanelGroup,
  SettingsMarketValueSection,
  SettingsSectorLevelSection,
  SettingsExcludeSection,
  SettingsColorSection,
  SettingsStrongIndustryColorSection,
  SettingsTopPickSection,
  SettingsStockSizeSelector,
  type SettingsPanelSectionId,
} from '@/components/SettingsPanel'
import ScreenshotModal from '@/components/ScreenshotModal'
import Heatmap from '@/components/Heatmap'
import MobileMapHeatmapFrame from '@/components/MobileMapHeatmapFrame'
import { toDisplayGroup } from '@/utils/mobileMapHeatmap'
import { isInDepthRange } from '@/utils/sectorDepth'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { CustomPageBadgeLink, EmptyLogoMessage, EMPTY_DATA_MESSAGE, EMPTY_FILTER_MESSAGE, EMPTY_MINE_MESSAGE } from '@/components/EmptyMessage'
import Spinner, { MOBILE_LOADING_SIZE_CLASS } from '@/components/Spinner'
import MapStockChart from '@/components/MapStockChart'
import MobileMapStockChart from '@/components/MobileMapStockChart'
import { MapChangeFilterSections, MapExperimentSections } from '@/components/MapSettingsSections'
import { useMapStockChart } from '@/hooks/useStockChart'
import NavBarPageActions from '@/components/NavBarPageActions'
import { useHeatmapDrilldown } from '@/hooks/useHeatmapDrilldown'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { CAPTURE_ID } from '@/utils/captureIds'
import { SUMMARY_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT, screenshotElementToDataUrl } from '@/utils/screenshotToPreview'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { useMapDrilldownHistory, useMapSectorEntry } from '@/hooks/useMapDrilldownHistory'
import { limitDepth, flattenAllItems } from '@/hooks/useFilteredHeatmap'
import type { HeatmapSectorNode, HeatmapItem } from '@/types/api'
import MarketToolbarContent from '@/components/MarketToolbarContent'
import Toolbar from '@/components/Toolbar'
import type { MobileMapMarket } from '@/utils/mobileMarketRoutes'
import type { MarketColors, MarketFilters, MarketMap, MarketScreenData } from '@/markets/marketContract'
import type { marketMenu } from '@/utils/marketMenu'
import type { TaxonomyKey } from '@/utils/taxonomyNames'

declare global {
  interface Window {
    marketryCaptureMap?: () => Promise<string>
  }
}
// 종목·업종 헤더와 같은 방식 — 올리면 흰색 35% 덮개가 씌워진다(index.css의 hover와 같은 불투명도).
// 이동 경로의 이름이 몇 번째 업종 단계인지(0부터) — 마우스가 이미 그 이름 위에 있어서 툴팁에는 이름 대신 단계 이름만 쓴다. 업종은 최대 4단계(대분류·중분류·소분류·세분류)다.
const LEVEL_LABELS = ['대분류', '중분류', '소분류', '세분류']
const SECTION_ORDER: SettingsPanelSectionId[] = ['stockDisplay', 'composition', 'industry', 'colors', 'special']
// "업종 단계" 슬라이더가 "끄기"(뎁스 0)일 때만 쓰는 합성 섹터 — 실제 섹터가 아니므로
// sectorId는 실제 값과 겹치지 않는 sentinel을 쓰고, isSelf로 매칭해 헤더 자체를 안 그리게 한다
// (드릴다운으로 들어온 섹터의 헤더를 breadcrumb과 중복되지 않게 숨기는 것과 동일한 메커니즘).
const FLAT_GROUP_SECTOR_ID = -1
const FLAT_GROUP_NAME = '__flat__'
function toFlatDisplayGroup(items: HeatmapItem[]): DisplayGroup {
  return {
    sectorId: FLAT_GROUP_SECTOR_ID,
    sectorName: FLAT_GROUP_NAME,
    totalMarketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0),
    weightedAvgChangeRate: null,
    simpleAvgChangeRate: null,
    items,
    children: [],
  }
}
const NO_STOCK_MOVES: StockMoves = {}
// 등락률 평균/상승·하락·보합 종목수는 개별 종목(changeRate) 기준이라, 지금 화면에 보이는
// 그룹들의 종목을 전부(하위 섹터 포함) 펼쳐서 모아야 한다.
function collectItems(groups: DisplayGroup[]): HeatmapItem[] {
  const result: HeatmapItem[] = []
  for (const group of groups) {
    result.push(...group.items)
    result.push(...collectItems(group.children))
  }
  return result
}
// 섹터 제외/시가총액 구간 필터를 적용하기 "전" 원본 트리 기준으로, 지금 보고 있는 뎁스(path)에
// 해당하는 종목을 전부 모은다 — "제외된 개수까지 포함한 전체 리스트 개수"를 보여주기 위한 분모.
function collectRawItems(nodes: HeatmapSectorNode[]): HeatmapItem[] {
  const result: HeatmapItem[] = []
  for (const node of nodes) {
    result.push(...node.items)
    result.push(...collectRawItems(node.children))
  }
  return result
}
function findRawNodeByPath(nodes: HeatmapSectorNode[], path: string[]): HeatmapSectorNode | null {
  let node: HeatmapSectorNode | null = null
  let siblings = nodes
  for (const name of path) {
    const found = siblings.find(n => n.sectorName === name)
    if (!found) return null
    node = found
    siblings = found.children
  }
  return node
}
export type MapPanelProps = Omit<ComponentProps<typeof SettingsPanel>, 'children' | 'pageLabel' | 'taxonomyAtBottom' | 'isOpen' | 'onOpenChange' | 'isOnLeft' | 'onToggleSide' | 'taxonomy' | 'sectionOrder' | 'stockCountLabel'>

// 모든 시장의 MAP — PC, MOBILE 종목 지도, 텔레그램 캡처. 시장 이름을 보고 갈라지지 않고 넘겨받은 값만 그린다.
export default function MapScreen({ market, map, menu, taxonomy, filters, colors, routes, sheetMarket, panel }: {
  market: MarketScreenData
  map: MarketMap
  menu: ReturnType<typeof marketMenu>
  taxonomy: TaxonomyKey
  filters: MarketFilters
  colors: MarketColors
  routes: { summary: string; graph: string }
  sheetMarket: MobileMapMarket
  panel: MapPanelProps
}) {
  const { label, tree: rootNodes, state, indexBars, isMineEmpty, features, currencyUnit } = market
  const { filteredNodes: filteredRootNodes, maxDepth, heatmap, boxSizeRatio, captureBoxSizeRatio, stockPopupOnHover, scope } = map
  const { valueRange, sectorExclusion } = filters
  const { colorScale, strongIndustryColor, legendSwatches } = colors
  const { marketValueDepthRange, weightedAvgDepthRange, simpleAvgDepthRange, upDownCountDepthRange, stretch, tile, canExclude, labelMinAreaPercent, stockLabelMode, decimalPlaces, topPickSectorKeys } = heatmap
  const isLoading = state.status === 'loading'
  const isError = state.status === 'error'
  const retry = state.status === 'error' ? state.retry : undefined
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  // 종목 박스의 차트 아이콘·클릭·더블 클릭으로 지도 자리에 그 종목의 차트를 보여 준다(툴바·면책 줄은 그대로). 뒤로가기도 차트에서 지도로 돌아온다.
  const { chartStock, closeChart, stockChartTrigger, setStockChartTrigger, openStockChart } = useMapStockChart({ stockPopupOnHover, sectorNodes: filteredRootNodes })
  const [isMobileScreenshotSelected, setIsMobileScreenshotSelected] = useState(false)
  // 공통 설정 탭의 설정은 어디에도 저장하지 않는다. 종목 이동의 켜기 상태와 옮긴 결과(stockMoveState)도 이 화면의 메모리에만 둔다.
  const [stockMoveEnabled, setStockMoveEnabled] = useState(false)
  const [stockMoveState, setStockMoveState] = useState<{ scope: string; moves: StockMoves }>({ scope: '', moves: {} })
  // 텔레그램 렌더러가 이 함수를 호출해 화면 캡처와 같은 글꼴·여백·배율로 저장한다.
  const isMobileCaptureMode = searchParams.get('capture') === 'mobile'
  // MOBILE(좁은 화면)에서는 PC 화면 대신 모바일 판(캡처 모드와 같은 5:8 프레임)만 화면 폭에 맞춰 보여 준다. 실험 기능이라 되돌리기 쉽게 이 분기만 둔다.
  const isMobileMapFrame = useIsNarrowScreen() && !isMobileCaptureMode
  // MOBILE 지도의 박스 크기는 PC 설정과 따로 두고, 다른 시장·화면과 같은 모바일 값(기본 시총 비례)을 쓴다.
  const [storedMobileBoxSizeRatio, onChangeMobileBoxSizeRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  const mobileBoxSizeRatio = normalizeMobileBoxSizeRatio(storedMobileBoxSizeRatio)
  useCarriedBoxSize(onChangeMobileBoxSizeRatio)
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const isMobileFrameVisible = isMobileCaptureMode || isMobileMapFrame
  const mobileFrameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  // 텔레그램 캡션은 지도 첫 화면 업종 헤더에 실제로 보이는 등락률을 읽는다. 동일 가중만 보이면 동일 가중, 그 밖에는 시총 가중이다.
  const captureRowMetric = isInDepthRange(simpleAvgDepthRange, 0) && !isInDepthRange(weightedAvgDepthRange, 0)
    ? 'simpleAvgChangeRate'
    : 'weightedAvgChangeRate'
  const [isMobileCaptureReady, setIsMobileCaptureReady] = useState(false)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
  // null이 아니면 Heatmap이 해당 뎁스로 줄어드는 줌아웃 애니메이션을 재생하고, 끝나면
  // handleZoomOutComplete를 불러서 실제 이동을 한다 — 애니메이션 도중엔 path/groups를 먼저 바꾸지 않는다.
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy: handleCopy, copyLabel, isCopying } = useScreenshotShare()
  const { path, setPath, currentNode, currentSiblings, enterSector, goToDepth, reset } = useHeatmapDrilldown(filteredRootNodes)
  // "업종 단계" 뎁스 제한은 진짜 루트(대분류) 기준 절대값이다 — 설정이 중분류까지면 어디로 드릴다운해도 중분류까지만 보인다.
  // 드릴다운해서 대분류 하나로 들어가면(path.length = 1) 이미 한 단계를 내려온 것이라, 그 안에서는 남은 단계(설정값 - path.length)만 보인다.
  // 다만 들어간 업종의 바로 아래 한 단계는 항상 보여야 하므로 최소 1단계다. 드릴다운 상태에서는 헤더를 그리지 않는 자기 자신은
  // 단계로 세지 않고 그 자식부터 1단계로 센다. 설정(3-1)이 꺼져 있으면 제한이 없다. 거래소 분류는 시장 어댑터가 대분류(1단계)로 제한한다.
  const effectiveMaxDepth = maxDepth != null && maxDepth > 0 ? Math.max(1, maxDepth - path.length) : maxDepth
  // 뎁스 0("끄기")은 limitDepth로 표현할 수 없다(그 함수는 항상 최소 1뎁스 = 대분류 박스 하나는
  // 남긴다) — 완전 평탄화는 별도로 처리한다: 지금 보이는 위치 아래 종목을 전부 하나로 모아
  // isSelf 처리되는 합성 섹터 하나로 만들어서, 대분류 헤더까지 포함해 아무 섹터 박스도
  // 안 보이게 한다.
  const isFullyFlattened = effectiveMaxDepth === 0
  const displaySiblings =
    effectiveMaxDepth != null && !isFullyFlattened ? limitDepth(currentSiblings, effectiveMaxDepth) : currentSiblings
  const displayNode =
    currentNode && effectiveMaxDepth != null && !isFullyFlattened
      ? { ...currentNode, children: limitDepth(currentNode.children, effectiveMaxDepth) }
      : currentNode
  const baseGroups: DisplayGroup[] = isFullyFlattened
    ? [toFlatDisplayGroup(flattenAllItems(currentNode ? [currentNode] : currentSiblings))]
    : displayNode
      ? [toDisplayGroup(displayNode)]
      : displaySiblings.map(toDisplayGroup)
  // 공통 설정 탭의 종목 이동 — 끌어서 옮긴 종목을 화면에서만 도착 업종으로 옮겨 그린다. 메모리에만 두고(서버·브라우저에 저장하지 않는다),
  // 켜기를 끄거나 시장·분류를 바꾸면 쓰지 않으며 다른 페이지로 가면 상태째 사라진다.
  const stockMoveScope = `${scope}|${taxonomy}`
  const stockMoves = stockMoveEnabled && stockMoveState.scope === stockMoveScope ? stockMoveState.moves : NO_STOCK_MOVES
  const groups = applyStockMoves(baseGroups, stockMoves)
  const visibleItems = collectItems(groups)
  // 종목 지도에서 업종 지도로 스와이프할 때 따라올 미리보기. 업종 지도 화면과 같은 크기·박스 비율로 그린다.
  const sectorPreviewItems = useMemo(() => {
    const source: MobileSectorMapItem[] = groups.map(group => ({
      key: String(group.sectorId),
      name: group.sectorName,
      marketValue: group.totalMarketValue,
      changeRate: group.weightedAvgChangeRate ?? group.simpleAvgChangeRate ?? 0,
    }))
    const weights = calculateSectorLayoutWeights(source, mobileBoxSizeRatio)
    return source.map((item, index) => ({ ...item, layoutValue: weights[index] }))
  }, [groups, mobileBoxSizeRatio])
  // 지금 뎁스(path) 기준으로, 섹터 제외/시가총액 구간 필터를 적용하기 전 원본 트리에 있는 전체 종목 수.
  const rawCurrentNode = findRawNodeByPath(rootNodes, path)
  const totalItemCount = rawCurrentNode ? collectRawItems([rawCurrentNode]).length : map.totalStockCount
  // 시장 안의 구분이 바뀌면 들어간 업종을 처음으로 돌린다. 첫 렌더는 되돌릴 것이 없어 실제로 바뀐 때만 반응한다.
  const previousScopeRef = useRef(scope)
  useEffect(() => {
    if (previousScopeRef.current === scope) return
    previousScopeRef.current = scope
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scope가 바뀔 때만 반응하면 됨(reset은 매 렌더 새 함수)
  }, [scope])
  // breadcrumb에서 상위 뎁스로 갈 때, 바로 이동하지 않고 줌아웃 애니메이션을 먼저 요청한다.
  const handleGoToDepth = (depth: number) => {
    if (depth >= path.length) return
    setZoomOutRequestDepth(depth)
  }
  const handleZoomOutComplete = (depth: number) => {
    goToDepth(depth)
    setZoomOutRequestDepth(null)
  }
  // 분류를 한 단계씩 들어가고 나오는 것의 브라우저 기록(뒤로가기·앞으로가기)·백스페이스와, 그래프에서 업종을 눌러 온 주소(?sector=) 처리는
  // 일본·미국 지도와 같은 부품(useMapDrilldownHistory)이 한다.
  const { markEntryFromOtherPage } = useMapDrilldownHistory({ path, setPath, zoomOutRequestDepth, handleGoToDepth, isShareOpen })
  useMapSectorEntry({ filteredRootNodes, enterSector, pathLength: path.length, markEntryFromOtherPage })
  // 끌어서 놓은 종목을 화면에서만 옮긴다. 저장되지 않는다는 안내는 켤 때 한 번만 띄운다.
  const handleMoveStock = (drop: StockDrop) => {
    setStockMoveState(previous => ({
      scope: stockMoveScope,
      moves: { ...(previous.scope === stockMoveScope ? previous.moves : {}), [drop.stockCode]: drop.targetSectorId },
    }))
  }
  // 렌더러용 모바일 판 — 데이터가 오고 히트맵 배치가 끝나면 스크린샷 창이 복제본에 하던 것(툴바 채우기·보이게 하기)을 화면의 틀에 한 번 하고 준비됐다고 알린다.
  const canShowMobileCapture = isMobileFrameVisible && !isLoading && !isError && visibleItems.length > 0
  // 툴바 시계가 새 시각으로 움직이는 동안(1초)에는 복제하지 않는다 — 종가·별도 기준으로 옮겨 가면 시각이 바뀐다.
  const isMobileCaptureSettled = useSettled(canShowMobileCapture, map.captureSettleKey, 1300)
  useEffect(() => {
    if (!isMobileCaptureSettled || isMobileCaptureReady) return
    let rafId = 0
    const revealWhenLaidOut = () => {
      if (!document.querySelector('[data-map-mobile-capture] [data-heatmap-layout-ready="true"]')) {
        rafId = requestAnimationFrame(revealWhenLaidOut)
        return
      }
      revealMobileCapture(document.body, true)
      setIsMobileCaptureReady(true)
    }
    rafId = requestAnimationFrame(revealWhenLaidOut)
    return () => cancelAnimationFrame(rafId)
  }, [isMobileCaptureSettled, isMobileCaptureReady])
  useEffect(() => {
    if (!isMobileCaptureMode || !isMobileCaptureReady) return
    const capture = () => {
      const root = screenshotRef.current
      if (!root) throw new Error('캡처할 지도 영역이 없습니다.')
      return screenshotElementToDataUrl(root, '[data-map-mobile-capture-frame]', 'element', revealMobileCapture)
    }
    window.marketryCaptureMap = capture
    return () => { delete window.marketryCaptureMap }
  }, [isMobileCaptureMode, isMobileCaptureReady])
  // PC 툴바. 화면에서는 이 자리에, MOBILE 판에서는 캡처와 같은 방식으로 복제할 원본으로 쓴다.
  const mapToolbarNode = <Toolbar><MarketToolbarContent page="MAP" market={market} menu={menu} right={isMobileMapFrame ? null : <TaxonomyBadge taxonomy={taxonomy} strongIndustryColor={strongIndustryColor} />} /></Toolbar>
  // 모바일 판 프레임(캡처 모드와 MOBILE 화면이 같이 쓴다). 데이터·배치 준비가 끝난 뒤에만 그린다.
  const mobileFrameNode = ((isShareOpen && isMobileScreenshotSelected) || isMobileFrameVisible) && !isLoading && !isError && visibleItems.length > 0 && (
            <div
              aria-hidden={isMobileMapFrame ? undefined : true}
              data-map-mobile-capture-frame
              data-captureid={isMobileCaptureMode ? 'map-mobile-capture' : undefined}
              data-capture-ready={isMobileCaptureMode ? isMobileCaptureReady : undefined}
              // 모바일 캡처와 텔레그램 지도는 동일한 5:8 프레임과 여백을 쓴다.
              style={{ opacity: isMobileMapFrame ? 1 : 0, width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: isMobileMapFrame ? `scale(${mobileFrameScale})` : undefined, transformOrigin: 'top left' }}
              className={isMobileMapFrame ? "relative z-[60] bg-ui-background" : "pointer-events-none absolute z-[60] left-0 top-0 bg-ui-background"}
            >
            <div
              aria-hidden="true"
              data-map-mobile-capture
              style={{ opacity: isMobileMapFrame ? 1 : 0, width: '100%', height: '100%' }}
              className="flex flex-col bg-ui-background"
            >
              {isMobileMapFrame ? null : <div data-map-mobile-toolbar-placeholder className="main-toolbar relative mt-[3px] mb-0 h-7 w-full shrink-0 bg-ui-background/70" />}
              <MobileMapHeatmapFrame
                path={path}
                marketLabel={label}
                strongIndustryColor={strongIndustryColor}
                heatmapProps={{
                  groups,
                  selfSectorName: isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null),
                  depth: path.length,
                  onSelectSector: () => {},
                  onExcludeSector: () => {},
                  heightClassName: 'min-h-0 flex-1',
                  marketValueDepthRange,
                  weightedAvgDepthRange,
                  simpleAvgDepthRange,
                  upDownCountDepthRange,
                  boxSizeMarketCapRatio: isMobileMapFrame ? mobileBoxSizeRatio : captureBoxSizeRatio,
                  currencyUnit,
                  stretch: stretch ?? undefined,
                  tile,
                  canExclude: false,
                  colorScale,
                  labelMinAreaPercent,
                  stockLabelMode,
                  stockPopupOnHover: false,
                  // 실제 MOBILE 화면에서는 한 번 눌러 차트를 열던 동작을 없애고, 팝업의 차트 아이콘으로만 연다. 캡처·스와이프 미리보기는 그대로다.
                  stockChartTrigger: 'rightClick',
                  onOpenStockChart: isMobileMapFrame ? openStockChart : undefined,
                  // 실제 MOBILE 화면에서만 종목 팝업을 툴바 줄 팝업과 같은 배율로 키운다. 캡처·미리보기는 그대로다.
                  mobilePopupEnlarged: isMobileMapFrame,
                  decimalPlaces,
                  topPickSectorKeys,
                  strongIndustryColor,
                  zoomOutRequestDepth: null,
                  onZoomOutComplete: () => {},
                  captureRowMetric,
                }}
              />
            </div>
            </div>
          );
  // 지도를 그릴 수 없을 때의 안내. 판과 같은 좌표계에 그려 다른 MOBILE 화면과 같은 크기로 보이게 한다.
  const mobileStatusFrame = (
    <div className="flex items-center justify-center bg-ui-background" style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, transform: `scale(${mobileFrameScale})`, transformOrigin: 'top left' }}>
      {isLoading ? <Spinner delayReveal showElapsed className={MOBILE_LOADING_SIZE_CLASS} />
        : isError ? <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={retry} />
          : <p className="text-[28px] text-ui-muted">{isMineEmpty ? EMPTY_MINE_MESSAGE : totalItemCount === 0 ? EMPTY_DATA_MESSAGE : EMPTY_FILTER_MESSAGE}</p>}
    </div>
  )
  const sectorPreview = (
    <MobileSectorMapFrame scale={mobileFrameScale} crumbs={[{ key: 'market', label, current: true }]}>
      <MobileSectorMap items={sectorPreviewItems} colorScale={colorScale} onSelect={() => {}} decimalPlaces={decimalPlaces} />
    </MobileSectorMapFrame>
  )
  // 종목 지도에서 그룹 등락률 쪽(오른쪽 스와이프)으로 갈 때 왼쪽에서 따라올 미리보기. 도착 화면과 같은 막대·경로 줄·지수를 그린다.
  const graphPreviewItems: MobileGraphItem[] = sectorPreviewItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate }))
  for (const bar of indexBars) if (bar.value !== null) graphPreviewItems.push({ key: bar.key, name: bar.name, value: bar.value, reference: true })
  // 지수는 히트맵과 다른 조회에서 오므로, 지수까지 준비된 뒤 막대와 함께 그린다.
  const isGraphPreviewLoading = isLoading || map.isIndexPending
  const graphPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${mobileFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <section aria-label="업종 등락률 그래프" className="flex h-full flex-col bg-ui-background p-1">
        <div style={{ zoom: MOBILE_PATH_CANVAS_ZOOM }}>
          <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${mobilePathBarLeftShift(4)}px)` }}>
            <PathBar variant="mobile" currentAria="location" crumbs={[{ key: 'market', label, current: true }]} />
          </header>
        </div>
        {isGraphPreviewLoading
          ? <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner /></div>
          : <MobileGraphBars items={graphPreviewItems} colorScale={colorScale} highlightColor={strongIndustryColor} />}
      </section>
    </div>
  )

  if (isMobileMapFrame) {
    return (
      <>
        <MobileMapShell
          zoomMode="pinch"
          onSwipe={direction => navigate(direction === 'next' ? routes.summary : routes.graph)}
          toolbar={mapToolbarNode}
          pageTitle="종목 지도"
          frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * mobileFrameScale}
          frame={mobileFrameNode || mobileStatusFrame}
          nextPreview={sectorPreview}
          previousPreview={graphPreview}
          current={sheetMarket}
          boxSize={mobileBoxSizeRatio}
          onChangeBoxSize={onChangeMobileBoxSizeRatio}
        />
        {chartStock !== null && (
          <MobileMapStockChart
            chartStock={chartStock}
            marketLabel={label}
            levelLabels={LEVEL_LABELS}
            market={sheetMarket}
            closeChart={closeChart}
            onGoToRoot={() => goToDepth(0)}
            onEnterSector={enterSector}
          />
        )}
      </>
    )
  }
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar actions={<NavBarPageActions onRefresh={market.refresh.run} isRefreshing={market.refresh.isRunning} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} onOpenShare={() => openScreenshot(screenshotRef.current)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} showRefresh={false} />} />
      <div className="flex min-h-0 flex-1">
        {/* 메뉴 줄을 화면 왼쪽 세로 줄로 뺀다. 오른쪽 버튼 묶음은 위쪽 상단 영역에 둔다. */}
        <NavSubBar
          vertical
          // 지금 보는 시장을 메뉴 목록에서 다시 고르면 처음 단계(드릴다운 맨 위)로 돌아간다.
          onReselectCurrent={() => handleGoToDepth(0)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        {/* 공유·텔레그램 모두 [세 번째 바+본문] 열만 스크린샷으로 찍어 설정창을 제외한다. */}
        <div
          ref={settingsRowRef}
          className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 bg-ui-background"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다 — 내부 콘텐츠(히트맵)가 넘치면 이 컬럼 안에서만 처리된다. */}
          <div ref={screenshotRef} data-main-area data-captureid={CAPTURE_ID.MAP} data-capture-ready={!isLoading} className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
            {/* 왼쪽은 마켓·기간·시계·시간대 묶음, 오른쪽 끝은 프로필(사진 + 거래소·MARKETRY). 두 묶음이 같은 줄에서 서로 밀어내므로
                창이 좁아져도 겹치지 않고, 부족하면 오른쪽 글자가 먼저 줄어든다. */}
            {mapToolbarNode}
            <div className="flex min-h-0 flex-1">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
              {features.timeWindowNotice}
              {chartStock !== null ? (
                <MapStockChart chartStock={chartStock} marketLabel={label} levelLabels={LEVEL_LABELS} market={sheetMarket} closeChart={closeChart} onGoToRoot={() => handleGoToDepth(0)} onEnterSector={enterSector} />
              ) : (
              <>
              {path.length > 0 && (
                // 이름마다 "그 단계로만" 이동하는 링크다 — 줄 전체를 눌러 전체로 가던 동작은 없앴다. 지금 보고 있는 마지막 이름은 현재 위치 표시다.
                <PathBar
                  currentAria="page"
                  accentColor={strongIndustryColor}
                  crumbs={[
                    { key: 'market', label: label, onClick: () => handleGoToDepth(0), hint: '전체로 돌아가기' },
                    ...path.map((name, index): PathCrumb => index === path.length - 1
                      ? { key: `path-${index}`, label: name, current: true }
                      : { key: `path-${index}`, label: name, onClick: () => handleGoToDepth(index + 1), hint: `${LEVEL_LABELS[index]}로 돌아가기` }),
                  ]}
                />
              )}
              {/* 로딩·오류 원은 모든 페이지 공통 자리(MainAreaLoading, 메인 영역 기준)에 둔다. */}
              {isLoading ? (
                <MainAreaLoading><Spinner delayReveal showElapsed /></MainAreaLoading>
              ) : isError ? (
                <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={retry} /></MainAreaLoading>
              ) : visibleItems.length === 0 ? (
                isMineEmpty ? (
                  <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
                    <CustomPageBadgeLink to={market.mineSetupPath} />
                  </EmptyLogoMessage>
                ) : (
                  <div className="relative flex-1">
                    <EmptyMessage
                      message={totalItemCount === 0 ? EMPTY_DATA_MESSAGE : EMPTY_FILTER_MESSAGE}
                      topClass="-top-1"
                    />
                  </div>
                )
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* 바깥 main-settings-row에서 양옆·설정창 사이 여백을 관리한다. */}
                  <Heatmap
                    groups={groups}
                    selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)}
                    depth={path.length}
                    onSelectSector={enterSector}
                    onExcludeSector={sectorExclusion.exclude}
                    stockChartTrigger={stockChartTrigger}
                    onOpenStockChart={openStockChart}
                    heightClassName="min-h-0 flex-1"
                    marketValueDepthRange={marketValueDepthRange}
                    weightedAvgDepthRange={weightedAvgDepthRange}
                    simpleAvgDepthRange={simpleAvgDepthRange}
                    upDownCountDepthRange={upDownCountDepthRange}
                    boxSizeMarketCapRatio={boxSizeRatio}
                    currencyUnit={currencyUnit}
                    stretch={stretch ?? undefined}
                    tile={tile}
                    canExclude={canExclude}
                    colorScale={colorScale}
                    labelMinAreaPercent={labelMinAreaPercent}
                    stockLabelMode={stockLabelMode}
                    stockPopupOnHover={stockPopupOnHover}
                    decimalPlaces={decimalPlaces}
                    topPickSectorKeys={topPickSectorKeys}
                    strongIndustryColor={strongIndustryColor}
                    zoomOutRequestDepth={zoomOutRequestDepth}
                    stockMoveEnabled={stockMoveEnabled && !isMobileCaptureMode}
                    onMoveStock={handleMoveStock}
                    onZoomOutComplete={handleZoomOutComplete}
                  />
                </div>
              )}
              </>
              )}
              {/* 등락률 색상 범례 — 지도 우하단에 오른쪽 끝에 붙여 둔다. 이 줄만큼 지도 아래쪽이 올라온다. 로딩·오류·빈 화면에서도 면책 문구와 함께 맨 아래에 그대로 둔다. */}
              <DisclaimerFooter rightContent={<ChangeRateBar swatches={legendSwatches} />} />
              </div>
            </div>
          {/* PC 캡처에서는 모바일용 히트맵을 만들지 않아 화면 렌더링과 DOM 복제 비용을 줄인다. */}
          {mobileFrameNode}
          </div>
          {/* 설정창 위쪽 여백 4px — 헤더를 위로 3px 늘리고 아래 구분선 위치는 유지한다. */}
          <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsPanel
              {...panel}
              taxonomy={taxonomy}
              isOpen={isSettingsOpen}
              onOpenChange={setIsSettingsOpen}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              pageLabel="Map"
              sectionOrder={SECTION_ORDER}
              taxonomyAtBottom
              stockCountLabel={formatStockCountLabel(visibleItems.length, totalItemCount)}
              onSelectTaxonomy={next => {
                panel.onSelectTaxonomy?.(next)
                reset()
              }}
            >
              <SettingsPanelGroup section="composition">
                <SettingsMarketValueSection isCustom={false} tiers={valueRange.tiers} tierRangeMinIndex={valueRange.minIndex} tierRangeMaxIndex={valueRange.maxIndex} onChangeTierRange={valueRange.setRange} showDivider={false} currencyUnit={currencyUnit} />
                <SettingsExcludeSection sectorFilterEnabled={sectorExclusion.enabled} onToggleSectorFilter={sectorExclusion.toggle} excludedSectors={sectorExclusion.rows} onRemoveExcludedSector={sectorExclusion.remove} suspendedStockCount={sectorExclusion.suspendedStockCount ?? undefined} />
                <MapChangeFilterSections
                  {...map.changeFilters}
                  onChangeStockChangeFilter={value => {
                    map.changeFilters.onChangeStockChangeFilter(value)
                    reset()
                  }}
                />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="industry">
                <SettingsSectorLevelSection {...map.sectorLevel} showStockDisplay={false} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="stockDisplay">
                <SettingsStockSizeSelector marketCapRatio={boxSizeRatio} onChangeMarketCapRatio={map.setBoxSizeRatio} />
                <SettingsSectorLevelSection {...map.sectorLevel} showTaxonomy={false} showDecimalPlaces />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="colors">
                <SettingsColorSection {...colors.scaleSection} />
                <SettingsStrongIndustryColorSection {...colors.strongSection} />
                <SettingsTopPickSection {...map.topPick} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="special">
                <MapExperimentSections
                  stockPopupOnHover={stockPopupOnHover}
                  onChangeStockPopupOnHover={map.setStockPopupOnHover}
                  stockChartTrigger={stockChartTrigger}
                  onChangeStockChartTrigger={setStockChartTrigger}
                  stockMoveEnabled={stockMoveEnabled}
                  onChangeStockMoveEnabled={setStockMoveEnabled}
                />
              </SettingsPanelGroup>
            </SettingsPanel>
          </div>
        </div>
      </div>
      {isShareOpen && (
        <ScreenshotModal
          onClose={() => {
            closeScreenshot()
            setIsMobileScreenshotSelected(false)
          }}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          isCopying={isCopying}
          screenshotTarget={screenshotTarget}
          captureReady={!isLoading}
          emptyPreview={isMineEmpty && !isLoading && !isError ? (
            <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
              <CustomPageBadgeLink to={market.mineSetupPath} />
            </EmptyLogoMessage>
          ) : undefined}
          mobileRegionOption={{ label: 'MOBILE', selector: '[data-map-mobile-capture-frame]', mode: 'element', onCloneNode: revealMobileCapture, monitorHorizontalPadding: 4 }}
          onMobileSelectionChange={setIsMobileScreenshotSelected}
        />
      )}
        </div>
      </div>
    </div>
  )
}