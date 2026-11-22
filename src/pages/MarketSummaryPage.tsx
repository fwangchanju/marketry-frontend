import MainAreaLoading from '@/components/MainAreaLoading'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import { frameBadgeStyle } from '@/utils/frameBadge'
import { useMemo, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { HiddenSummaryCaptureFrames, SortableSummaryScreenFrames } from '@/components/SummaryFrame'
import { useSummaryFrameOrder } from '@/hooks/useSummaryFrameOrder'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { GROUP_CHANGE_FRAME, MARKET_MAP_FRAME, frameCaptureOptionsFor } from '@/utils/summaryFrames'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import { ClockIcon } from '@/components/icons/AppIcons'
import EmptyMessage, { CustomPageBadgeLink, EmptyLogoMessage, EMPTY_FILTER_MESSAGE, EMPTY_MINE_MESSAGE } from '@/components/EmptyMessage'
import SettingsPanel, { SettingsPanelGroup, SettingsMarketValueSection, SettingsExcludeSection, SettingsColorSection, SettingsStrongIndustryColorSection } from '@/components/SettingsPanel'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import { getMarketIndexHistory } from '@/api/marketSummary'
import Spinner from '@/components/Spinner'
import NxtOnlyNotice from '@/components/NxtOnlyNotice'
import Toolbar from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import ToolbarModeText from '@/components/ToolbarModeText'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import ChangeRateBar from '@/components/ChangeRateBar'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { buildRankChart } from '@/utils/rankChart'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { collectItems, summarizeSector } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredHeatmap'
import { collectAtDepth } from '@/utils/sectorDepth'
import { usePreviousTradingDay } from '@/hooks/useHeatmap'
import { trendMonths } from '@/utils/trendDates'
import { marketRoute } from '@/utils/marketRoute'
import { marketMenu } from '@/utils/marketMenu'
import type { MarketQuery } from '@/types/api'

// 서머리 배치
type HistoricalIndexPoint = {
  date: string
  market: 'KOSPI' | 'KOSDAQ'
  overview: Awaited<ReturnType<typeof getMarketIndexHistory>>[number]
}

const TREND_MAX_YEARS = 1
// 종료일 기준 그래프가 시작하는 날(포함) — 기간이 이보다 길어도 그래프는 이 날부터만 그린다.
function maxDate(a: string, b: string): string {
  return a > b ? a : b
}
function earliestTrendDate(endDate: string): string {
  const start = new Date(`${endDate}T00:00:00Z`)
  start.setUTCFullYear(start.getUTCFullYear() - TREND_MAX_YEARS)
  return start.toISOString().slice(0, 10)
}

export default function MarketSummaryPage() {
  // 시장 배지 드롭다운 — 서머리의 시장(KOREA·JAPAN·USA, 배지에는 K-STOCK·NIKKEI 225·S&P 500)은 주소의 market 값으로 정한다. 일본·미국은 특별 회원·관리자에게만 보인다.
  const location = useLocation()
  const canSeeOverseasSummary = true
  const summaryMarket: MarketQuery = location.pathname.startsWith('/summary/korea/kospi') ? 'KOSPI' : location.pathname.startsWith('/summary/korea/kosdaq') ? 'KOSDAQ' : 'ALL_STOCK'
  const summaryMarketLabel = summaryMarket === 'KOSPI' ? 'KOSPI' : summaryMarket === 'KOSDAQ' ? 'KOSDAQ' : 'K-STOCK'
  // 지도·그래프와 같은 목록(KOREA 아래 KOSPI·KOSDAQ, 특별 회원·관리자에게만 JAPAN·USA).
  const summaryMenu = marketMenu('/summary', summaryMarket, canSeeOverseasSummary)
  const navigate = useNavigate()
  // 틀마다 스크린샷 버튼이 있다 — 누른 틀 하나만(버튼은 빼고) 스크린샷으로 찍으며, 공유창은 지도·그래프 페이지와 같은 것을 쓴다.
  // 시험용 — 지도와 그래프를 대분류가 아니라 중분류·소분류로도 그려 본다(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 된다.
  const allFramesRef = useRef<HTMLDivElement>(null)
  const fixedCaptureRef = useRef<HTMLDivElement>(null)
  const { target: screenshotTarget, isOpen: isShareOpen, isWhole: isCapturingAll, open: openScreenshot, close: closeScreenshot, copy: handleCopy, copyLabel, isCopying } = useScreenshotShare()
  const {
    settingsModalProps, data, rootNodes, isLoading: isBaseLoading, isError, refetchHeatmap, isRefetchingHeatmap, pinnedSnapshotTime, rangeStartTime, rangeExcludedStocks,
    changeRateMode, changeRateChoice, colorScale, strongIndustryColor, onChangeStrongIndustryColor, colorEditorPanelProps, excludedSectorIds, excludedMarketValueTiers,
    market, nxtOnly, nxtOnlyWindow, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange,
    isAfterHoursControlsVisible, isAfterHoursSelectable, onChangeChangeRateMode,
  } = useGlobalSettings({ allowChangeRateMode: true })
  const isExchange = settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT'
  const mineColor = settingsModalProps.taxonomy === 'MINE' ? strongIndustryColor : undefined
  const badgeStyleProps = frameBadgeStyle(settingsModalProps.taxonomy, strongIndustryColor)
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const { frameSensors, safeSummaryFrameOrder, handleFrameDragEnd, orderFrames } = useSummaryFrameOrder()
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

  // 달력에서 지난 날짜를 골라 보는 중이면 시각·시간대 표시는 숨긴다(실시간 정보라서) — 지도·그래프 페이지와 같다.
  const isPastSnapshot = pinnedSnapshotTime !== undefined

  // 지도 위 한 줄에 넣을 코스피·코스닥 지수 등락률 — 지도 조회(ALL STOCK)에는 지수가 없어 요약 조회에서 받는다.
  const { data: marketSummary, isLoading: isMarketSummaryLoading } = useMarketSummary()
  const queryClient = useQueryClient()
  const rangePreviousDay = usePreviousTradingDay(market, rangeStartTime?.slice(0, 10) ?? null, { enabled: rangeStartTime !== undefined })
  const indexEndDate = pinnedSnapshotTime?.slice(0, 10) ?? marketSummary?.marketOverviews.snapshotTime?.slice(0, 10) ?? null
  const { data: historicalIndexData, isLoading: isHistoricalIndexLoading } = useQuery({
    queryKey: ['home-historical-market-index', indexEndDate, rangeStartTime, rangePreviousDay?.snapshotTime, changeRateChoice],
    enabled: Boolean(indexEndDate && pinnedSnapshotTime !== undefined && (!rangeStartTime || rangePreviousDay !== undefined)),
    queryFn: async () => {
      const endDate = indexEndDate!
      const [year, month] = endDate.slice(0, 7).split('-').map(Number)
      const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
      const baseDate = rangeStartTime ? rangePreviousDay?.date ?? rangeStartTime.slice(0, 10) : null
      // 기준일의 달은 계산에 필요해서 받고, 그래프에 쓰는 달은 종료일 기준 최근 TREND_MAX_YEARS년만 받는다.
      const graphFrom = earliestTrendDate(endDate)
      const months = baseDate
        ? [...new Set([baseDate.slice(0, 7), ...trendMonths(maxDate(baseDate, graphFrom), endDate)])]
        : [previousMonth, endDate.slice(0, 7)]
      const rows = (await Promise.all(months.map(month => queryClient.fetchQuery({
        queryKey: ['market-index-history', month],
        queryFn: () => getMarketIndexHistory(month),
        staleTime: 60_000,
        gcTime: 30 * 60_000,
      })))).flat()
      return rows.filter(row => row.snapshotTime.slice(0, 10) <= endDate).flatMap<HistoricalIndexPoint>(overview => {
        const date = overview.snapshotTime.slice(0, 10)
        if (!rangeStartTime) return [{ date, market: overview.market, overview }]
        if (date < rangeStartTime.slice(0, 10) || date < graphFrom) return []
        const base = rows.find(row => row.market === overview.market && row.snapshotTime.slice(0, 10) === baseDate)
        if (!base) return []
        const baseValue = rangePreviousDay ? base.indexValue : base.indexValue - base.changeValue
        if (baseValue <= 0) return []
        const changeValue = overview.indexValue - baseValue
        return [{ date, market: overview.market, overview: { ...overview, changeValue, changeRate: changeValue / baseValue * 100 } }]
      })
    },
    staleTime: 60_000,
  })
  // 실시간 요약 지수는 최신 일간 보기에서만 쓴다. 과거 날짜·기간 보기에는 조회한 해당 날짜/기간의 지수 추이를 쓴다.
  const isLatestDailyView = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
  // 지수 막대가 heatmap과 다른 쿼리에서 오므로, 지수까지 준비된 뒤 한 번에 그린다.
  const isIndexLoading = (isLatestDailyView && isMarketSummaryLoading) || (pinnedSnapshotTime !== undefined && isHistoricalIndexLoading)
  const isLoading = isBaseLoading || isIndexLoading
  // 서머리는 업종 분류 단계를 대분류로 잠가 둔다 — 단계를 내리면 상위 업종에 직접 붙은 종목이 막대에서 빠져 종목 수·평균이 달라지기 때문이다(docs/history.md).
  const effectiveDepth = 1
  const handleSelectSector = (sectorName: string) => {
    navigate(`${marketRoute('/map', market)}?sector=${encodeURIComponent(sectorName)}`)
  }
  const handleSelectIndex = (indexMarket: 'KOSPI' | 'KOSDAQ') => navigate(marketRoute('/map', indexMarket))
  // 고른 단계의 업종만 모아 지도 박스와 그래프 막대로 쓴다 — 지도 페이지와 같은 제외 기준을 따른다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(rootNodes, effectiveDepth, excludedSectorIds, excludedMarketValueTiers)) {
      const summary = summarizeSector(node, excludedMarketValueTiers)
      if (!summary) continue
      items.push({
        key: pathKey,
        name: node.sectorName,
        marketValue: summary.marketValue,
        changeRate: summary.weightedAvg,
        simpleAvg: summary.simpleAvg,
        advancers: summary.advancers,
        decliners: summary.decliners,
        unchanged: summary.unchanged,
      })
    }
    const entries = items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false }))
    // 그래프 페이지처럼 코스피·코스닥 지수 등락률을 강조 색 참조 막대로 값 순서 자리에 끼운다.
    for (const [indexMarket, label] of [['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const) {
      // 코스피·코스닥 서머리에는 그 시장의 지수 막대만 넣는다(그래프 화면과 같다). 전체 서머리에는 둘 다 넣는다.
      if (market !== 'ALL_STOCK' && market !== indexMarket) continue
      const historicalIndex = pinnedSnapshotTime !== undefined
        ? (historicalIndexData ?? []).filter(candidate => candidate.market === indexMarket).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
        : undefined
      const changeRate = pinnedSnapshotTime !== undefined
        ? historicalIndex?.overview.changeRate
        : isLatestDailyView
          ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === indexMarket)?.changeRate
          : undefined
      if (changeRate !== undefined) entries.push({ key: `market-index:${indexMarket}`, sectorName: label, value: changeRate, isReference: true })
    }
    const chart = buildRankChart(entries)
    return { items, chart }
  }, [rootNodes, excludedSectorIds, excludedMarketValueTiers, effectiveDepth, marketSummary, historicalIndexData, pinnedSnapshotTime, isLatestDailyView, market])
  // 설정창 위쪽 "nn/nn종목" — 그래프 페이지와 같은 기준이다. 분모는 지금 시장의 모든 종목, 분자는 제외한 업종(하위 업종까지)·시가총액 구간을 뺀 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = rootNodes
    // 분모에는 정지로 지도에서 뺀 종목도 더해 전체 종목 수와 맞춘다.
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0) + (data?.suspendedStockCount ?? 0)
    const included = filterTreeByExclusions(nodes, excludedSectorIds, excludedMarketValueTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return formatStockCountLabel(included, total)
  }, [rootNodes, data, excludedSectorIds, excludedMarketValueTiers])
  // 두 틀의 제목 줄 오른쪽 끝에 같은 기준 날짜·시각을 보여 준다 — 데이터를 받은 뒤에만 보인다.

  // 툴바 왼쪽(제목 배지·날짜·시각·시간대)과 오른쪽(분류 배지) — 화면의 툴바와 3:4 캡처용 판이 같은 내용을 쓴다.
  const toolbarContent = (
    <>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="SUMMARY" label={summaryMarketLabel} showChevron menu={summaryMenu} />
              {/* 지도·그래프 페이지와 같은 날짜·시각·시간대 — 서머리도 이 날짜(달력으로 고른 날)를 따라가므로 지금 어느 날짜를 보는지 여기서 보이고 바꿀 수 있어야 한다.
                  애프터 마켓 시간에는 등락률 기준(종가·합산·별도) 선택도 지도·그룹 페이지와 같이 보인다. 로딩·오류에서도 제자리에 둔다. */}
              <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}>
                <SnapshotDatePicker
                  market={market}
                  holidayColor={resolveHeatmapColor(8, colorScale)}
                  viewedSnapshotTime={data?.snapshotTime ?? null}
                  liveSnapshotTime={liveSnapshotTime}
                  onSelectSnapshotTime={onChangePinnedSnapshotTime}
                  onSelectRange={onSelectRange}
                  rangeStartTime={rangeStartTime}
                  isPast={isPastSnapshot}
                >
                  <span className={data?.snapshotTime || rangeStartTime ? undefined : 'invisible'}>
                    {toSnapshotDateLabel(rangeStartTime ?? data?.snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}
                  </span>
                  {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && <span>~ {toSnapshotDateLabel(pinnedSnapshotTime)}</span>}
                </SnapshotDatePicker>
              </ToolbarChip>
              {isPastSnapshot && (
                <ToolbarChip bare>
                  <ToolbarPinButton pinned={isPastSnapshot} onUnpin={() => onChangePinnedSnapshotTime(null)} />
                </ToolbarChip>
              )}
              {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && (
                  <ToolbarChip bare tone="text-ui-muted">
                    <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
                  </ToolbarChip>
              )}
              {isPastSnapshot === false && (
                <ToolbarChip bare tone="text-ui-white">
                  <PageRefreshButton
                    cell
                    onRefresh={refetchHeatmap}
                    isRefreshing={isRefetchingHeatmap}
                    helpText={SNAPSHOT_REFRESH_HELP}
                    minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}
                  >
                    <AnimatedClockLabel snapshotTime={data?.snapshotTime ?? null} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} />
                  </PageRefreshButton>
                </ToolbarChip>
              )}
              {isPastSnapshot === false && (
                <span className="flex shrink-0">
                  <ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} />
                </span>
              )}
            </div>
            <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>
              <TaxonomyBadge taxonomy={settingsModalProps.taxonomy} strongIndustryColor={strongIndustryColor} />
            </div>
    </>
  )
  // 서머리의 두 틀(제목·캡처 이름·내용) — 화면과 3:4 캡처용 판이 같은 내용을 쓴다.
  const summaryFrames = [
              {
                ...MARKET_MAP_FRAME,
                children: (
                  <OverviewMap items={overview.items} colorScale={colorScale} onSelect={handleSelectSector} large decimalPlaces={1} />
                ),
              },
              {
                ...GROUP_CHANGE_FRAME,
                children: (
                  <RankBars chart={overview.chart} highlightColor={isExchange ? 'var(--exchange-accent)' : strongIndustryColor} referenceValueColor={isExchange ? 'var(--exchange-accent)' : mineColor} colorScale={colorScale} onSelectSector={handleSelectSector} onSelectIndex={handleSelectIndex} applyAxisBreak={rangeStartTime === undefined} decimalPlaces={1} />
                ),
              },
            ]
  // 화면과 고정 캡처판이 같은 순서를 쓴다 — summaryFrames 자체는 건드리지 않는다.
  const orderedSummaryFrames = orderFrames(summaryFrames)
  const isMineEmpty = settingsModalProps.taxonomy === 'MINE' && rootNodes.every(node => collectItems(node).length === 0)
  // 캡처판만 빈 내 기준 안내를 보여 준다(화면에서는 위에서 이미 다른 안내를 표시한다).
  const captureFrames = orderedSummaryFrames.map(frame => ({
    ...frame,
    children: isMineEmpty ? <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}><CustomPageBadgeLink /></EmptyLogoMessage> : frame.children,
  }))

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar
        actions={
          <NavBarPageActions
            onRefresh={() => {}}
            isRefreshing={false}
            showRefresh={false}
            onToggleSettings={() => setIsSettingsOpen(previous => !previous)}
            isSettingsOpen={isSettingsOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            onOpenShare={() => openScreenshot(allFramesRef.current, true)}
            isScreenshotOpen={isCapturingAll}
          />
        }
      />
      {/* 지도/그룹/커스텀 페이지와 같은 본문 틀 — 나중에 내용을 채울 때 이 구조를 그대로 쓴다.
          바깥 박스가 메뉴 하단선까지 올라가고, 캡처할 메인 영역은 4px 안쪽에서 시작하므로 안쪽 콘솔 줄은
          위 2.25px·아래 8.25px 여백으로 위치를 맞추고(이 박스 안에 있어야 overflow에 잘리지 않는다), 설정창
          (SettingsPanel)은 이 박스의 맨 오른쪽 자식으로 넣으면 같은 높이에 붙는다. */}
      <div ref={settingsRowRef} className="main-settings-row relative z-10 flex min-h-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
        {/* 스크린샷 대상 — 지도·그룹·커스텀 페이지와 같이 메인 영역 전체(툴바부터 맨 아래 줄까지)다. */}
        <div ref={allFramesRef} data-main-area className="mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          {/* 툴바 — 지도·그래프 페이지와 같은 틀. 왼쪽에 제목 배지, 오른쪽 끝에 분류 배지를 둔다. 로딩 중에도 제자리에 둔다. */}
          <Toolbar>
            {toolbarContent}
          </Toolbar>
          {/* 본문 영역 — 툴바와 맨 아래 줄 사이 전체가 이 영역이다. 좌우 여백은 바깥 main-settings-row에서 관리한다. 로딩·오류 원은 모든 페이지 공통 자리(MainAreaLoading, 메인 영역 기준)에 하나만 두고 틀은 모두 감춘다. */}
          <div className="relative flex min-h-0 flex-1">
            <NxtOnlyNotice active={nxtOnly && nxtOnlyWindow !== null && !isPastSnapshot && rangeStartTime === undefined} window={nxtOnlyWindow} ready={!isLoading && !isError && Boolean(data?.snapshotTime)} nodes={rootNodes} />
            {isLoading ? (
              <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
            ) : isError ? (
              <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} /></MainAreaLoading>
            ) : isMineEmpty ? (
              // 내 분류가 비어 있으면 지도·그래프 페이지와 같은 안내(원·로고·바로 가기)를 서머리 전체에 보여 준다 — 원은 위 로딩 원과 같은 자리다.
              <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
                <CustomPageBadgeLink />
              </EmptyLogoMessage>
            ) : overview.items.length === 0 ? (
              // 종목은 있는데 시총 범위·제외 업종 같은 설정으로 업종이 전부 가려졌다 — 빈 틀만 남지 않게 안내 문구를 보여 준다.
              <div className="relative flex-1">
                <EmptyMessage message={EMPTY_FILTER_MESSAGE} topClass="top-0" />
              </div>
            ) : (
            /* 두 틀이 툴바 바로 아래부터 맨 아래 줄 바로 위까지 영역 전체를 나눠 채운다(바깥 여백 없이, 틀 안쪽 위아래 여백 없음). 외곽선도 틀 사이 구분선도 없다. 위쪽은 커스텀 페이지의 표와 같이 툴바 아래 여백(5.25px)만 둔다. 첫 틀의 "시장 지도" 글자가 지도 페이지 히트맵의 "Top 2" 글자 자리와 비슷하다. 창이 아주 좁으면 틀의 최소 폭(320px)에서 가로로 스크롤된다. */
            <div className="flex min-h-0 min-w-0 flex-1">
            {/* 캡처 복제본에서는 가로 스크롤 래퍼가 스크롤바 자리만큼 아래·오른쪽을 잘라 내서(지도 아래 약 15px), 캡처 중에는 스크롤을 풀어 둔다. */}
            <div className={`flex min-h-0 min-w-0 flex-1 bg-ui-background ${isCapturingAll ? 'overflow-visible' : 'overflow-x-auto'}`}>
            <SortableSummaryScreenFrames frames={orderedSummaryFrames} order={safeSummaryFrameOrder} sensors={frameSensors} onDragEnd={handleFrameDragEnd} {...badgeStyleProps} />
            </div>
            </div>
            )}
          </div>
          {/* 아래 줄 — 지도·그래프 페이지와 같은 높이(28px)로 왼쪽에 면책조항, 오른쪽 끝에 등락률 색상 범례를 둔다. 로딩 중에도 제자리에 둔다. */}
          <DisclaimerFooter captureFullWidthAlign rightContent={<ChangeRateBar swatches={settingsModalProps.legendSwatches} />} />
        </div>
        {/* 서머리·그래프·맵이 함께 쓰는 종목 구성과 색상 설정. */}
        <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel
            pageLabel="Summary"
            tabStorageName="Home"
            {...settingsModalProps}
            isOpen={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            isOnLeft={isSettingsOnLeft}
            onToggleSide={toggleSettingsSide}
            stockCountLabel={stockCountLabel}
            taxonomyAtBottom
            snapshotTime={data?.taxonomyUpdatedAt}
          >
              <SettingsPanelGroup section="composition">
                <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
                <SettingsExcludeSection {...settingsModalProps} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="colors">
                <SettingsColorSection {...settingsModalProps} colorEditorProps={colorEditorPanelProps} fixed={settingsModalProps.taxonomy !== 'MINE'} />
                <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} fixed={settingsModalProps.taxonomy !== 'MINE'} />
              </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && (
        <HiddenSummaryCaptureFrames captureRef={fixedCaptureRef} frameCount={summaryFrames.length} frames={captureFrames} toolbar={<Toolbar className="summary-capture-toolbar">{toolbarContent}</Toolbar>} frameWidth={SUMMARY_CAPTURE_FRAME_WIDTH} {...badgeStyleProps} />
      )}
      {screenshotTarget && (
        <ScreenshotModal
          onClose={closeScreenshot}
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
          fixedSummaryCaptureRef={fixedCaptureRef}
          frameCaptureOptions={frameCaptureOptionsFor(safeSummaryFrameOrder)}
        />
      )}
    </div>
  )
}
