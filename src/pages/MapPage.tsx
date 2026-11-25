import MainAreaLoading from '@/components/MainAreaLoading'
import { revealMobileCapture } from '@/utils/revealMobileCapture'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettled } from '@/hooks/useSettled'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import MobileTopBar from '@/components/MobileTopBar'
import PhoneMapShell from '@/components/PhoneMapShell'
import MapToolbar from '@/components/MapToolbar'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { calculateSectorLayoutWeights, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import { PHONE_PATH_CANVAS_ZOOM, phonePathBarLeftShift } from '@/utils/phonePathBar'
import PathBar, { type PathCrumb } from '@/components/PathBar'
import { applyStockMoves, type StockMoves } from '@/utils/stockMoves'
import type { StockDrop } from '@/hooks/useStockDrag'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { marketRoute } from '@/utils/marketRoute'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NxtOnlyNotice from '@/components/NxtOnlyNotice'
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
import Spinner from '@/components/Spinner'
import MapStockChart from '@/components/MapStockChart'
import MobileMapStockChart from '@/components/MobileMapStockChart'
import { MapChangeFilterSections, MapExperimentSections } from '@/components/MapSettingsSections'
import { useMapStockChart } from '@/hooks/useStockChart'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import NavBarPageActions, { SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import { useHeatmapDrilldown } from '@/hooks/useHeatmapDrilldown'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { CAPTURE_ID } from '@/utils/captureIds'
import { SUMMARY_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT, screenshotElementToDataUrl } from '@/utils/screenshotToPreview'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { useMapDrilldownHistory, useMapSectorEntry } from '@/hooks/useMapDrilldownHistory'
import { mapStretchFor, mapTileMethod } from '@/utils/mapStretch'
import { limitDepth, flattenAllItems } from '@/hooks/useFilteredHeatmap'
import type { MarketQuery, HeatmapSectorNode, HeatmapItem } from '@/types/api'
declare global {
  interface Window {
    marketryCaptureMap?: () => Promise<string>
  }
}
const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'K-STOCK' }
// 종목·업종 헤더와 같은 방식 — 올리면 흰색 35% 덮개가 씌워진다(index.css의 hover와 같은 불투명도).
// 이동 경로의 이름이 몇 번째 업종 단계인지(0부터) — 마우스가 이미 그 이름 위에 있어서 툴팁에는 이름 대신 단계 이름만 쓴다. 업종은 최대 4단계(대분류·중분류·소분류·세분류)다.
const SECTOR_LEVEL_LABEL = ['대분류', '중분류', '소분류', '세분류']
const MAP_SETTINGS_SECTION_ORDER: SettingsPanelSectionId[] = [
  'stockDisplay', 'composition', 'industry', 'colors',
]
const SPECIAL_MAP_SETTINGS_SECTION_ORDER: SettingsPanelSectionId[] = [...MAP_SETTINGS_SECTION_ORDER, 'special']
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
export default function MapPage() {
  const isLoggedIn = useIsLoggedIn()
  const {
    settingsModalProps,
    colorEditorPanelProps,
    market,
    isCustom,
    isMarketry,
    taxonomy,
    nxtOnly,
    nxtOnlyWindow,
    changeRateMode,
    changeRateChoice,
    isAfterHoursControlsVisible,
    isAfterHoursSelectable,
    onChangeChangeRateMode,
    data,
    liveSnapshotTime,
    onChangePinnedSnapshotTime,
    onSelectRange,
    rangeStartTime,
    rangeExcludedStocks,
    pinnedSnapshotTime,
    refetchHeatmap,
    isRefetchingHeatmap,
    sectorChangeMaxDepth,
    sectorChangeFilter,
    sectorChangeDepth,
    setSectorChangeFilter,
    setSectorChangeDepth,
    isLoading,
    isError,
    rootNodes,
    filteredRootNodes,
    stockChangeFilter,
    onChangeStockChangeFilter,
    maxDepth,
    marketValueDepthRange,
    weightedAvgDepthRange,
    simpleAvgDepthRange,
    upDownCountDepthRange,
    boxSizeMarketCapRatio,
    onChangeBoxSizeMarketCapRatio,
    topPickSectorKeys,
    strongIndustryColor,
    onChangeStrongIndustryColor,
    onChangeAvgChangeRateUseSimple,
    onChangeSectorFilterEnabled,
    boxLabelMinAreaPercent,
    stockLabelMode,
    stockPopupOnHover,
    setStockPopupOnHover,
    decimalPlaces,
    colorScale,
    handleExcludeSector,
  } = useGlobalSettings({ allowChangeRateMode: true })
  // 특별 회원 탭은 특별 회원과 운영자가 쓴다.
  // 달력에서 지난 날짜를 골라 보는 중이면 시각·시간대·합산/별도 표시는 숨긴다(실시간 정보라서).
  const isPastSnapshot = pinnedSnapshotTime !== undefined
  const [searchParams, setSearchParams] = useSearchParams()
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
  // 폰(좁은 화면)에서는 PC 화면 대신 모바일 판(캡처 모드와 같은 5:8 프레임)만 화면 폭에 맞춰 보여 준다. 실험 기능이라 되돌리기 쉽게 이 분기만 둔다.
  const isPhoneMapFrame = useIsNarrowScreen() && !isMobileCaptureMode
  // 종목 지도에서 그룹 등락률로 스와이프할 때 지수가 도착 뒤에야 오지 않도록 폰 화면에서 미리 받아 둔다(2026-11-22 사용자 제보).
  const { data: marketSummary, isLoading: isMarketSummaryLoading, isFetching: isMarketSummaryFetching } = useMarketSummary(isPhoneMapFrame)
  const showGraphPreviewIndexes = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
  // 폰 지도의 박스 크기는 PC 설정과 따로 두고, 다른 시장·화면과 같은 모바일 값(기본 시총 비례)을 쓴다.
  const [storedMobileBoxSizeRatio, onChangeMobileBoxSizeRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  const mobileBoxSizeRatio = normalizeMobileBoxSizeRatio(storedMobileBoxSizeRatio)
  useCarriedBoxSize(onChangeMobileBoxSizeRatio)
  const isMobileFrameVisible = isMobileCaptureMode || isPhoneMapFrame
  const phoneFrameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
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
  // 단계로 세지 않고 그 자식부터 1단계로 센다. 설정(3-1)이 꺼져 있으면 제한이 없다. 거래소 분류는 useGlobalSettings가 대분류(1단계)로 제한한다.
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
  const stockMoveScope = `${market}|${settingsModalProps.taxonomy}`
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
  // 시장 전체를 볼 때는 정지로 뺀 종목도 분모에 더해 전체 종목 수와 맞춘다(한 업종 안으로 들어가면 그 업종 종목만 센다).
  const totalItemCount = collectRawItems(rawCurrentNode ? [rawCurrentNode] : rootNodes).length + (rawCurrentNode ? 0 : (data?.suspendedStockCount ?? 0))
  // 내 분류에 종목이 하나도 배정되지 않은 상태 — 필터·시총 범위로 다 가려진 경우나 한 업종 안으로 들어간 경우와 구분하려고 전체 트리로 센다.
  const isMineEmpty = isCustom && collectRawItems(rootNodes).length === 0
  // 상단 오른쪽 분류 배지(설정창 분류 선택 버튼과 같은 청록색).
  const modeStatusText = <TaxonomyBadge taxonomy={taxonomy} strongIndustryColor={strongIndustryColor} />
  // market은 이제 useGlobalSettings(useRouteAwareMarket)가 경로를 반영해서 매 렌더 계산해준다 —
  // 여기서는 그 값이 바뀔 때(NavSubBar에서 마켓을 고르는 등) 드릴다운만 초기화한다. 첫 렌더는 초기화할
  // 드릴다운이 없으므로 ref로 이전 값과 비교해서 실제로 바뀐 경우에만 반응한다.
  const previousMarketRef = useRef(market)
  useEffect(() => {
    if (previousMarketRef.current === market) return
    previousMarketRef.current = market
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- market이 바뀔 때만 반응하면 됨(reset은 매 렌더 새 함수)
  }, [market])
  // 스크린샷 URL의 avgMode/sectorFilter를 반영하고, 소비한 쿼리 파라미터를 주소에서 지운다.
  // 옛 스크린샷 URL의 ?market=은 /map·/group 리다이렉트(App.tsx LegacyMarketRedirect)가 이미 경로로 옮겼다.
  // 여기서 지우는 market은 경로가 있는 주소에 붙어 온 값뿐이다 — 마켓은 경로가 정하므로 지우기만 한다.
  useEffect(() => {
    const marketParam = searchParams.get('market')
    const isValidMarket = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK'
    // 백엔드가 스크린샷 URL에 싣는 avgMode=simple|weighted, sectorFilter=true|false 계약에 맞춘다
    // (marketry-backend의 instructions-telegram-average-mode.md 결정 6).
    const avgModeParam = searchParams.get('avgMode')
    const isValidAvgMode = avgModeParam === 'simple' || avgModeParam === 'weighted'
    if (isValidAvgMode) onChangeAvgChangeRateUseSimple(avgModeParam === 'simple')
    const sectorFilterParam = searchParams.get('sectorFilter')
    const isValidSectorFilter = sectorFilterParam === 'true' || sectorFilterParam === 'false'
    if (isValidSectorFilter) onChangeSectorFilterEnabled(sectorFilterParam === 'true')
    if (!isValidMarket && !isValidAvgMode && !isValidSectorFilter) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (isValidMarket) next.delete('market')
        if (isValidAvgMode) next.delete('avgMode')
        if (isValidSectorFilter) next.delete('sectorFilter')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 파라미터가 있을 때만 반응하면 됨
  }, [searchParams])
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
  const isMobileCaptureSettled = useSettled(canShowMobileCapture, `${data?.snapshotTime}|${changeRateChoice}`, 1300)
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
  // PC 툴바. 화면에서는 이 자리에, 폰 판에서는 캡처와 같은 방식으로 복제할 원본으로 쓴다.
  const mapToolbarNode = (
    <MapToolbar
      market={market}
      marketLabel={MARKET_LABEL[market]}
      snapshotTime={data?.snapshotTime ?? null}
      liveSnapshotTime={liveSnapshotTime}
      pinnedSnapshotTime={pinnedSnapshotTime}
      rangeStartTime={rangeStartTime}
      isPastSnapshot={isPastSnapshot}
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
      modeStatusText={isPhoneMapFrame ? null : modeStatusText}
      refreshHelpText={SNAPSHOT_REFRESH_HELP}
      refreshSpinMs={REFRESH_BUTTON_SPIN_MS}
    />
  )
  // 모바일 판 프레임(캡처 모드와 폰 화면이 같이 쓴다). 데이터·배치 준비가 끝난 뒤에만 그린다.
  const mobileFrameNode = ((isShareOpen && isMobileScreenshotSelected) || isMobileFrameVisible) && !isLoading && !isError && visibleItems.length > 0 && (
            <div
              aria-hidden={isPhoneMapFrame ? undefined : true}
              data-map-mobile-capture-frame
              data-captureid={isMobileCaptureMode ? 'map-mobile-capture' : undefined}
              data-capture-ready={isMobileCaptureMode ? isMobileCaptureReady : undefined}
              // 모바일 캡처와 텔레그램 지도는 동일한 5:8 프레임과 여백을 쓴다.
              style={{ opacity: isPhoneMapFrame ? 1 : 0, width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: isPhoneMapFrame ? `scale(${phoneFrameScale})` : undefined, transformOrigin: 'top left' }}
              className={isPhoneMapFrame ? "relative z-[60] bg-ui-background" : "pointer-events-none absolute z-[60] left-0 top-0 bg-ui-background"}
            >
            <div
              aria-hidden="true"
              data-map-mobile-capture
              style={{ opacity: isPhoneMapFrame ? 1 : 0, width: '100%', height: '100%' }}
              className="flex flex-col bg-ui-background"
            >
              {isPhoneMapFrame ? null : <div data-map-mobile-toolbar-placeholder className="main-toolbar relative mt-[3px] mb-0 h-7 w-full shrink-0 bg-ui-background/70" />}
              <MobileMapHeatmapFrame
                path={path}
                marketLabel={MARKET_LABEL[market]}
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
                  boxSizeMarketCapRatio: mobileBoxSizeRatio,
                  stretch: mapStretchFor(settingsModalProps.taxonomy),
                  tile: mapTileMethod(),
                  canExclude: false,
                  colorScale,
                  labelMinAreaPercent: boxLabelMinAreaPercent,
                  stockLabelMode,
                  stockPopupOnHover: false,
                  // 실제 폰 화면에서는 한 번 눌러 차트를 열던 동작을 없애고, 팝업의 차트 아이콘으로만 연다. 캡처·스와이프 미리보기는 그대로다.
                  stockChartTrigger: 'rightClick',
                  onOpenStockChart: isPhoneMapFrame ? openStockChart : undefined,
                  // 실제 폰 화면에서만 종목 팝업을 툴바 줄 팝업과 같은 배율로 키운다. 캡처·미리보기는 그대로다.
                  phonePopupEnlarged: isPhoneMapFrame,
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
  // 툴바는 판 밖의 PhoneMapShell이 그린다. 판 안에서는 안내 문구만 보여 툴바가 두 번 그려지지 않게 한다.
  const phoneEmptyFrame = (
    <div className="flex h-full items-center justify-center text-[14px] text-ui-muted">{isLoading ? '불러오는 중입니다.' : isError ? '데이터를 불러오지 못했습니다.' : '이 날짜에는 표시할 데이터가 없습니다.'}</div>
  )
  const sectorPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <div className="flex h-full min-h-0 flex-col bg-ui-background">
        <MobileSectorMap items={sectorPreviewItems} colorScale={colorScale} onSelect={() => {}} decimalPlaces={decimalPlaces} />
      </div>
    </div>
  )
  // 종목 지도에서 그룹 등락률 쪽(오른쪽 스와이프)으로 갈 때 왼쪽에서 따라올 미리보기. 도착 화면과 같은 막대·경로 줄·지수를 그린다.
  const graphPreviewItems: MobileGraphItem[] = sectorPreviewItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate }))
  if (showGraphPreviewIndexes) {
    for (const index of marketSummary?.marketOverviews.items ?? []) {
      if (index.market === 'KOSPI' || index.market === 'KOSDAQ') {
        graphPreviewItems.push({ key: `market-index:${index.market}`, name: index.market === 'KOSPI' ? '코스피' : '코스닥', value: index.changeRate, reference: true })
      }
    }
  }
  // 지수는 히트맵과 다른 쿼리에서 오므로, 지수까지 준비된 뒤 막대와 함께 그린다.
  const isGraphPreviewLoading = isLoading || (showGraphPreviewIndexes && (isMarketSummaryLoading || isMarketSummaryFetching))
  const graphPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <section aria-label="업종 등락률 그래프" className="flex h-full flex-col bg-ui-background p-1">
        <div style={{ zoom: PHONE_PATH_CANVAS_ZOOM }}>
          <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${phonePathBarLeftShift(8)}px)` }}>
            <PathBar variant="phone" currentAria="location" crumbs={[{ key: 'market', label: market === 'KOSPI' ? 'KOSPI' : market === 'KOSDAQ' ? 'KOSDAQ' : 'K-STOCK', current: true }]} />
          </header>
        </div>
        {isGraphPreviewLoading
          ? <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner /></div>
          : <MobileGraphBars items={graphPreviewItems} colorScale={colorScale} highlightColor={strongIndustryColor} />}
      </section>
    </div>
  )

  if (isPhoneMapFrame) {
    return (
      <>
        <PhoneMapShell
          zoomMode="pinch"
          onSwipe={direction => navigate(direction === 'next' ? marketRoute('/summary', market) : marketRoute('/graph', market))}
          toolbar={mapToolbarNode}
          topBar={<MobileTopBar title="종목 지도" titleTo={marketRoute('/summary', market)} titleLabel="업종 지도로 이동" />}
          frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * phoneFrameScale}
          frame={mobileFrameNode || phoneEmptyFrame}
          nextPreview={sectorPreview}
          previousPreview={graphPreview}
          current="korea"
          boxSize={mobileBoxSizeRatio}
          onChangeBoxSize={onChangeMobileBoxSizeRatio}
        />
        {chartStock !== null && (
          <MobileMapStockChart
            chartStock={chartStock}
            marketLabel={MARKET_LABEL[market]}
            levelLabels={SECTOR_LEVEL_LABEL}
            market="korea"
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
      <NavBar
        centered
        tall
        actions={
          <NavBarPageActions
            onRefresh={refetchHeatmap}
            isRefreshing={isRefetchingHeatmap}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => openScreenshot(screenshotRef.current)}
            isScreenshotOpen={isShareOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showRefresh={false}
          />
        }
      />
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
              <NxtOnlyNotice active={nxtOnly && pinnedSnapshotTime === undefined && rangeStartTime === undefined} window={nxtOnlyWindow} ready={!isLoading && !isError} nodes={rootNodes} />
              {chartStock !== null ? (
                <MapStockChart chartStock={chartStock} marketLabel={MARKET_LABEL[market]} levelLabels={SECTOR_LEVEL_LABEL} market="korea" closeChart={closeChart} onGoToRoot={() => handleGoToDepth(0)} onEnterSector={enterSector} />
              ) : (
              <>
              {path.length > 0 && (
                // 이름마다 "그 단계로만" 이동하는 링크다 — 줄 전체를 눌러 전체로 가던 동작은 없앴다. 지금 보고 있는 마지막 이름은 현재 위치 표시다.
                <PathBar
                  currentAria="page"
                  accentColor={strongIndustryColor}
                  crumbs={[
                    { key: 'market', label: MARKET_LABEL[market], onClick: () => handleGoToDepth(0), hint: '전체로 돌아가기' },
                    ...path.map((name, index): PathCrumb => index === path.length - 1
                      ? { key: `path-${index}`, label: name, current: true }
                      : { key: `path-${index}`, label: name, onClick: () => handleGoToDepth(index + 1), hint: `${SECTOR_LEVEL_LABEL[index]}로 돌아가기` }),
                  ]}
                />
              )}
              {/* 로딩·오류 원은 모든 페이지 공통 자리(MainAreaLoading, 메인 영역 기준)에 둔다. */}
              {isLoading ? (
                <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
              ) : isError ? (
                <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} /></MainAreaLoading>
              ) : visibleItems.length === 0 ? (
                isMineEmpty ? (
                  <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
                    <CustomPageBadgeLink />
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
                    onExcludeSector={handleExcludeSector}
                    stockChartTrigger={stockChartTrigger}
                    onOpenStockChart={openStockChart}
                    heightClassName="min-h-0 flex-1"
                    marketValueDepthRange={marketValueDepthRange}
                    weightedAvgDepthRange={weightedAvgDepthRange}
                    simpleAvgDepthRange={simpleAvgDepthRange}
                    upDownCountDepthRange={upDownCountDepthRange}
                    boxSizeMarketCapRatio={boxSizeMarketCapRatio}
                    stretch={mapStretchFor(settingsModalProps.taxonomy)}
                    tile={mapTileMethod()}
                    canExclude={isCustom || isMarketry || !isLoggedIn}
                    colorScale={colorScale}
                    labelMinAreaPercent={boxLabelMinAreaPercent}
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
              <DisclaimerFooter rightContent={<ChangeRateBar swatches={settingsModalProps.legendSwatches} />} />
              </div>
            </div>
          {/* 모니터 캡처에서는 모바일용 히트맵을 만들지 않아 화면 렌더링과 DOM 복제 비용을 줄인다. */}
          {mobileFrameNode}
          </div>
          {/* 설정창 위쪽 여백 4px — 헤더를 위로 3px 늘리고 아래 구분선 위치는 유지한다. */}
          <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsPanel
              {...settingsModalProps}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              pageLabel="Map"
              strongIndustryColor={strongIndustryColor}
              sectionOrder={SPECIAL_MAP_SETTINGS_SECTION_ORDER}
              taxonomyAtBottom
              snapshotTime={data?.taxonomyUpdatedAt}
              stockCountLabel={formatStockCountLabel(visibleItems.length, totalItemCount)}
              onSelectTaxonomy={next => {
                settingsModalProps.onSelectTaxonomy(next)
                reset()
              }}
            >
              <SettingsPanelGroup section="composition">
                <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
                <SettingsExcludeSection {...settingsModalProps} />
                <MapChangeFilterSections
                  stockChangeFilter={stockChangeFilter}
                  onChangeStockChangeFilter={value => {
                    onChangeStockChangeFilter(value)
                    reset()
                  }}
                  sectorChangeFilter={sectorChangeFilter}
                  onChangeSectorChangeFilter={setSectorChangeFilter}
                  sectorChangeDepth={sectorChangeDepth}
                  onChangeSectorChangeDepth={setSectorChangeDepth}
                  maxSelectableDepth={sectorChangeMaxDepth}
                  noDataLimited={settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT'}
                />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="industry">
                <SettingsSectorLevelSection {...settingsModalProps} showStockDisplay={false} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="stockDisplay">
                <SettingsStockSizeSelector marketCapRatio={boxSizeMarketCapRatio} onChangeMarketCapRatio={onChangeBoxSizeMarketCapRatio} />
                <SettingsSectorLevelSection {...settingsModalProps} showTaxonomy={false} showDecimalPlaces />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="colors">
                <SettingsColorSection {...settingsModalProps} colorEditorProps={colorEditorPanelProps} fixed={settingsModalProps.taxonomy !== 'MINE'} />
                {strongIndustryColor && onChangeStrongIndustryColor && (
                  <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} fixed={settingsModalProps.taxonomy !== 'MINE'} />
                )}
                <SettingsTopPickSection {...settingsModalProps} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="special">
                <MapExperimentSections
                  stockPopupOnHover={stockPopupOnHover}
                  onChangeStockPopupOnHover={setStockPopupOnHover}
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
              <CustomPageBadgeLink />
            </EmptyLogoMessage>
          ) : undefined}
          mobileRegionOption={{ label: '모바일', selector: '[data-map-mobile-capture-frame]', mode: 'element', onCloneNode: revealMobileCapture, monitorHorizontalPadding: 4 }}
          onMobileSelectionChange={setIsMobileScreenshotSelected}
        />
      )}
        </div>
      </div>
    </div>
  )
}