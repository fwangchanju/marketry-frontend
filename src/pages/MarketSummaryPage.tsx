import { Fragment, useMemo, useRef, useState } from 'react'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import CaptureModal from '@/components/CaptureModal'
import { ClockIcon } from '@/components/icons/AppIcons'
import SettingsSidebar, { SettingsGroupDepthSection } from '@/components/SettingsSidebar'
import FrameTitleBadge from '@/components/FrameTitleBadge'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import Spinner from '@/components/Spinner'
import Toolbar from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import ClosingPriceLabel from '@/components/ClosingPriceLabel'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import ToolbarModeText from '@/components/ToolbarModeText'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import ChangeRateBar from '@/components/ChangeRateBar'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { useMarketNotices } from '@/hooks/useMarketNotices'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { captureElementToDownload, captureFileName, downloadDataUrl } from '@/utils/captureToDownload'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toCount, toJoEokDecimal, toSnapshotDateLabel, toPctSigned } from '@/utils/format'
import { buildRankChart } from '@/utils/rankChart'
import { collectItems, computeSectorAverage } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredTreemap'
import { collectAtDepth } from '@/utils/sectorDepth'

// 홈 화면 시험 배치 — 대분류 업종만으로 그린 약식 등락률 지도와 그룹 등락률 그래프를 스마트폰 크기 틀(가로 360px)에 나란히 둔다.
// 모바일 사용자에게 스크린샷으로 찍어 보여 주기 좋은지 보고 계속 진행할지 정한다. 관심종목·요약 API는 쓰지 않는다.
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

// 안내 틀 맨 위의 지수 줄 — 코스피·코스닥은 청록(cyan-700), 바로 아래 등락수는 더 짙은 청록(cyan-900)으로 나눈다. 오르면 빨강·내리면 파랑, 변화가 없거나 값이 없으면 회색이다.
const INDEX_ROWS = [
  { label: '코스피', market: 'KOSPI', badgeClass: 'bg-cyan-700' },
  { label: '코스닥', market: 'KOSDAQ', badgeClass: 'bg-cyan-700' },
] as const

const rateColorClass = (changeRate: number | null): string => (changeRate === null || changeRate === 0 ? 'text-gray-300' : changeRate > 0 ? 'text-red-400' : 'text-blue-400')

const toIndexValue = (value: number): string => value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 지수 대비(전일 대비 포인트) — 부호를 붙인다(+12.34 / -5.67 / 0.00).
const toIndexChange = (value: number): string => `${value > 0 ? '+' : ''}${toIndexValue(value)}`

// 안내 틀에 항상 한 칸씩 두는 안내 종류 — 신규(신규 상장)를 먼저, 정지(거래정지로 지도에서 빠지기 시작한 종목)를 그 아래에 둔다.
const NOTICE_TYPES = [
  { type: 'NEW_LISTING', label: '신규 상장', badgeClass: 'bg-cyan-700', countLabel: '3개월 내 상장', countKey: 'recentNewListingCount', valueKey: 'recentNewListingMarketValue' },
  { type: 'TRADING_SUSPENSION', label: '거래 정지', badgeClass: 'bg-cyan-900', countLabel: '현재 정지 종목', countKey: 'currentSuspensionCount', valueKey: 'currentSuspensionMarketValue' },
] as const

export default function MarketSummaryPage() {
  // 틀마다 스크린샷 버튼이 있다 — 누른 틀 하나만(버튼은 빼고) 스크린샷으로 찍으며, 공유창은 지도·그룹 페이지와 같은 것을 쓴다.
  // 시험용 — 지도와 그래프를 대분류가 아니라 중분류·소분류로도 그려 본다(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 된다.
  const allFramesRef = useRef<HTMLDivElement>(null)
  const [captureTarget, setCaptureTarget] = useState<HTMLElement | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  const {
    settingsModalProps, data, isLoading, isError, refetchTreemap, isRefetchingTreemap, pinnedSnapshotTime, rangeStartTime, rangeExcludedStocks,
    changeRateMode, changeRateChoice, colorScale, strongIndustryColor, excludedSectorIds, excludedMarketValueTiers,
    market, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange,
    isAfterHoursControlsVisible, isAfterHoursSelectable, onChangeChangeRateMode,
  } = useGlobalSettings({ allowChangeRateMode: true })
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsSidebarSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()

  // 달력에서 지난 날짜를 골라 보는 중이면 시각·시간대 표시는 숨긴다(실시간 정보라서) — 지도·그룹 페이지와 같다.
  const isPastSnapshot = pinnedSnapshotTime !== undefined

  // 지도 위 한 줄에 넣을 코스피·코스닥 지수 등락률 — 지도 조회(ALL STOCK)에는 지수가 없어 요약 조회에서 받는다.
  const { data: marketSummary } = useMarketSummary()
  // 안내는 지도와 따로 불러온다 — 실패하거나 느려도 홈 화면을 막지 않고, 못 받으면 틀만 비워 둔다.
  const { data: notices } = useMarketNotices()
  // 요약 조회의 지수는 항상 최근 값이다 — 지도가 지난 시각이나 기간을 보고 있거나 시간외 별도 등락률이면 맞지 않으므로 보여 주지 않는다(그룹 페이지도 일간 등락률일 때만 넣는다).
  const isLatestDailyView = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
  const indexOf = (market: 'KOSPI' | 'KOSDAQ') => {
    const item = isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market) : undefined
    return { indexValue: item?.indexValue ?? null, tradingValue: item?.tradingValue ?? null, changeValue: item?.changeValue ?? null, changeRate: item?.changeRate ?? null }
  }

  // 코스피·코스닥 거래대금(억 원)과 그 합 — 합은 둘 중 하나라도 못 받았으면 null이다. 서버 값은 백만 원 단위라 100으로 나눈다.
  const kospiTradingValue = indexOf('KOSPI').tradingValue
  const kosdaqTradingValue = indexOf('KOSDAQ').tradingValue
  const totalTradingValueEok = kospiTradingValue === null || kosdaqTradingValue === null ? null : (kospiTradingValue + kosdaqTradingValue) / 100

  // 홈은 업종 분류 단계를 대분류로 잠가 둔다 — 단계를 내리면 상위 업종에 직접 붙은 종목이 막대에서 빠져 종목 수·평균이 달라지기 때문이다(docs/history.md).
  const effectiveDepth = 1
  // 고른 단계의 업종만 모아 지도 박스와 그래프 막대로 쓴다 — 지도 페이지와 같은 제외 기준을 따른다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    // 그래프에 든 업종의 종목 중 오른 종목·내린 종목·보합 종목 수 — 평균과 같은 기준(제외한 시가총액 구간 빼고 하위 업종 전체)으로 센다.
    let advancers = 0
    let decliners = 0
    let unchanged = 0
    for (const { node, pathKey } of collectAtDepth(data?.items ?? [], effectiveDepth, excludedSectorIds, excludedMarketValueTiers)) {
      const average = computeSectorAverage(node, excludedMarketValueTiers)
      if (average.weightedAvg === null) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: node.totalMarketValue, changeRate: average.weightedAvg })
      for (const item of collectItems(node)) {
        if (excludedMarketValueTiers.has(item.marketValueTier)) continue
        if (item.changeRate > 0) advancers += 1
        else if (item.changeRate < 0) decliners += 1
        else unchanged += 1
      }
    }
    const entries = items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false }))
    // 그룹 페이지처럼 코스피·코스닥 지수 등락률을 강조 색 참조 막대로 값 순서 자리에 끼운다.
    for (const [market, label] of [['KOSPI', '코스피'], ['KOSDAQ', '코스닥']] as const) {
      const changeRate = isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market)?.changeRate : undefined
      if (changeRate !== undefined) entries.push({ key: `market-index:${market}`, sectorName: label, value: changeRate, isReference: true })
    }
    const chart = buildRankChart(entries)
    return { items, chart, advancers, decliners, unchanged }
  }, [data, excludedSectorIds, excludedMarketValueTiers, effectiveDepth, marketSummary, isLatestDailyView])
  // 설정창 위쪽 "nn/nn종목" — 그룹 페이지와 같은 기준이다. 분모는 지금 시장의 모든 종목, 분자는 제외한 업종(하위 업종까지)·시가총액 구간을 뺀 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = data?.items ?? []
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0)
    const included = filterTreeByExclusions(nodes, excludedSectorIds, excludedMarketValueTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return `${toCount(included)}/${toCount(total)}종목`
  }, [data, excludedSectorIds, excludedMarketValueTiers])
  // 세 틀을 한 장으로 스크린샷으로 찍는 중에는 틀마다 있는 스크린샷 버튼을 감춰서 이미지에 찍히지 않게 한다.
  const isCapturingAll = captureTarget !== null && captureTarget === allFramesRef.current
  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureTarget) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (captureTarget) await captureElementToClipboard(captureTarget)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureTarget) return
    setDownloadStatus('downloading')
    try {
      if (previewSrc) downloadDataUrl(previewSrc, captureFileName('HOME'))
      else if (captureTarget) await captureElementToDownload(captureTarget, captureFileName('HOME'))
    } catch {
      setDownloadStatus('error')
    } finally {
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'
  // 세 틀의 제목 줄 오른쪽 끝에 같은 기준 날짜·시각을 보여 준다 — 데이터를 받은 뒤에만 보인다.

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-black">
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
            onOpenShare={() => setCaptureTarget(allFramesRef.current)}
            isCaptureOpen={isCapturingAll}
          />
        }
      />
      {/* 지도/그룹/커스텀 페이지와 같은 본문 틀 — 나중에 내용을 채울 때 이 구조를 그대로 쓴다.
          바깥 박스가 -mt-[10.5px]로 NavSubBar의 짙은 회색 하단에 맞춰 올라가 있으므로, 안쪽 콘솔 줄은
          mt/mb 5.25px로 위치를 맞추고(이 박스 안에 있어야 overflow에 잘리지 않는다), 설정창
          (SettingsSidebar)은 이 박스의 맨 오른쪽 자식으로 넣으면 같은 높이에 붙는다. */}
      <div ref={settingsRowRef} className="relative z-10 -mt-[10.5px] flex min-h-0 flex-1 overflow-hidden bg-black text-white">
        {/* 스크린샷 대상 — 지도·그룹·커스텀 페이지와 같이 메인 영역 전체(툴바부터 맨 아래 줄까지)다. */}
        <div ref={allFramesRef} data-main-area className="flex min-h-0 min-w-0 flex-1 flex-col bg-black">
          {/* 툴바 — 지도·그룹 페이지와 같은 틀. 왼쪽에 제목 배지, 오른쪽 끝에 분류 배지를 둔다. 로딩 중에도 제자리에 둔다. */}
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="HOME" label="ALL STOCK" />
              {/* 지도·그룹 페이지와 같은 날짜·시각·시간대 — 홈도 이 날짜(달력으로 고른 날)를 따라가므로 지금 어느 날짜를 보는지 여기서 보이고 바꿀 수 있어야 한다.
                  애프터 마켓 시간에는 등락률 기준(종가·누적·별도) 선택도 지도·그룹 페이지와 같이 보인다. 로딩·오류에서도 제자리에 둔다. */}
              <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-white'}>
                <SnapshotDatePicker
                  market={market}
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
              {isPastSnapshot && (rangeStartTime && pinnedSnapshotTime
                ? rangeExcludedStocks.length > 0 && (
                  <ToolbarChip bare tone="text-gray-400">
                    <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
                  </ToolbarChip>
                )
                : (
                  <ToolbarChip tone="text-[var(--brand)]">
                    <ClosingPriceLabel viewedSnapshotTime={data?.snapshotTime ?? null} liveSnapshotTime={liveSnapshotTime} />
                  </ToolbarChip>
                ))}
              {isPastSnapshot === false && (
                <ToolbarChip bare tone="text-white">
                  <PageRefreshButton
                    cell
                    onRefresh={refetchTreemap}
                    isRefreshing={isRefetchingTreemap}
                    helpText={SNAPSHOT_REFRESH_HELP}
                    minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}
                  >
                    <ClockIcon className="h-[15px] w-[15px] shrink-0" aria-hidden />
                    <AnimatedClockLabel snapshotTime={data?.snapshotTime ?? null} />
                  </PageRefreshButton>
                </ToolbarChip>
              )}
              {isPastSnapshot === false && (
                <span className="flex shrink-0">
                  <ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} />
                </span>
              )}
            </div>
            <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-gray-400`}>
              <TaxonomyBadge taxonomy={settingsModalProps.taxonomy} />
            </div>
          </Toolbar>
          {/* 본문 영역 — 툴바와 맨 아래 줄 사이 전체가 이 영역이다(좌우 7px). 로딩·오류 원은 지도·그룹·커스텀 페이지와 같은 위 16px·아래 19.5px 여백 안에서 영역 가운데에 하나만 두고 틀은 모두 감춘다. */}
          <div className="flex min-h-0 flex-1 px-[7px]">
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]">
                <Spinner showElapsed />
              </div>
            ) : isError ? (
              <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]">
                <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchTreemap} />
              </div>
            ) : (
            /* 세 틀이 툴바 바로 아래부터 맨 아래 줄 바로 위까지 영역 전체를 나눠 채운다(바깥 여백 없이, 틀 안쪽 위아래 여백 없음). 외곽선도 틀 사이 구분선도 없다. 위쪽은 커스텀 페이지의 표와 같이 툴바 아래 여백(5.25px)만 둔다. 첫 틀의 "시장 요약" 글자가 지도 페이지 트리맵의 "Top 2" 글자 자리와 비슷하다. 창이 아주 좁으면 틀의 최소 폭(300px)에서 가로로 스크롤된다. */
            <div className="flex min-h-0 min-w-0 flex-1">
            <div className="flex min-h-0 min-w-0 flex-1 overflow-x-auto bg-black">
            <div className="flex min-h-0 min-w-full flex-1 bg-black">
            {[
              {
                // 거래정지로 지도에서 빠지기 시작한 종목, 신규 상장 종목을 그날 하루만 종류별 칸(신규 상장·거래 정지)에 보여 준다. 없는 종류는 배지 옆에 "없음"을 적는다.
                title: '시장 요약',
                body: (
                  // 두 칸 격자다: [배지 칸(네 배지 중 가장 긴 쪽 너비)] [회색 칸(남는 폭)]. 신규 상장·3개월 내 상장·거래 정지·현재 정지 종목 네 줄을 세로 한 열로 쌓고,
                  // 배지 칸이 네 줄에 공유돼 짧은 배지는 오른쪽만 늘어나 모두 같은 너비가 된다(글자는 왼쪽). 짝이 되는 두 배지(신규 상장·3개월 내 상장, 거래 정지·현재 정지 종목)는 같은 색이라 한눈에 짝이 보인다. 색은 분류 배지(코스피·대분류)의 청록(cyan-700)과 그보다 짙은 청록(cyan-900) 두 가지다 — 빨강·파랑은 오름·내림 뜻이 있어 쓰지 않는다.
                  <div className="grid min-h-0 w-full flex-1 grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1.5fr)] content-start gap-x-1 gap-y-1 overflow-y-auto text-[14px] font-medium leading-none tabular-nums">
                    {/* 맨 위 세 줄은 코스피·코스닥 지수와 등락수(▲N ▼N ■N)다. 코스닥 아래에 등락수와 거래대금, 그 아래에는 빈 줄을 두고 신규 상장부터 안내 종목을 둔다. */}
                    {INDEX_ROWS.map(({ label, market, badgeClass }) => {
                      const { indexValue, changeValue, changeRate } = indexOf(market)
                      return (
                        <Fragment key={label}>
                          <span className="flex h-6 items-center">
                            <span className={`w-full whitespace-nowrap px-1 py-[3px] text-white ${badgeClass}`}>{label}</span>
                          </span>
                          <span className="col-span-3 flex h-6 items-center">
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-start gap-2 rounded-sm bg-zinc-800 pl-1 pr-3">
                              {/* 코스피·코스닥 두 줄의 지수·대비·등락률이 자릿수가 달라도 두 줄이 세로로 맞도록, 값 묶음은 왼쪽에 두고, 값마다 최소 폭을 두어 숫자 끝을 오른쪽으로 맞춘다. 왼쪽 안쪽 여백은 4px다. */}
                              <span className="min-w-[8ch] text-right text-gray-300">{indexValue === null ? '' : toIndexValue(indexValue)}</span>
                              <span className={`min-w-[7ch] text-right ${rateColorClass(changeRate)}`}>{changeValue === null ? '' : toIndexChange(changeValue)}</span>
                              <span className={`min-w-[7ch] text-right ${rateColorClass(changeRate)}`}>{changeRate === null ? '' : toPctSigned(changeRate)}</span>
                            </span>
                          </span>
                        </Fragment>
                      )
                    })}
                    <span className="flex h-6 items-center">
                      <span className="w-full whitespace-nowrap bg-cyan-900 px-1 py-[3px] text-white">등락수</span>
                    </span>
                    <span className="col-span-3 flex h-6 items-center">
                      <span className="flex h-[22px] min-w-0 flex-1 items-center justify-start gap-2 rounded-sm bg-zinc-800 pl-1 pr-3">
                        {/* 위 코스피·코스닥 줄과 같은 칸 폭·정렬이다. */}
                        <span className="min-w-[8ch] text-right text-red-400">▲{overview.advancers}</span>
                        <span className="min-w-[7ch] text-right text-blue-400">▼{overview.decliners}</span>
                        <span className="min-w-[7ch] text-right text-gray-300">■{overview.unchanged}</span>
                      </span>
                    </span>
                    <span className="flex h-6 items-center">
                      <span className="w-full whitespace-nowrap bg-cyan-900 px-1 py-[3px] text-white">거래대금</span>
                    </span>
                    <span className="col-span-3 flex h-6 items-center">
                      <span className="flex h-[22px] min-w-0 flex-1 items-center justify-start gap-2 rounded-sm bg-zinc-800 pl-1 pr-3 text-gray-300">
                        {/* 코스피 / 코스닥 / 전체 순서이고, 위 지수 줄의 지수·대비·등락률과 같은 칸 폭에 숫자 끝을 오른쪽으로 맞춘다. */}
                        <span className="min-w-[8ch] text-right">{kospiTradingValue === null ? '' : toJoEokDecimal(kospiTradingValue / 100)}</span>
                        <span className="min-w-[7ch] text-right">{kosdaqTradingValue === null ? '' : toJoEokDecimal(kosdaqTradingValue / 100)}</span>
                        <span className="min-w-[7ch] text-right">{totalTradingValueEok === null ? '' : toJoEokDecimal(totalTradingValueEok)}</span>
                      </span>
                    </span>
                    <span aria-hidden="true" className="col-span-4 h-6" />
                    {NOTICE_TYPES.map(({ type, label, badgeClass, countLabel, countKey, valueKey }) => {
                      const items = (notices?.items ?? []).filter(item => item.type === type)
                      const rowClass = 'flex h-6 items-center'
                      return (
                        <Fragment key={type}>
                          {/* 네 배지의 너비·좌우 끝은 모두 같다. 들여쓰기는 배지가 아니라 오른쪽 회색 칸의 종목 이름 글자에 한다. */}
                          <span className={rowClass}>
                            <span className={`w-full whitespace-nowrap px-1 py-[3px] text-white ${badgeClass}`}>{label}</span>
                          </span>
                          {/* 그날 안내 종목은 종류 배지 바로 오른쪽 회색 칸에 한 줄로 적는다 — 없으면 글자 없이 빈 칸, 둘 이상이면 이름을 " · "(공백·가운뎃점·공백)로 이어 쓰고 칸보다 길면 …로 줄인다. */}
                          <span className={`${rowClass} col-span-3`}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center rounded-sm bg-zinc-800 pl-[calc(0.25rem+0.34em)] pr-1 text-gray-300">
                              <span className="min-w-0 truncate">{items.map(item => item.stockName).join(' · ')}</span>
                            </span>
                          </span>
                          {/* 날짜와 무관한 현황 이름표(신규 상장은 "3개월 내 상장", 거래 정지는 "현재 정지 종목")는 짝이 되는 종류 배지와 같은 색 배지, 오른쪽 회색 칸에 건수를 적는다. 아직 못 받았으면 "-"를 적는다(0건이면 0). */}
                          <span className={rowClass}>
                            <span className={`w-full whitespace-nowrap px-1 py-[3px] text-white ${badgeClass}`}>{countLabel}</span>
                          </span>
                          <span className={rowClass}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-center rounded-sm bg-zinc-800 px-1 text-gray-300">{notices?.[countKey] ?? '-'}</span>
                          </span>
                          {/* 같은 줄 오른쪽에 그 종목들의 현시점 시가총액 합을 "시가총액 합" 배지(같은 줄 배지와 같은 색)와 회색 칸으로 둔다. 표기는 Custom 페이지와 같은 n,nnn.n조/억이다. */}
                          <span className={`${rowClass} whitespace-nowrap`}>
                            <span className={`px-1 py-[3px] text-white ${badgeClass}`}>시가총액 합</span>
                          </span>
                          <span className={rowClass}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-end rounded-sm bg-zinc-800 px-1 text-gray-300">
                              {notices?.[valueKey] != null ? toJoEokDecimal(notices[valueKey] / 100_000_000) : ''}
                            </span>
                          </span>
                        </Fragment>
                      )
                    })}
                  </div>
                ),
              },
              {
                title: '시장 지도',
                body: (
                  <div className="flex min-h-0 w-full flex-1 flex-col">
                    <OverviewMap items={overview.items} colorScale={colorScale} />
                  </div>
                ),
              },
              {
                title: '그룹 등락률 (%)',
                body: (
                  <div className="flex min-h-0 w-full flex-1 flex-col">
                    <div className="flex min-h-0 w-full flex-1">
                      <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} />
                    </div>
                  </div>
                ),
              },
            ].map((frame, frameIndex) => (
              <section key={frame.title} className={`relative flex h-full min-w-[300px] flex-col bg-black ${frameIndex === 1 ? 'flex-1' : 'flex-none basis-[calc(100%/3_-_4px)]'}`}>
                {/* 안쪽 여백은 양 끝(첫 틀의 왼쪽·마지막 틀의 오른쪽)에는 두지 않고 틀 사이(구분선 양옆)에만 12px 둔다. 그래서 양 끝 틀은 한쪽 여백(12px), 가운데 틀은 양쪽 여백(24px)을 가진다. 틀(section) 폭을 같게 두면 가운데 내용만 12px 좁아지므로, 양 끝 틀의 폭을 (전체 ÷ 3 − 4px)로 정해 세 틀의 내용 폭을 같게 한다. 위아래 여백은 없다. */}
                <div className={`flex min-h-0 flex-1 flex-col bg-black ${frameIndex === 0 ? 'pl-0 pr-3' : frameIndex === 2 ? 'pl-3 pr-0' : 'px-3'}`}>
                  {/* 세 틀의 제목 줄(28px). */}
                  <h2 className="m-0 mb-1 flex h-7 shrink-0 items-center justify-start">
                    <FrameTitleBadge title={frame.title} />
                  </h2>
                  {frame.body}
                </div>
              </section>
            ))}
            </div>
            </div>
            </div>
            )}
          </div>
          {/* 아래 줄 — 지도·그룹 페이지와 같은 높이(28px)로 왼쪽에 면책조항, 오른쪽 끝에 등락률 색상 범례를 둔다. 로딩 중에도 제자리에 둔다. */}
          <div className="flex h-7 shrink-0 items-end justify-between gap-3 px-[7px]">
            <div className="flex h-7 min-w-0 items-end">
              <DisclaimerNotice />
            </div>
            <ChangeRateBar swatches={settingsModalProps.legendSwatches} />
          </div>
        </div>
        {/* 설정창 틀만 먼저 둔다 — 항목은 홈 화면 내용이 정해지면 채운다. */}
        <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
          <SettingsSidebar
            pageLabel="Home"
            {...settingsModalProps}
            isOpen={isSettingsOpen}
            onOpenChange={setIsSettingsOpen}
            isOnLeft={isSettingsOnLeft}
            onToggleSide={toggleSettingsSide}
            plainContent={<SettingsGroupDepthSection depth={1} onChange={() => {}} selectableDepth={1} lockedMessage={<>홈은 대분류로<br />고정되어 있습니다.</>} />}
            stockCountLabel={stockCountLabel}
            taxonomyAtBottom
            snapshotTime={data?.taxonomyUpdatedAt}
          />
        </div>
      </div>
      {captureTarget && (
        <CaptureModal
          onClose={() => setCaptureTarget(null)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          captureTarget={captureTarget}
        />
      )}
    </div>
  )
}
