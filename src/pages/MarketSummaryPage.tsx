import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import { ClockIcon } from '@/components/icons/AppIcons'
import SettingsPanel, { SettingsGroupDepthSection } from '@/components/SettingsPanel'
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
import type { MarketOverviewTrendItem, TreemapSectorNode } from '@/types/api'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { useSession } from '@/hooks/useSession'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toCount, toJoEokDecimal, toSnapshotDateLabel, toPctSigned } from '@/utils/format'
import { buildRankChart } from '@/utils/rankChart'
import type { MarketValueExclusions } from '@/utils/marketValueTier'
import { resolveTreemapColor, resolveTreemapExtremeColor, type ColorScaleConfig } from '@/utils/treemapColorScale'
import { collectItems, computeSectorAverage } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredTreemap'
import { collectAtDepth } from '@/utils/sectorDepth'
import { withStableSectorIds } from '@/utils/guestSectorIds'
import { getSnapshotDays, getTreemap } from '@/api/treemap'

// 홈 시장 요약 배치
type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'

// 시장 요약의 항목 배지는 툴바의 "분류" 칸과 같은 짙은 청록 배경(--brand-surface)·흰 글자을 쓴다. 지수는 오르면 빨강·내리면 파랑, 변화가 없거나 값이 없으면 회색이다.
const INDEX_ROWS = [
  { label: '코스피', market: 'KOSPI' },
  { label: '코스닥', market: 'KOSDAQ' },
] as const


const toIndexValue = (value: number): string => value.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 넉넉한 화면에서는 확정한 날짜 위치를 유지하고, 작은 화면에서는 하단 60px을 확보한다.
// 막대는 그래프 반쪽 높이에서 값 라벨 공간(20px)을 뺀 범위 안에 그린다.
function MarketIndexTrendChart({ items, market, label, colorScale }: { items: MarketOverviewTrendItem[]; market: 'KOSPI' | 'KOSDAQ'; label: string; colorScale: ColorScaleConfig }) {
  const dateLabels = (date: string) => {
    const value = new Date(`${date}T00:00:00Z`)
    return { date: `${value.getUTCMonth() + 1}/${value.getUTCDate()}`, weekday: ['일', '월', '화', '수', '목', '금', '토'][value.getUTCDay()] }
  }
  const values = items.filter(item => item.market === market).sort((a, b) => a.date.localeCompare(b.date)).slice(-5)
  const scale = Math.max(3, ...values.map(item => Math.abs(item.changeRate)))
  if (!values.length) return null
  return (
    <div role="img" aria-label={`${label} 최근 ${values.length}거래일 등락률 그래프`} className="relative grid h-full w-full grid-cols-5 gap-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#808080]" />
      {values.map(item => {
        const ratio = Math.min(Math.abs(item.changeRate) / scale, 1)
        const height = `max(2px, min(${ratio * 55}px, calc((50% - 20px) * ${ratio})))`
        const barColor = item.changeRate === 0 ? 'var(--ui-muted)' : resolveTreemapExtremeColor(item.changeRate, colorScale)
        return (
          <div key={`${item.date}-${item.market}`} className="relative min-w-0 text-center">
            <div className="relative mx-auto h-full w-full max-w-32">
              <i className={`absolute left-1/2 w-1/4 -translate-x-1/2 ${item.changeRate >= 0 ? 'bottom-1/2 rounded-t-sm' : 'top-1/2 rounded-b-sm'}`} style={{ height, backgroundColor: barColor }} />
              <div className="absolute inset-x-0 z-[1] whitespace-nowrap text-[12px] font-semibold tabular-nums" style={{ top: item.changeRate >= 0 ? `calc(50% - ${height} - 19px)` : `calc(50% + ${height} + 1px)`, color: barColor }}>{item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(2)}</div>
            </div>
            <div className="absolute inset-x-0 top-[calc(100%+24px)] text-ui-muted">
              <div className="whitespace-nowrap text-[12px] leading-tight tabular-nums">{dateLabels(item.date).date}</div>
              <div className="whitespace-nowrap text-[11px] leading-tight">({dateLabels(item.date).weekday})</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

type PersonalSectorPoint = { date: string; changeRate: number }
type PersonalSectorTrend = { sectorName: string; points: PersonalSectorPoint[] } | null

function PersonalSectorTrendChart({ trend, colorScale }: { trend: PersonalSectorTrend | undefined; colorScale: ColorScaleConfig }) {
  const points = trend?.points ?? []
  if (!points.length) return null
  const scale = Math.max(3, ...points.map(point => Math.abs(point.changeRate)))
  return (
    <div className="h-full min-w-0 w-full">
      <div role="img" aria-label={`${trend?.sectorName ?? '최상위 업종'} 최근 ${points.length}거래일 등락률 막대그래프`} className="relative grid h-full grid-cols-5 gap-2">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[#808080]" />
        {points.map(point => {
          const date = new Date(`${point.date}T00:00:00Z`)
          const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]
          const ratio = Math.min(Math.abs(point.changeRate) / scale, 1)
          const height = `max(2px, min(${ratio * 55}px, calc((50% - 20px) * ${ratio})))`
          const barColor = resolveTreemapExtremeColor(point.changeRate, colorScale)
          return (
            <div key={point.date} className="relative min-w-0 text-center">
              <div className="relative mx-auto h-full w-full max-w-32">
                <i className={`absolute left-1/2 w-1/4 -translate-x-1/2 ${point.changeRate >= 0 ? 'bottom-1/2 rounded-t-sm' : 'top-1/2 rounded-b-sm'}`} style={{ height, backgroundColor: barColor }} />
                <div className="absolute inset-x-0 z-[1] whitespace-nowrap text-[12px] font-semibold tabular-nums" style={{ top: point.changeRate >= 0 ? `calc(50% - ${height} - 19px)` : `calc(50% + ${height} + 1px)`, color: barColor }}>{point.changeRate > 0 ? '+' : ''}{point.changeRate.toFixed(2)}</div>
              </div>
              <div className="absolute inset-x-0 top-[calc(100%+17.25px)] text-ui-muted">
                <div className="whitespace-nowrap text-[12px] leading-tight tabular-nums">{date.getUTCMonth() + 1}/{date.getUTCDate()}</div>
                <div className="whitespace-nowrap text-[11px] leading-tight">({weekday})</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SummaryBadge({ children }: { children: ReactNode }) {
  return <span className="inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap rounded-sm bg-[var(--brand-surface)] px-2 text-[14px] font-semibold leading-none text-ui-white">{children}</span>
}

const HOME_FRAME_ORDER_KEY = 'marketry-home-frame-order'
const DEFAULT_HOME_FRAME_ORDER = ['시장 요약', '시장 지도', '그룹 등락률 (%)']

function SortableHomeFrame({ title, captureId, index, children, captureUntil, showHeader = true, insetHeader = false }: { title: string; captureId: string; index: number; children: ReactNode; captureUntil?: string; showHeader?: boolean; insetHeader?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: title })
  const header = (
    <div className="relative z-[6] flex h-5 min-h-5 shrink-0 items-center">
      <SummaryBadge>{title}</SummaryBadge>
    </div>
  )
  return (
    <section
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`${title}, 끌어서 위치 이동`}
      data-hint="끌어서 항목 순서 변경"
      data-capture-until={captureUntil}
      style={{ order: index, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.6 : undefined }}
      className={`home-summary-frame relative flex h-full min-w-[320px] flex-col bg-ui-background cursor-grab active:cursor-grabbing ${index === 1 ? 'flex-1' : 'flex-none basis-[calc(100%/3_-_4px)]'} ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      <div data-capture-frame={captureId} className={`flex min-h-0 flex-1 flex-col bg-ui-background ${index === 0 ? 'pl-0 pr-1' : index === 2 ? 'pl-1 pr-0' : 'px-1'}`}>
        {insetHeader ? (
          <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-ui-border bg-ui-background px-2 py-1.5">
            {header}
            <div className="mt-1 flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        ) : <>{showHeader && header}{children}</>}
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
    settingsModalProps, data, rootNodes, isLoading, isError, refetchTreemap, isRefetchingTreemap, pinnedSnapshotTime, rangeStartTime, rangeExcludedStocks,
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
  const { data: session } = useSession()
  const marketTrendDates = [...new Set((marketSummary?.marketOverviewTrends ?? []).map(item => item.date))].sort().slice(-5)
  const personalTrendBasis = changeRateChoice === 'afterHours' ? 'afterHours' : 'daily'
  const marketValueRange = (excludedMarketValueTiers as MarketValueExclusions).marketValueRange
  const trendTaxonomy = settingsModalProps.taxonomy === 'NXT' ? 'KRX' : settingsModalProps.taxonomy
  const personalTrendEndDate = pinnedSnapshotTime?.slice(0, 10) ?? data?.snapshotTime?.slice(0, 10) ?? marketTrendDates.at(-1) ?? null
  const indexEndDate = pinnedSnapshotTime?.slice(0, 10) ?? marketSummary?.marketOverviews.snapshotTime?.slice(0, 10) ?? null
  const { data: historicalIndexData } = useQuery({
    queryKey: ['home-historical-market-index', indexEndDate, changeRateChoice],
    enabled: Boolean(indexEndDate),
    queryFn: async () => {
      const endDate = indexEndDate!
      const endMonth = endDate.slice(0, 7)
      const [year, month] = endMonth.split('-').map(Number)
      const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
      const dayLists = await Promise.all([previousMonth, endMonth].map(value => getSnapshotDays('ALL_STOCK', value)))
      const days = dayLists.flat().filter(day => day.date <= endDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-6)
      const snapshots = await Promise.all(days.flatMap(day => (['KOSPI', 'KOSDAQ'] as const).map(async market => ({
        date: day.date,
        market,
        overview: (await getTreemap(market, 'KRX', day.snapshotTime, false, personalTrendBasis)).marketOverview,
      }))))
      return snapshots
    },
    staleTime: 60_000,
  })
  const { data: personalSectorTrend } = useQuery({
    // 시총 범위는 Set의 원소가 아니라 marketValueRange 속성에 있으므로 금액 경계도 캐시 키에 넣는다.
    queryKey: ['home-personal-sector-trend', session?.userId ?? null, personalTrendEndDate, data?.snapshotTime, pinnedSnapshotTime !== undefined, marketTrendDates, changeRateChoice, settingsModalProps.taxonomy,
      [...excludedSectorIds].sort((a, b) => a - b), [...excludedMarketValueTiers].sort(), marketValueRange?.min ?? null, marketValueRange?.max ?? null],
    enabled: Boolean(personalTrendEndDate && data?.snapshotTime && (settingsModalProps.taxonomy !== 'MINE' || session?.authenticated)),
    queryFn: async (): Promise<PersonalSectorTrend> => {
      const isPinnedDate = pinnedSnapshotTime !== undefined
      let historicalDates = marketTrendDates.filter(date => date < personalTrendEndDate!).slice(-4)
      if (isPinnedDate && personalTrendEndDate) {
        const endMonth = personalTrendEndDate.slice(0, 7)
        const [year, month] = endMonth.split('-').map(Number)
        const previousMonth = new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7)
        const dayLists = await Promise.all([previousMonth, endMonth].map(value => getSnapshotDays('ALL_STOCK', value)))
        historicalDates = dayLists.flat().map(day => day.date).filter(date => date < personalTrendEndDate).sort().slice(-4)
      }
      const months = [...new Set(historicalDates.map(date => date.slice(0, 7)))]
      const snapshotDays = (await Promise.all(months.map(month => getSnapshotDays('ALL_STOCK', month)))).flat()
      const historicalDays = historicalDates.map(date => snapshotDays.find(day => day.date === date)).filter((day): day is NonNullable<typeof day> => Boolean(day))
      const historicalMaps = await Promise.all(historicalDays.map(day => getTreemap('ALL_STOCK', trendTaxonomy, day.snapshotTime, false, personalTrendBasis)))
      const currentMap = data
      const currentDate = currentMap?.snapshotTime?.slice(0, 10) ?? personalTrendEndDate
      const datedMaps = [
        ...historicalMaps.map((map, index) => ({ date: historicalDays[index].date, map })),
        ...(currentMap && currentDate ? [{ date: currentDate, map: currentMap }] : []),
      ].sort((a, b) => a.date.localeCompare(b.date)).slice(-5)
      const trendRoots = (items: TreemapSectorNode[]) =>
        trendTaxonomy === 'KRX' && !session?.authenticated ? withStableSectorIds(items) : items
      const latestRoots = collectAtDepth(rootNodes, 1, excludedSectorIds, excludedMarketValueTiers)
      const top = latestRoots
        .map(({ node }) => ({ node, changeRate: computeSectorAverage(node, excludedMarketValueTiers).weightedAvg }))
        .filter((entry): entry is { node: TreemapSectorNode; changeRate: number } => entry.changeRate !== null)
        .sort((a, b) => b.changeRate - a.changeRate)[0]
      if (!top) return null
      return {
        sectorName: top.node.sectorName,
        points: datedMaps.flatMap(({ date, map }) => {
          const node = collectAtDepth(map === currentMap ? rootNodes : trendRoots(map.items), 1, excludedSectorIds, excludedMarketValueTiers)
            .find(({ node: candidate }) => candidate.sectorId === top.node.sectorId)?.node
          const changeRate = node ? computeSectorAverage(node, excludedMarketValueTiers).weightedAvg : null
          return changeRate === null ? [] : [{ date, changeRate }]
        }),
      }
    },
    staleTime: 60_000,
  })
  // 요약 조회의 지수는 항상 최근 값이다 — 지도가 지난 시각이나 기간을 보고 있거나 시간외 별도 등락률이면 맞지 않으므로 보여 주지 않는다(그룹 페이지도 일간 등락률일 때만 넣는다).
  const isLatestDailyView = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
  const indexOf = (market: 'KOSPI' | 'KOSDAQ') => {
    const historical = pinnedSnapshotTime
      ? historicalIndexData?.find(candidate => candidate.date === pinnedSnapshotTime.slice(0, 10) && candidate.market === market)?.overview
      : undefined
    const item = historical ?? (isLatestDailyView ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === market) : undefined)
    return { indexValue: item?.indexValue ?? null, tradingValue: item?.tradingValue ?? null, changeValue: item?.changeValue ?? null, changeRate: item?.changeRate ?? null }
  }
  const indexTrendItems = pinnedSnapshotTime
    ? (historicalIndexData ?? []).flatMap(({ date, market, overview }) => overview ? [{ date, market, changeRate: overview.changeRate }] : [])
    : marketSummary?.marketOverviewTrends ?? []

  // 홈은 업종 분류 단계를 대분류로 잠가 둔다 — 단계를 내리면 상위 업종에 직접 붙은 종목이 막대에서 빠져 종목 수·평균이 달라지기 때문이다(docs/history.md).
  const effectiveDepth = 1
  // 고른 단계의 업종만 모아 지도 박스와 그래프 막대로 쓴다 — 지도 페이지와 같은 제외 기준을 따른다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(rootNodes, effectiveDepth, excludedSectorIds, excludedMarketValueTiers)) {
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
    return { items, chart }
  }, [rootNodes, excludedSectorIds, excludedMarketValueTiers, effectiveDepth, marketSummary, isLatestDailyView])
  // 설정창 위쪽 "nn/nn종목" — 그룹 페이지와 같은 기준이다. 분모는 지금 시장의 모든 종목, 분자는 제외한 업종(하위 업종까지)·시가총액 구간을 뺀 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = rootNodes
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0)
    const included = filterTreeByExclusions(nodes, excludedSectorIds, excludedMarketValueTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return `${toCount(included)}/${toCount(total)}종목`
  }, [rootNodes, excludedSectorIds, excludedMarketValueTiers])
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
                  <OverviewMap items={overview.items} colorScale={colorScale} />
                ),
              },
              {
                title: '그룹 등락률 (%)',
                captureId: 'group-change-rate',
                body: (
                  <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} />
                ),
              },
              {
                // 거래정지로 지도에서 빠지기 시작한 종목, 신규 상장 종목을 그날 하루만 종류별 칸(신규 상장·거래 정지)에 보여 준다. 없는 종류는 배지 옆에 "없음"을 적는다.
                title: '시장 요약',
                captureId: 'market-summary',
                body: (
                  <div className="grid h-full min-h-0 w-full flex-1 grid-rows-[repeat(3,minmax(0,1fr))] gap-2 overflow-y-auto text-[14px] font-medium leading-none tabular-nums">
                    {INDEX_ROWS.map(({ label, market }) => {
                      const { indexValue, tradingValue, changeRate } = indexOf(market)
                      const trendItems = indexTrendItems
                      return (
                        <section key={market} aria-label={`${label} 시장 요약과 최근 5거래일 추이`} className="relative flex min-h-0 flex-col rounded-sm border border-ui-border bg-ui-background px-2 py-1.5">
                          <div className="grid h-[26px] shrink-0 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                            <SummaryBadge>{label}</SummaryBadge>
                            <div className="grid min-w-0 grid-cols-3 gap-1">
                              {[
                                { label: '지수', value: indexValue === null ? '' : toIndexValue(indexValue), color: undefined },
                                { label: '등락률', value: changeRate === null ? '' : toPctSigned(changeRate), color: rateColorStyle(changeRate)?.color },
                                { label: '거래대금', value: tradingValue === null ? '' : toJoEokDecimal(tradingValue / 100), color: undefined },
                              ].map(metric => (
                                <div key={metric.label} aria-label={metric.label} className="min-w-0 px-1.5 py-1 text-right">
                                  <div className="truncate text-[14px] font-semibold leading-tight text-ui-text" style={metric.color ? { color: metric.color } : undefined}>{metric.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="absolute inset-x-2 top-[37px] bottom-[max(60px,calc(50%-58.375px))]">
                            <MarketIndexTrendChart items={trendItems} market={market} label={label} colorScale={colorScale} />
                          </div>
                        </section>
                      )
                    })}
                    <section aria-label="내 분류 최상위 업종 최근 5거래일 등락률" className="relative flex min-h-0 flex-col rounded-sm border border-ui-border bg-ui-background px-2 py-1.5">
                      <div className="grid h-[26px] shrink-0 min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                        <SummaryBadge>최상위 업종</SummaryBadge>
                        <div className="grid min-w-0 grid-cols-3 gap-1">
                          <span className="min-w-0 truncate px-1.5 py-1 text-right text-[14px] font-semibold leading-tight text-ui-text">{personalSectorTrend?.sectorName ?? ''}</span>
                        </div>
                      </div>
                      <div className="absolute inset-x-2 top-[37px] bottom-[max(60px,calc(50%-58.375px))]">
                        <PersonalSectorTrendChart trend={personalSectorTrend} colorScale={colorScale} />
                      </div>
                    </section>
                  </div>
                ),
              },
            ].sort((a, b) => safeHomeFrameOrder.indexOf(a.title) - safeHomeFrameOrder.indexOf(b.title)).map((frame, frameIndex) => (
              <SortableHomeFrame key={frame.title} title={frame.title} captureId={frame.captureId} index={frameIndex} captureUntil={frameIndex === 1 ? '' : undefined} showHeader={frame.title !== '시장 요약'} insetHeader={frame.title !== '시장 요약'}>
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
