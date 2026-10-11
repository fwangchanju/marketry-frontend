import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import { ChangeRateModeToggle, MarketDropdown } from '@/components/MarketMapControls'
import SettingsSidebar, {
  SettingsAverageModeSection,
  SettingsGroupDepthSection,
  SettingsSectorStockScopeSection,
  type SectorStockScope,
  SettingsBeforeMinutesSection,
} from '@/components/SettingsSidebar'
import MarketMapShareModal from '@/components/MarketMapShareModal'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import Spinner from '@/components/Spinner'
import Toolbar from '@/components/Toolbar'
import { ClockIcon } from '@/components/icons/MarketMapIcons'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import ClosingPriceLabel from '@/components/ClosingPriceLabel'
import RangeCompareLabel from '@/components/RangeCompareLabel'
import { REFRESH_FEEDBACK_MIN_DURATION_MS } from '@/utils/uiFeedback'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import ChangeRateBar from '@/components/ChangeRateBar'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { useSectorMarketMapPair } from '@/hooks/useSectorMarketMapPair'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { usePersistedState } from '@/hooks/usePersistedState'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { usePageSetting } from '@/hooks/usePageSetting'
import { appAlert } from '@/utils/appDialogBus'
import { collectItems, computeSectorAverage } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredMarketMapTree'
import { CAPTURE_ID } from '@/utils/captureIds'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import { FONT_BAR_MODE_STATUS, FONT_BAR_TIME } from '@/components/FontStyle'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload, downloadDataUrl, captureFileName } from '@/utils/captureToDownload'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toCount, toMarketMapSnapshotDateLabel } from '@/utils/format'
import { marketRoute } from '@/utils/marketRoute'
import type { Market, MarketMapSectorNode } from '@/types/api'
import RankColumns, { type RankColumnItem, type RankColumnsChart } from '@/components/RankColumns'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'
type GroupGraphMode = 'current' | 'delta'

// 지수 등락률 참조 막대에 붙는 한글 라벨 — ALL STOCK은 두 지수를 각각 표시한다.
const MARKET_INDEX_LABEL_KO: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }
// 지수 참조 막대 전용 React key — 섹터 이름(예: '코스피'라는 섹터가 실제로 있을 수 있다)과
// 겹치지 않도록 일반 섹터 key(sectorKey)와 다른 접두사를 쓴다.
function sectorKey(sectorName: string): string {
  return `sector:${sectorName}`
}

// 막대가 이 개수(지수 제외)까지는 전부 보여 주고, 넘으면 상위·하위 각 EDGE_COUNT개만 남기고 가운데를 "외 N개" 칸 하나로 줄인다.
// 27은 거래소 대분류(27개)가 줄지 않는 값이다.
const GROUP_DEPTH_NAMES = ['대분류', '중분류', '소분류']
const SHOW_ALL_LIMIT = 27
const EDGE_COUNT = 15

// (key, 값) 목록을 값 내림차순 랭킹 막대그래프 데이터로 변환한다 — "현재" 그래프/"변화율" 그래프 둘
// 다 이 함수로 각각 독립적으로 정렬·스케일을 만든다(같은 포맷, 정렬 기준값만 다름).
// 지수 참조 막대는 개수에 세지 않고 값 순서 자리에 그대로 둔다. 줄인 구간 안에 들어가는 지수는 "외 N개" 칸 바로 뒤에 둔다.
function buildRankChart(entries: RankColumnItem[]): RankColumnsChart {
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  const sectors = sorted.filter(item => !item.isReference)
  let rankedItems = sorted

  if (sectors.length > SHOW_ALL_LIMIT) {
    const top = sectors.slice(0, EDGE_COUNT)
    const bottom = sectors.slice(-EDGE_COUNT)
    const hiddenCount = sectors.length - top.length - bottom.length
    const ellipsis: RankColumnItem = { key: 'hidden-sectors', sectorName: `외 ${hiddenCount}개`, value: 0, hiddenCount }
    const visible = sorted.filter(item => item.isReference || top.includes(item) || bottom.includes(item))
    const splitAt = visible.indexOf(top[top.length - 1]) + 1
    rankedItems = [...visible.slice(0, splitAt), ellipsis, ...visible.slice(splitAt)]
  }

  const rawMaxAbsValue = Math.max(1, ...rankedItems.filter(item => item.hiddenCount === undefined).map(item => Math.abs(item.value)))
  // 핀비즈처럼 축 눈금이 딱 떨어지게, 0.5%p 단위로 올림한 값을 막대 스케일에 쓴다.
  const axisMax = Math.ceil(rawMaxAbsValue * 2) / 2

  return { rankedItems, axisMax }
}

interface DepthEntry {
  node: MarketMapSectorNode
  // 같은 이름의 업종이 다른 대분류 밑에 또 있을 수 있어 위에서부터 이어 붙인 이름으로 구분한다.
  pathKey: string
}

// 고른 깊이(1=대분류, 2=중분류, 3=소분류)의 업종을 모은다. 그 깊이에 닿기 전에 하위 업종이 끝나는 업종은 그대로 한 막대가 된다.
// 제외한 업종은 그 밑까지 뺀다.
function collectAtDepth(
  nodes: MarketMapSectorNode[],
  depth: number,
  excludedSectorIds: Set<number>,
  parentKey = '',
  level = 1,
): DepthEntry[] {
  const entries: DepthEntry[] = []
  for (const node of nodes) {
    if (excludedSectorIds.has(node.sectorId)) continue
    const pathKey = parentKey ? `${parentKey}>${node.sectorName}` : node.sectorName
    if (level >= depth || node.children.length === 0) entries.push({ node, pathKey })
    else entries.push(...collectAtDepth(node.children, depth, excludedSectorIds, pathKey, level + 1))
  }
  return entries
}

export default function GroupPage() {
  const navigate = useNavigate()
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('sectorChangeRate.beforeMinutes', 15)
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    settingsModalProps,
    strongIndustryColor,
    avgChangeRateUseSimple,
    onChangeAvgChangeRateUseSimple,
    market,
    source,
    nxtOnly,
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
    isLoading,
    isError,
    isMarketMapSuccess,
    isMarketValueTierRangeReady,
    isRefetchingMarketMap,
    refetchMarketMap,
    onChangeSectorFilterEnabled,
    excludedMarketValueTiers,
    excludedSectorIds,
    colorScale,
  } = useGlobalSettings({ allowChangeRateMode: true })
  // 달력에서 지난 날짜를 골라 보는 중이면 시각·시간대·누적/별도 표시는 숨긴다(실시간 정보라서).
  const isPastSnapshot = pinnedSnapshotTime !== undefined

  const [graphMode, setGraphMode] = usePageSetting<GroupGraphMode>('groupPage.graphMode', 'current')
  // 집계 대상 종목: 맵 페이지면 지도 설정창의 제외 기준을 따르고, 전체 포함이면 제외 설정 없이 전체 종목으로 계산한다.
  const [sectorStockScope, setSectorStockScope] = usePageSetting<SectorStockScope>('groupPage.sectorStockScope', 'MAP')
  const isAllStocks = sectorStockScope === 'ALL'
  // 막대 하나가 가리키는 업종 분류 깊이(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 고를 수 있다.
  const [groupDepth, setGroupDepth] = usePageSetting<number>('groupPage.depth', 1)
  const selectableDepth = settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT' ? 1 : 3
  const effectiveDepth = Math.min(groupDepth, selectableDepth)
  const scopedExcludedSectorIds = useMemo(() => (isAllStocks ? new Set<number>() : excludedSectorIds), [isAllStocks, excludedSectorIds])
  const scopedExcludedTiers = useMemo(() => (isAllStocks ? new Set<string>() : excludedMarketValueTiers), [isAllStocks, excludedMarketValueTiers])

  // now는 여기서 따로 조회하지 않는다 — useGlobalSettings()가 이미 부르는 useMarketMap(market, source)
  // 결과(data)를 그대로 쓴다. before는 그 now.snapshotTime에서 계산한 시각을 쌍으로 묶어 조회한다
  // (marketry-backend 지시서 결정 4) — 이렇게 해야 재조회로 now가 새 tick으로 바뀌는 순간에도
  // 화면이 새 now·옛 before를 잠깐이라도 섞어 그리지 않는다.
  // 업종을 누르면 지도 페이지로 가서 그 업종을 누른 상태로 연다(지도 페이지가 sector 주소 값을 읽어 한 번만 쓴다).
  // 전종목이면 그래프의 숫자가 지도와 다르게 집계되므로 지도로 이동하지 않고, 안내창으로 이유를 알려 준다.
  const handleSelectSector = (sectorName: string) => {
    if (isAllStocks) {
      void appAlert('집계 대상 종목을 전종목으로 선택하는 경우\n이동을 제한합니다.')
      return
    }
    navigate(`${marketRoute('/map', market)}?sector=${encodeURIComponent(sectorName)}`)
  }
  // 기간 등락률을 보는 중이면 "N분 전 대비"는 쓰지 않는다 — before를 받지 않고, 지금 값(data)이 곧 기간 등락률이다.
  const isRangeView = rangeStartTime !== undefined
  // 두 토글을 하나의 선택값으로 관리해 항상 정확히 한 그래프만 켜진다. 기간 보기에서는 현재 그래프를 강제로 표시한다.
  const showDeltaGraph = !isRangeView && graphMode === 'delta'
  const toggleGraph = () => setGraphMode(showDeltaGraph ? 'current' : 'delta')
  const pairQuery = useSectorMarketMapPair(market, source, nxtOnly, beforeMinutes, data, changeRateMode, !isRangeView)
  // 쌍 쿼리가 에러(재시도 1회 뒤)면 "before 없음"으로 보고 now 쿼리의 현재 data로 그린다. 그 외에는
  // 화면에 그리는 now가 항상 "쌍 안의 now"다 — placeholder 기간에도 그 쌍이 만들어질 때의 now·before가
  // 함께 유지되어, 상단 바 시각과 그래프가 서로 어긋나지 않는다.
  const displayNow = isRangeView ? data : (pairQuery.data?.now ?? (pairQuery.isError ? data : undefined))
  const displayBefore = isRangeView ? null : (pairQuery.data?.before ?? null)
  const isPairSettled = isRangeView || pairQuery.isSuccess || pairQuery.isError
  // data-capture-ready(결정 4) — now가 성공했고 비어 있으면(그 시각 데이터가 아예 없음) 그대로
  // "데이터가 없습니다" 화면을 캡처한다. 그 외에는 쌍 쿼리까지 끝나 있고(성공 또는 에러), placeholder가
  // 아니고, 시가총액 구간 설정이 준비된 뒤에야 캡처를 허용한다 — now 에러는 항상 false다.
  const isDataCaptureReady =
    isMarketMapSuccess &&
    (data?.snapshotTime == null ||
      (isPairSettled && !pairQuery.isPlaceholderData && isMarketValueTierRangeReady))
  const isRefreshing = isRefetchingMarketMap || pairQuery.isFetching

  // 렌더러가 /sector/kosdaq?beforeMinutes=15&avgMode=simple&sectorFilter=true로
  // 캡처 요청할 때 쓰는 진입점 — MapPage와 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔
  // 남길 필요 없어 반영 직후 지움). market은 useGlobalSettings()가 내부에서 이미 우선 반영했으므로
  // 여기서는 나머지 세 파라미터만 다룬다. 셋은 서로 독립적으로 판정한다 — 하나가 없거나 잘못됐다고
  // 다른 것까지 무시하면 안 된다. 실제로 소비한(유효했던) 파라미터만 주소에서 지운다.
  useEffect(() => {
    // 양의 정수가 아니면 무시하고 기존 값을 쓴다. 데이터가 5분 간격으로만 존재해서(수집 주기) 5의
    // 배수가 아닌 값은 애초에 조회가 불가능하다 — 여기서도 같은 조건으로 걸러낸다.
    const beforeMinutesParam = searchParams.get('beforeMinutes')
    const parsedBeforeMinutes = beforeMinutesParam === null ? NaN : Number(beforeMinutesParam)
    const isValidBeforeMinutes = Number.isInteger(parsedBeforeMinutes) && parsedBeforeMinutes > 0 && parsedBeforeMinutes % 5 === 0
    if (isValidBeforeMinutes) setBeforeMinutes(parsedBeforeMinutes)

    const marketParam = searchParams.get('market')
    const isValidMarket = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK'

    // 백엔드가 캡처 URL에 싣는 avgMode=simple|weighted, sectorFilter=true|false 계약에 맞춘다
    // (marketry-backend의 instructions-telegram-average-mode.md 결정 6).
    const avgModeParam = searchParams.get('avgMode')
    const isValidAvgMode = avgModeParam === 'simple' || avgModeParam === 'weighted'
    if (isValidAvgMode) onChangeAvgChangeRateUseSimple(avgModeParam === 'simple')

    const sectorFilterParam = searchParams.get('sectorFilter')
    const isValidSectorFilter = sectorFilterParam === 'true' || sectorFilterParam === 'false'
    if (isValidSectorFilter) onChangeSectorFilterEnabled(sectorFilterParam === 'true')

    if (!isValidMarket && !isValidBeforeMinutes && !isValidAvgMode && !isValidSectorFilter) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (isValidMarket) next.delete('market')
        if (isValidBeforeMinutes) next.delete('beforeMinutes')
        if (isValidAvgMode) next.delete('avgMode')
        if (isValidSectorFilter) next.delete('sectorFilter')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 파라미터가 있을 때만 반응하면 됨
  }, [searchParams])
  // 맵·커스텀 페이지와 같은 청록색 분류자명 버튼을 표시한다.
  const modeStatusText = <TaxonomyBadge taxonomy={settingsModalProps.taxonomy} />

  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsSidebarSide()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const captureRef = useRef<HTMLDivElement>(null)

  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (captureRef.current) await captureElementToClipboard(captureRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureRef.current) return
    setDownloadStatus('downloading')
    try {
      if (previewSrc) downloadDataUrl(previewSrc, captureFileName('GROUP'))
      else if (captureRef.current) await captureElementToDownload(captureRef.current, captureFileName('GROUP'))
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel =
    copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'

  // 설정창 위쪽 "nn/nn종목" — 분모는 지금 시장의 모든 종목, 분자는 지도 설정창과 같은 기준(제외한 업종은 하위 업종까지,
  // 제외한 시가총액 구간)으로 걸러 남은 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = displayNow?.items ?? []
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0)
    const included = filterTreeByExclusions(nodes, scopedExcludedSectorIds, scopedExcludedTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return `${toCount(included)}/${toCount(total)}종목`
  }, [displayNow, scopedExcludedSectorIds, scopedExcludedTiers])

  const charts = useMemo(() => {
    if (!displayNow) return { current: buildRankChart([]), delta: buildRankChart([]) }

    const beforeByPath = new Map<string, MarketMapSectorNode>(
      collectAtDepth(displayBefore?.items ?? [], effectiveDepth, new Set<number>()).map(({ node, pathKey }) => [pathKey, node]),
    )

    const currentEntries: RankColumnItem[] = []
    const deltaEntries: RankColumnItem[] = []

    for (const { node, pathKey } of collectAtDepth(displayNow.items, effectiveDepth, scopedExcludedSectorIds)) {
      const nowAverage = computeSectorAverage(node, scopedExcludedTiers)
      const nowValue = avgChangeRateUseSimple ? nowAverage.simpleAvg : nowAverage.weightedAvg
      // 새 트리는 종목이 하나도 없는 최상위 섹터도 노드로 준다 — 그런 섹터는 평균이 null이라
      // 두 그래프 모두에서 뺀다(옛 /api/sector는 애초에 그런 섹터를 안 내려줬다).
      if (nowValue === null) continue
      currentEntries.push({ key: sectorKey(pathKey), sectorName: node.sectorName, value: nowValue })

      const beforeNode = beforeByPath.get(pathKey)
      if (!beforeNode) continue
      const beforeAverage = computeSectorAverage(beforeNode, scopedExcludedTiers)
      const beforeValue = avgChangeRateUseSimple ? beforeAverage.simpleAvg : beforeAverage.weightedAvg
      if (beforeValue === null) continue
      deltaEntries.push({
        key: sectorKey(pathKey),
        sectorName: node.sectorName,
        value: nowValue - beforeValue,
      })
    }

    // ALL STOCK은 같은 시각으로 조회한 코스피·코스닥을 각각 추가한다.
    // 지수 참조 값은 일간 누적 등락률이므로 시간외 별도·기간 등락률에는 섞지 않는다.
    if (changeRateMode === 'daily' && !isRangeView) {
      const marketIndexes = displayNow.marketOverview
        ? [{ now: displayNow.marketOverview, before: displayBefore?.marketOverview ?? null }]
        : (pairQuery.data?.marketIndexes ?? [])
      for (const { now: nowOverview, before: beforeOverview } of marketIndexes) {
        const key = `market-index:${nowOverview.market}`
        const sectorName = MARKET_INDEX_LABEL_KO[nowOverview.market]
        currentEntries.push({ key, sectorName, value: nowOverview.changeRate, isReference: true })
        if (beforeOverview) {
          deltaEntries.push({ key, sectorName, value: nowOverview.changeRate - beforeOverview.changeRate, isReference: true })
        }
      }
    }

    return { current: buildRankChart(currentEntries), delta: buildRankChart(deltaEntries) }
  }, [displayNow, displayBefore, pairQuery.data?.marketIndexes, scopedExcludedSectorIds, scopedExcludedTiers, avgChangeRateUseSimple, changeRateMode, isRangeView, effectiveDepth])
  const activeChart = showDeltaGraph ? charts.delta : charts.current

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={refetchMarketMap}
            isRefreshing={isRefreshing}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isCaptureOpen={isShareOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showRefresh={false}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* 공유·텔레그램 모두 [세 번째 바+본문] 열만 캡처해 설정창을 제외한다. */}
        <div
          ref={settingsRowRef}
          className="relative z-10 -mt-[10.5px] flex min-h-0 flex-1 overflow-hidden bg-black text-white"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다(지도 페이지와 동일) — 내부 그래프가 넘치면 이 컬럼
              안에서만 처리된다. */}
          <div ref={captureRef} data-main-area data-captureid={CAPTURE_ID.SECTOR} data-capture-ready={isDataCaptureReady} className="flex min-h-0 min-w-0 flex-1 flex-col bg-black text-white">
            <Toolbar>
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                <MarketDropdown
                  market={market}
                  onSelect={selectedMarket => {
                    if (selectedMarket !== market) navigate(marketRoute('/group', selectedMarket))
                  }}
                />
                {/* 로딩 원이나 오류 문구가 보이는 동안에도 시계·시간대·누적/별도·분류명을 제자리에 둔다. 데이터가 없으면 시각 글자만 비어 있다. */}
                  <>
                <span className={`${FONT_BAR_TIME} flex items-center gap-1.5 whitespace-nowrap ${isPastSnapshot ? 'text-[var(--brand)]' : 'text-gray-400'}`}>
                  {/* 데이터가 없어도 날짜·시각 자리는 같은 폭으로 잡아 둬서 뒤의 시장 시간대 표시가 당겨지지 않게 한다. */}
                  <SnapshotDatePicker
                    market={market}
                    viewedSnapshotTime={displayNow?.snapshotTime ?? null}
                    liveSnapshotTime={liveSnapshotTime}
                    onSelectSnapshotTime={onChangePinnedSnapshotTime}
                    onSelectRange={onSelectRange}
                    rangeStartTime={rangeStartTime}
                    isPast={isPastSnapshot}
                  >
                    {/* 기간을 보는 중이면 시작일은 고른 날짜로 이미 정해져 있으므로, 지도를 기다리는 동안에도 숨기지 않는다. */}
                    <span className={displayNow?.snapshotTime || rangeStartTime ? undefined : 'invisible'}>{toMarketMapSnapshotDateLabel(rangeStartTime ?? displayNow?.snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
                  </SnapshotDatePicker>
                  {isPastSnapshot && (rangeStartTime && pinnedSnapshotTime
                    ? <RangeCompareLabel endSnapshotTime={pinnedSnapshotTime} excludedStocks={rangeExcludedStocks} />
                    : <ClosingPriceLabel viewedSnapshotTime={displayNow?.snapshotTime ?? null} liveSnapshotTime={liveSnapshotTime} />)}
                  {isPastSnapshot === false && (
                    <>
                      <ClockIcon className="-mr-0.5 h-[15px] w-[15px] shrink-0" aria-hidden />
                      <PageRefreshButton
                        onRefresh={refetchMarketMap}
                        isRefreshing={isRefreshing}
                        className={FONT_BAR_TIME}
                        helpText={SNAPSHOT_REFRESH_HELP}
                        minSpinDurationMs={REFRESH_FEEDBACK_MIN_DURATION_MS}
                      >
                        <AnimatedClockLabel snapshotTime={displayNow?.snapshotTime ?? null} />
                      </PageRefreshButton>
                    </>
                  )}
                </span>
                {isPastSnapshot === false && (
                  <span className="flex shrink-0">
                    <ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} />
                  </span>
                )}
                  </>
              </div>
              {/* 지도 페이지와 동일하게 맨 오른쪽 끝에 프로필(사진이 끝, 글자는 그 왼쪽)을 둔다. */}
              <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-gray-400`}>{modeStatusText}</div>
            </Toolbar>
            {/* 지도/어드민 페이지와 동일하게 본문이 화면을 꽉 채우는 형태 — 가운데 정렬/폭 제한을 없애서
                설정 사이드바가 열려도 본문이 밀리는 게 자연스럽게 느껴지도록 한다(밀림 자체는 다른
                페이지와 동일한 flex 구조이고, 콘텐츠가 항상 남는 공간을 꽉 채우기만 하면 된다). */}
            <div className="flex min-h-0 flex-1">
              <div className="flex min-h-0 w-full flex-1 flex-col px-[7px] pt-4 pb-[19.5px]">
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner showElapsed />
                </div>
              ) : isError ? (
                <div className="flex flex-1 items-center justify-center">
                  <Spinner errorMessage="데이터를 불러오지 못했습니다." />
                </div>
              ) : data?.snapshotTime == null ? (
                // now가 성공했지만 그 시각 데이터 자체가 없다 — 쌍 쿼리가 비활성이라(결정 4)
                // displayNow도 계속 undefined이므로, 아래 !displayNow 분기보다 먼저 걸러야
                // 스피너가 영원히 돌지 않는다.
                <div className="relative flex-1">
                  <EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" />
                </div>
              ) : !displayNow ? (
                // now는 성공했지만(비어 있지 않음) 쌍 쿼리가 아직 첫 결과를 내지 못한 순간 — 짝이 안
                // 맞는 반쪽짜리 화면을 그리지 않고 기다린다(결정 4).
                <div className="flex flex-1 items-center justify-center">
                  <Spinner showElapsed />
                </div>
              ) : (
                <div className="-mb-[19.5px] flex min-h-0 flex-1 flex-col overflow-auto pb-[19.5px]">
                  <div
                    className="mt-[25px] flex w-full shrink-0 items-center justify-center font-medium whitespace-nowrap"
                    style={{ fontSize: 22, color: '#ffffff' }}
                  >
                    <span className="inline-flex items-center leading-none font-medium">
                      <span aria-hidden="true" className="mr-[6px] inline-block h-[1em] w-1 shrink-0 rounded-sm" style={{ backgroundColor: strongIndustryColor }} />
                      <span>
                        {showDeltaGraph ? `${beforeMinutes}분 전 대비` : avgChangeRateUseSimple ? '동일 가중 등락률' : '시총 가중 등락률'}{' '}
                        <span className="font-light">({showDeltaGraph ? '%p' : '%'})</span>
                      </span>
                    </span>
                  </div>
                  {/* 설정창 설명과 같은 모양("- 문구")으로, 고른 업종 분류 단계와 함께 숫자가 왜곡될 수 있음을 알린다. */}
                  <p className="settings-description mt-1.5 mb-[19.5px] w-full shrink-0 text-center text-sm whitespace-nowrap text-gray-400">
                    {GROUP_DEPTH_NAMES[effectiveDepth - 1]}: 그룹에 포함된 종목이 적을수록 왜곡이 커질 수 있습니다.
                  </p>
                  <div className="flex min-h-[260px] min-w-0 w-full flex-1 pl-[1%] pr-[2%]">
                    <RankColumns
                      chart={activeChart}
                      highlightColor={strongIndustryColor}
                      colorScale={colorScale}
                      onSelectSector={handleSelectSector}
                    />
                  </div>
                </div>
              )}
              </div>
            </div>
            {/* 아래 줄 — 지도 페이지와 같은 높이(28px)로 왼쪽에 면책조항, 오른쪽 끝에 등락률 색상 범례를 둔다. 로딩 중에도 제자리에 둔다. */}
            <div className="flex h-7 shrink-0 items-end justify-between gap-3 px-[7px]">
              <div className="flex h-7 min-w-0 items-end">
                <DisclaimerNotice />
              </div>
              <ChangeRateBar swatches={settingsModalProps.legendSwatches} />
            </div>
          </div>
          {/* 설정창 윗선을 지도 페이지와 같은 높이로 맞춘다 — 지도 페이지에서 실제로 맞춘 모양(설정창 윗선이 위쪽 바 윗선보다 3px 아래)을 따른다. 이 칸은 바보다 5.25px 위에서 시작하므로 5.25 + 3 - 1(눈으로 맞춘 보정) = 7.25px이지만, 지도 페이지의 설정창 칸이 7px이라 실제로는 같은 7px을 띄운다. 아래는 붙인다. */}
          <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsSidebar
              {...settingsModalProps}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              pageLabel="Group"
              stockCountLabel={stockCountLabel}
              taxonomyAtBottom
              snapshotTime={data?.taxonomyUpdatedAt}
              plainContent={
                <>
                  <SettingsSectorStockScopeSection scope={sectorStockScope} onChange={setSectorStockScope} />
                  <SettingsGroupDepthSection depth={groupDepth} onChange={setGroupDepth} selectableDepth={selectableDepth} />
                  <SettingsAverageModeSection
                    avgChangeRateUseSimple={avgChangeRateUseSimple}
                    onChange={onChangeAvgChangeRateUseSimple}
                    enabled={!showDeltaGraph}
                    onToggle={toggleGraph}
                    toggleDisabled={isRangeView}
                  />
                  <SettingsBeforeMinutesSection
                    beforeMinutes={beforeMinutes}
                    onChange={setBeforeMinutes}
                    enabled={showDeltaGraph}
                    onToggle={toggleGraph}
                    disabled={isRangeView}
                  />
                </>
              }
            />
          </div>
        </div>
      </div>

      {isShareOpen && (
        <MarketMapShareModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          captureTarget={captureRef.current}
        />
      )}
    </div>
  )
}
