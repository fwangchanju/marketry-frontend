import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import { ClockIcon } from '@/components/icons/AppIcons'
import SettingsPanel, { SettingsGroupDepthSection } from '@/components/SettingsPanel'
import FrameTitleBadge from '@/components/FrameTitleBadge'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import Spinner from '@/components/Spinner'
import Toolbar from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import ToolbarModeText from '@/components/ToolbarModeText'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import ChangeRateBar from '@/components/ChangeRateBar'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import type { MarketOverviewTrendItem, MarketSectorTrendItem } from '@/types/api'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { useMarketNotices } from '@/hooks/useMarketNotices'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toCount, toJoEokDecimal, toSnapshotDateLabel, toPctSigned } from '@/utils/format'
import { buildRankChart } from '@/utils/rankChart'
import { resolveTreemapColor, resolveTreemapExtremeColor, type ColorScaleConfig } from '@/utils/treemapColorScale'
import { collectItems, computeSectorAverage } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredTreemap'
import { collectAtDepth } from '@/utils/sectorDepth'

// 홈 시장 요약 배치
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'

// 시장 요약의 항목 배지는 툴바의 "분류" 칸과 같은 짙은 청록 배경(--brand-surface)·흰 글자을 쓴다. 지수는 오르면 빨강·내리면 파랑, 변화가 없거나 값이 없으면 회색이다.
const INDEX_ROWS = [
  { label: '코스피', market: 'KOSPI' },
  { label: '코스닥', market: 'KOSDAQ' },
] as const


const toIndexValue = (value: number): string => value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function MarketIndexTrendChart({ items, market, label, colorScale }: { items: MarketOverviewTrendItem[]; market: 'KOSPI' | 'KOSDAQ'; label: string; colorScale: ColorScaleConfig }) {
  const dateLabel = (date: string) => {
    const value = new Date(`${date}T00:00:00Z`)
    return `${value.getUTCMonth() + 1}/${value.getUTCDate()}`
  }
  const values = items.filter(item => item.market === market).sort((a, b) => a.date.localeCompare(b.date))
  const scale = Math.max(3, ...values.map(item => Math.abs(item.changeRate)))
  return (
    <div role="img" aria-label={`${label} 최근 ${values.length}거래일 등락률 그래프`} className="grid w-full grid-cols-5 gap-1 pt-1">
      {values.map(item => {
        const magnitude = Math.min(Math.abs(item.changeRate) / scale, 1) * 26
        const height = Math.max(2, magnitude)
        const barColor = item.changeRate === 0 ? 'var(--ui-muted)' : resolveTreemapExtremeColor(item.changeRate, colorScale)
        return (
          <div key={`${item.date}-${item.market}`} className="min-w-0 text-center">
            <div className="h-4 truncate text-[10px] font-semibold tabular-nums text-ui-text">{item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(1)}%</div>
            <div className="relative mx-auto h-[54px] w-full max-w-24">
              <div className="absolute inset-x-0 top-1/2 h-px bg-ui-muted" />
              <div className="absolute inset-x-0 top-0 flex h-1/2 items-end justify-center">
                {item.changeRate >= 0 && <i className="w-1/2 rounded-t-sm" style={{ height, backgroundColor: barColor }} />}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex h-1/2 items-start justify-center">
                {item.changeRate < 0 && <i className="w-1/2 rounded-b-sm" style={{ height, backgroundColor: barColor }} />}
              </div>
            </div>
            <div className="mt-1 whitespace-nowrap text-[10px] tabular-nums text-ui-muted">{dateLabel(item.date)}</div>
          </div>
        )
      })}
      {!values.length && <div className="col-span-5 py-5 text-center text-[12px] text-ui-muted">이력 없음</div>}
    </div>
  )
}

function SectorTrendChart({ items, colorScale }: { items: MarketSectorTrendItem[]; colorScale: ColorScaleConfig }) {
  const dates = [...new Set(items.map(item => item.date))].sort()
  const latestDate = dates.at(-1)
  const topSectors = items.filter(item => item.date === latestDate).sort((a, b) => b.changeRate - a.changeRate).slice(0, 5)
  const series = topSectors.map((sector, index) => ({
    name: sector.sectorName,
    color: resolveTreemapExtremeColor(sector.changeRate, colorScale),
    values: dates.map(date => items.find(item => item.date === date && item.sectorName === sector.sectorName)?.changeRate ?? null),
    index,
  })).filter(item => item.values.some(value => value !== null))
  const allValues = series.flatMap(item => item.values.filter((value): value is number => value !== null))
  const extent = Math.max(1, ...allValues.map(Math.abs))
  const points = (value: number | null, index: number) => value === null ? null : `${12 + index * (196 / Math.max(1, dates.length - 1))},${44 - value / extent * 34}`
  return (
    <div>
      <svg role="img" aria-label="오늘 상위 업종 최근 5거래일 등락률 그래프" preserveAspectRatio="none" viewBox="0 0 220 78" className="block h-[96px] w-full">
        {[8, 39, 70].map(y => <line key={y} x1="8" x2="212" y1={y} y2={y} stroke={y === 39 ? 'var(--ui-muted)' : 'var(--ui-border)'} strokeWidth="0.7" strokeDasharray={y === 39 ? undefined : '2 3'} />)}
        {series.map(line => {
          const path = line.values.map((value, index) => points(value, index)).filter((point): point is string => point !== null).join(' ')
          return <polyline key={line.name} points={path} fill="none" stroke={line.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        })}
      </svg>
      <div className="grid grid-cols-5 text-center text-[10px] tabular-nums text-ui-muted">
        {dates.map(date => <span key={date}>{`${new Date(`${date}T00:00:00Z`).getUTCMonth() + 1}/${new Date(`${date}T00:00:00Z`).getUTCDate()}`}</span>)}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ui-text">
        {series.map(line => <span key={line.name} className="flex items-center gap-1"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />{line.name}</span>)}
        {!series.length && <span className="text-ui-muted">이력 없음</span>}
      </div>
    </div>
  )
}

function SummaryBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-5 items-center rounded-sm bg-[var(--brand-surface)] px-1.5 text-[12px] font-semibold text-ui-white">{children}</span>
}

// 안내 틀에 항상 한 칸씩 두는 안내 종류 — 신규(신규 상장)를 먼저, 정지(거래정지로 지도에서 빠지기 시작한 종목)를 그 아래에 둔다.
const NOTICE_TYPES = [
  { type: 'NEW_LISTING', label: '신규 상장', showItems: true, badgeClass: 'bg-[var(--brand-surface)] text-ui-white', countLabel: '3개월 내 상장', countKey: 'recentNewListingCount', valueKey: 'recentNewListingMarketValue' },
  { type: 'TRADING_SUSPENSION', label: '거래 정지', showItems: false, badgeClass: 'bg-[var(--brand-surface)] text-ui-white', countLabel: '거래 정지 중', countKey: 'currentSuspensionCount', valueKey: 'currentSuspensionMarketValue' },
] as const

const HOME_FRAME_ORDER_KEY = 'marketry-home-frame-order'
const DEFAULT_HOME_FRAME_ORDER = ['시장 요약', '시장 지도', '그룹 등락률 (%)']

function SortableHomeFrame({ title, captureId, index, children, captureUntil, highlightColor }: { title: string; captureId: string; index: number; children: ReactNode; captureUntil?: string; highlightColor: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: title })
  return (
    <section
      ref={setNodeRef}
      data-capture-until={captureUntil}
      style={{ order: index, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.6 : undefined }}
      className={`home-summary-frame relative flex h-full min-w-[320px] flex-col bg-ui-background ${index === 1 ? 'flex-1' : 'flex-none basis-[calc(100%/3_-_4px)]'} ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      <div data-capture-frame={captureId} className={`flex min-h-0 flex-1 flex-col bg-ui-background ${index === 0 ? 'pl-0 pr-3' : index === 2 ? 'pl-3 pr-0' : 'px-3'}`}>
        <h2 className="relative z-[6] m-0 flex h-[18px] shrink-0 items-center justify-center">
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={`${title}, 끌어서 위치 이동`}
            {...attributes}
            {...listeners}
            className="home-frame-header group w-full cursor-grab border-0 bg-transparent p-0 text-left active:cursor-grabbing focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--brand)]"
          >
            <FrameTitleBadge title={title} color={highlightColor} />
          </button>
        </h2>
        {children}
      </div>
    </section>
  )
}

export default function MarketSummaryPage() {
  // 틀마다 스크린샷 버튼이 있다 — 누른 틀 하나만(버튼은 빼고) 스크린샷으로 찍으며, 공유창은 지도·그룹 페이지와 같은 것을 쓴다.
  // 시험용 — 지도와 그래프를 대분류가 아니라 중분류·소분류로도 그려 본다(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 된다.
  const allFramesRef = useRef<HTMLDivElement>(null)
  const [screenshotTarget, setScreenshotTarget] = useState<HTMLElement | null>(null)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const {
    settingsModalProps, data, isLoading, isError, refetchTreemap, isRefetchingTreemap, pinnedSnapshotTime, rangeStartTime, rangeExcludedStocks,
    changeRateMode, changeRateChoice, colorScale, strongIndustryColor, excludedSectorIds, excludedMarketValueTiers,
    market, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange,
    isAfterHoursControlsVisible, isAfterHoursSelectable, onChangeChangeRateMode,
  } = useGlobalSettings({ allowChangeRateMode: true })
  // 오르내림 숫자는 지도·그룹 순위와 같은 색 체계의 가장 진한 단계 색을 쓴다(색 구간을 바꿔도 같이 바뀐다). 보합·값 없음은 본문 회색이다.
  const rateColorStyle = (changeRate: number | null) => (changeRate === null || changeRate === 0 ? undefined : { color: resolveTreemapExtremeColor(changeRate, colorScale) })
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [homeFrameOrder, setHomeFrameOrder] = useLocalPersistedState(HOME_FRAME_ORDER_KEY, DEFAULT_HOME_FRAME_ORDER)
  const frameSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const safeHomeFrameOrder = [
    ...homeFrameOrder.filter((title, index) => DEFAULT_HOME_FRAME_ORDER.includes(title) && homeFrameOrder.indexOf(title) === index),
    ...DEFAULT_HOME_FRAME_ORDER.filter(title => !homeFrameOrder.includes(title)),
  ]
  const handleFrameDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = safeHomeFrameOrder.indexOf(String(active.id))
    const to = safeHomeFrameOrder.indexOf(String(over.id))
    if (from >= 0 && to >= 0) setHomeFrameOrder(arrayMove(safeHomeFrameOrder, from, to))
  }
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
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

  // 홈은 업종 분류 단계를 대분류로 잠가 둔다 — 단계를 내리면 상위 업종에 직접 붙은 종목이 막대에서 빠져 종목 수·평균이 달라지기 때문이다(docs/history.md).
  const effectiveDepth = 1
  // 고른 단계의 업종만 모아 지도 박스와 그래프 막대로 쓴다 — 지도 페이지와 같은 제외 기준을 따른다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    // 오른 종목·내린 종목·보합 종목 수는 제외한 업종·시가총액 구간과 상관없이 지금 시장의 전체 종목을 센다(제외 설정은 막대·지도에만 적용한다).
    let advancers = 0
    let decliners = 0
    let unchanged = 0
    for (const node of data?.items ?? []) {
      for (const item of collectItems(node)) {
        if (item.changeRate > 0) advancers += 1
        else if (item.changeRate < 0) decliners += 1
        else unchanged += 1
      }
    }
    for (const { node, pathKey } of collectAtDepth(data?.items ?? [], effectiveDepth, excludedSectorIds, excludedMarketValueTiers)) {
      const average = computeSectorAverage(node, excludedMarketValueTiers)
      if (average.weightedAvg === null) continue
      const nodeItems = collectItems(node)
      const advancers = nodeItems.filter(candidate => candidate.changeRate > 0).length
      const decliners = nodeItems.filter(candidate => candidate.changeRate < 0).length
      items.push({
        key: pathKey,
        name: node.sectorName,
        marketValue: node.totalMarketValue,
        changeRate: average.weightedAvg,
        simpleAvg: average.simpleAvg,
        advancers,
        decliners,
        unchanged: nodeItems.length - advancers - decliners,
      })
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
  const isCapturingAll = screenshotTarget !== null && screenshotTarget === allFramesRef.current
  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotTarget) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotTarget) await screenshotElementToClipboard(screenshotTarget)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }


  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  // 세 틀의 제목 줄 오른쪽 끝에 같은 기준 날짜·시각을 보여 준다 — 데이터를 받은 뒤에만 보인다.

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ui-background">
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
            onOpenShare={() => setScreenshotTarget(allFramesRef.current)}
            isScreenshotOpen={isCapturingAll}
          />
        }
      />
      {/* 지도/그룹/커스텀 페이지와 같은 본문 틀 — 나중에 내용을 채울 때 이 구조를 그대로 쓴다.
          바깥 박스가 -mt-[10.5px]로 NavSubBar의 짙은 회색 하단에 맞춰 올라가 있으므로, 안쪽 콘솔 줄은
          위 2.25px·아래 8.25px 여백으로 위치를 맞추고(이 박스 안에 있어야 overflow에 잘리지 않는다), 설정창
          (SettingsPanel)은 이 박스의 맨 오른쪽 자식으로 넣으면 같은 높이에 붙는다. */}
      <div ref={settingsRowRef} className="main-settings-row relative z-10 -mt-[10.5px] flex min-h-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
        {/* 스크린샷 대상 — 지도·그룹·커스텀 페이지와 같이 메인 영역 전체(툴바부터 맨 아래 줄까지)다. */}
        <div ref={allFramesRef} data-main-area className="flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          {/* 툴바 — 지도·그룹 페이지와 같은 틀. 왼쪽에 제목 배지, 오른쪽 끝에 분류 배지를 둔다. 로딩 중에도 제자리에 둔다. */}
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="HOME" label="ALL STOCK" />
              {/* 지도·그룹 페이지와 같은 날짜·시각·시간대 — 홈도 이 날짜(달력으로 고른 날)를 따라가므로 지금 어느 날짜를 보는지 여기서 보이고 바꿀 수 있어야 한다.
                  애프터 마켓 시간에는 등락률 기준(종가·누적·별도) 선택도 지도·그룹 페이지와 같이 보인다. 로딩·오류에서도 제자리에 둔다. */}
              <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}>
                <SnapshotDatePicker
                  market={market}
                  holidayColor={resolveTreemapColor(8, colorScale)}
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
              {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && rangeExcludedStocks.length > 0 && (
                  <ToolbarChip bare tone="text-ui-muted">
                    <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
                  </ToolbarChip>
              )}
              {isPastSnapshot === false && (
                <ToolbarChip bare tone="text-ui-white">
                  <PageRefreshButton
                    cell
                    onRefresh={refetchTreemap}
                    isRefreshing={isRefetchingTreemap}
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
              <TaxonomyBadge taxonomy={settingsModalProps.taxonomy} />
            </div>
          </Toolbar>
          {/* 본문 영역 — 툴바와 맨 아래 줄 사이 전체가 이 영역이다. 좌우 여백은 바깥 main-settings-row에서 관리한다. 로딩·오류 원은 지도·그룹·커스텀 페이지와 같은 위 16px·아래 19.5px 여백 안에서 영역 가운데에 하나만 두고 틀은 모두 감춘다. */}
          <div className="flex min-h-0 flex-1">
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]">
                <Spinner showElapsed />
              </div>
            ) : isError ? (
              <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]">
                <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchTreemap} />
              </div>
            ) : (
            /* 세 틀이 툴바 바로 아래부터 맨 아래 줄 바로 위까지 영역 전체를 나눠 채운다(바깥 여백 없이, 틀 안쪽 위아래 여백 없음). 외곽선도 틀 사이 구분선도 없다. 위쪽은 커스텀 페이지의 표와 같이 툴바 아래 여백(5.25px)만 둔다. 첫 틀의 "시장 지도" 글자가 지도 페이지 트리맵의 "Top 2" 글자 자리와 비슷하다. 창이 아주 좁으면 틀의 최소 폭(320px)에서 가로로 스크롤된다. */
            <div className="flex min-h-0 min-w-0 flex-1">
            {/* 캡처 복제본에서는 가로 스크롤 래퍼가 스크롤바 자리만큼 아래·오른쪽을 잘라 내서(지도 아래 약 15px), 캡처 중에는 스크롤을 풀어 둔다. */}
            <div className={`flex min-h-0 min-w-0 flex-1 bg-ui-background ${isCapturingAll ? 'overflow-visible' : 'overflow-x-auto'}`}>
            <DndContext sensors={frameSensors} collisionDetection={closestCenter} onDragEnd={handleFrameDragEnd}>
            <SortableContext items={safeHomeFrameOrder} strategy={horizontalListSortingStrategy}>
            <div data-capture-full-width className="flex min-h-0 min-w-full flex-1 bg-ui-background">
            {[
              {
                title: '시장 지도',
                captureId: 'market-map',
                body: (
                  <div className="flex min-h-0 w-full flex-1 flex-col">
                    <OverviewMap items={overview.items} colorScale={colorScale} />
                  </div>
                ),
              },
              {
                title: '그룹 등락률 (%)',
                captureId: 'group-change-rate',
                body: (
                  <div className="flex min-h-0 w-full flex-1 flex-col">
                    <div className="flex min-h-0 w-full flex-1">
                      <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} />
                    </div>
                  </div>
                ),
              },
              {
                // 거래정지로 지도에서 빠지기 시작한 종목, 신규 상장 종목을 그날 하루만 종류별 칸(신규 상장·거래 정지)에 보여 준다. 없는 종류는 배지 옆에 "없음"을 적는다.
                title: '시장 요약',
                captureId: 'market-summary',
                body: (
                  <div className="min-h-0 w-full flex-1 space-y-2 overflow-y-auto pb-1 text-[14px] font-medium leading-none tabular-nums">
                    {INDEX_ROWS.map(({ label, market }) => {
                      const { indexValue, tradingValue, changeRate } = indexOf(market)
                      const trendItems = marketSummary?.marketOverviewTrends ?? []
                      return (
                        <section key={market} aria-label={`${label} 오늘 시장 요약`} className="space-y-1.5 rounded-sm border border-ui-border bg-ui-background px-2 py-1.5">
                          <div className="space-y-1">
                            <SummaryBadge>{label} · 오늘</SummaryBadge>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { label: '지수', value: indexValue === null ? '—' : toIndexValue(indexValue), color: undefined },
                                { label: '등락률', value: changeRate === null ? '—' : toPctSigned(changeRate), color: rateColorStyle(changeRate)?.color },
                                { label: '거래대금', value: tradingValue === null ? '—' : toJoEokDecimal(tradingValue / 100), color: undefined },
                              ].map(metric => (
                                <div key={metric.label} className="min-w-0 rounded-sm bg-ui-surface px-1.5 py-1">
                                  <div className="mb-1 text-[10px] font-medium text-ui-muted">{metric.label}</div>
                                  <div className="truncate text-[13px] font-semibold text-ui-text" style={metric.color ? { color: metric.color } : undefined}>{metric.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            <SummaryBadge>최근 5거래일</SummaryBadge>
                            <MarketIndexTrendChart items={trendItems} market={market} label={label} colorScale={colorScale} />
                          </div>
                        </section>
                      )
                    })}
                    <section aria-label="오늘 상위 업종 최근 5거래일 등락률" className="space-y-1 rounded-sm border border-ui-border bg-ui-background px-2 py-1.5">
                      <SummaryBadge>오늘 상위 업종 · 최근 5거래일</SummaryBadge>
                      <SectorTrendChart items={marketSummary?.sectorOverviewTrends ?? []} colorScale={colorScale} />
                    </section>
                    <span className="flex h-6 items-center">
                      <span className="w-full whitespace-nowrap bg-[var(--brand-surface)] px-1 py-[3px] text-ui-white">등락 종목</span>
                    </span>
                    <span className="flex h-6 items-center">
                      <span className="flex h-[22px] min-w-0 flex-1 items-center justify-start gap-2 rounded-sm bg-ui-surface pl-1 pr-3">
                        <span className="min-w-0 flex-1 truncate text-right" style={rateColorStyle(1)}>▲ {toCount(overview.advancers)}</span>
                        <span className="min-w-0 flex-1 truncate text-right" style={rateColorStyle(-1)}>▼ {toCount(overview.decliners)}</span>
                        <span className="min-w-0 flex-1 truncate text-right text-ui-text">■ {toCount(overview.unchanged)}</span>
                      </span>
                    </span>
                    <div className="grid grid-cols-[max-content_minmax(0,1fr)_max-content_minmax(0,1.5fr)] gap-x-1 gap-y-1">
                    {NOTICE_TYPES.map(({ type, label, showItems, badgeClass, countLabel, countKey, valueKey }) => {
                      const items = (notices?.items ?? []).filter(item => item.type === type)
                      const rowClass = 'flex h-6 items-center'
                      return (
                        <Fragment key={type}>
                          {showItems && (
                            <>
                              {/* 네 배지의 너비·좌우 끝은 모두 같다. 들여쓰기는 배지가 아니라 오른쪽 회색 칸의 종목 이름 글자에 한다. */}
                              <span className={rowClass}>
                                <span className={`w-full whitespace-nowrap px-1 py-[3px] ${badgeClass}`}>{label}</span>
                              </span>
                              {/* 그날 안내 종목은 종류 배지 바로 오른쪽 회색 칸에 한 줄로 적는다 — 없으면 글자 없이 빈 칸, 둘 이상이면 이름을 " · "(공백·가운뎃점·공백)로 이어 쓰고 칸보다 길면 …로 줄인다. */}
                              <span className={`${rowClass} col-span-3`}>
                                <span className="flex h-[22px] min-w-0 flex-1 items-center rounded-sm bg-ui-surface pl-[calc(0.25rem+0.34em)] pr-1 text-ui-text">
                                  <span className="min-w-0 truncate" style={{ color: strongIndustryColor }}>{items.map(item => item.stockName).join(' · ')}</span>
                                </span>
                              </span>
                            </>
                          )}
                          {/* 날짜와 무관한 현황 이름표(신규 상장은 "3개월 내 상장", 거래 정지는 "거래 정지 중")는 짝이 되는 종류 배지와 같은 색 배지, 오른쪽 회색 칸에 건수를 적는다. 아직 못 받았으면 "-"를 적는다(0건이면 0). */}
                          <span className={rowClass}>
                            <span className={`w-full whitespace-nowrap px-1 py-[3px] ${badgeClass}`}>{countLabel}</span>
                          </span>
                          <span className={rowClass}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-center rounded-sm bg-ui-surface px-1 text-ui-text">{notices?.[countKey] ?? '-'}</span>
                          </span>
                          {/* 같은 줄 오른쪽에 그 종목들의 현시점 시가총액 합을 "시총 합" 배지(같은 줄 배지와 같은 색)와 회색 칸으로 둔다. 표기는 Custom 페이지와 같은 n,nnn.n조/억이다. */}
                          <span className={`${rowClass} whitespace-nowrap`}>
                            <span className={`px-1 py-[3px] ${badgeClass}`}>시총 합</span>
                          </span>
                          <span className={rowClass}>
                            <span className="flex h-[22px] min-w-0 flex-1 items-center justify-end rounded-sm bg-ui-surface px-1 text-ui-text">
                              {notices?.[valueKey] != null ? toJoEokDecimal(notices[valueKey] / 100_000_000) : ''}
                            </span>
                          </span>
                        </Fragment>
                      )
                    })}
                    </div>
                  </div>
                ),
              },
            ].sort((a, b) => safeHomeFrameOrder.indexOf(a.title) - safeHomeFrameOrder.indexOf(b.title)).map((frame, frameIndex) => (
              <SortableHomeFrame key={frame.title} title={frame.title} captureId={frame.captureId} index={frameIndex} captureUntil={frameIndex === 1 ? '' : undefined} highlightColor={strongIndustryColor}>
                {frame.body}
              </SortableHomeFrame>
            ))}
            </div>
            </SortableContext>
            </DndContext>
            </div>
            </div>
            )}
          </div>
          {/* 아래 줄 — 지도·그룹 페이지와 같은 높이(28px)로 왼쪽에 면책조항, 오른쪽 끝에 등락률 색상 범례를 둔다. 로딩 중에도 제자리에 둔다. */}
          <div data-capture-full-width-align className="flex h-7 shrink-0 items-end justify-between gap-3">
            <div className="flex h-7 min-w-0 items-end">
              <DisclaimerNotice />
            </div>
            <ChangeRateBar swatches={settingsModalProps.legendSwatches} />
          </div>
        </div>
        {/* 설정창 틀만 먼저 둔다 — 항목은 홈 화면 내용이 정해지면 채운다. */}
        <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel
            pageLabel="Home"
            plainTabLabel="시장 요약"
            plainTabIcon="home"
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
      {screenshotTarget && (
        <ScreenshotModal
          onClose={() => setScreenshotTarget(null)}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          isCopying={copyStatus === 'copying'}
          screenshotTarget={screenshotTarget}
          frameCaptureOptions={safeHomeFrameOrder.map((title, selectedSlot) => {
            const captureId = title === '시장 지도' ? 'market-map' : title === '그룹 등락률 (%)' ? 'group-change-rate' : 'market-summary'
            return {
              id: captureId,
              label: ['좌측', '중앙', '우측'][selectedSlot],
              selector: `[data-capture-frame="${captureId}"]`,
              selectedSlot: selectedSlot as 0 | 1 | 2,
              mode: 'content' as const,
            }
          })}
        />
      )}
    </div>
  )
}
