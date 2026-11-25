import SummaryScreen from '@/components/SummaryScreen'
import type { MarketIndexBar, MarketScreenData } from '@/markets/marketContract'
import { SECTOR_KOREA } from '@/utils/customRoutes'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsPanelGroup, SettingsMarketValueSection, SettingsExcludeSection, SettingsColorSection, SettingsStrongIndustryColorSection } from '@/components/SettingsPanel'
import { getMarketIndexHistory } from '@/api/marketSummary'
import NxtOnlyNotice from '@/components/NxtOnlyNotice'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { collectItems } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredHeatmap'
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

// 한국 SUMMARY의 데이터와 한국에만 있는 기능(코스피·코스닥, 애프터 마켓, 시간대 필터, 거래소 분류)을 공통 화면에 넘긴다.
export default function KoreaSummary() {
  // 시장 배지 드롭다운 — 서머리의 시장(KOREA·JAPAN·USA, 배지에는 K-STOCK·NIKKEI 225·S&P 500)은 주소의 market 값으로 정한다. 일본·미국은 특별 회원·관리자에게만 보인다.
  const location = useLocation()
  const canSeeOverseasSummary = true
  const summaryMarket: MarketQuery = location.pathname.startsWith('/summary/korea/kospi') ? 'KOSPI' : location.pathname.startsWith('/summary/korea/kosdaq') ? 'KOSDAQ' : 'ALL_STOCK'
  const summaryMarketLabel = summaryMarket === 'KOSPI' ? 'KOSPI' : summaryMarket === 'KOSDAQ' ? 'KOSDAQ' : 'K-STOCK'
  // 지도·그래프와 같은 목록(KOREA 아래 KOSPI·KOSDAQ, 특별 회원·관리자에게만 JAPAN·USA).
  const summaryMenu = marketMenu('/summary', summaryMarket, canSeeOverseasSummary)
  const navigate = useNavigate()
  const {
    settingsModalProps, data, rootNodes, isLoading: isBaseLoading, isError, refetchHeatmap, isRefetchingHeatmap, pinnedSnapshotTime, rangeStartTime, rangeExcludedStocks,
    changeRateMode, changeRateChoice, colorScale, strongIndustryColor, onChangeStrongIndustryColor, colorEditorPanelProps, excludedSectorIds, excludedMarketValueTiers,
    market, nxtOnly, nxtOnlyWindow, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange,
    isAfterHoursControlsVisible, isAfterHoursSelectable, onChangeChangeRateMode,
  } = useGlobalSettings({ allowChangeRateMode: true })
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
  const handleSelectIndex = (indexMarket: 'KOSPI' | 'KOSDAQ') => navigate(marketRoute('/map', indexMarket))
  // 코스피·코스닥 서머리에는 그 시장의 지수 막대만 넣는다(그래프 화면과 같다). 전체 서머리에는 둘 다 넣는다.
  const indexBars = useMemo(() => {
    const barOf = (indexMarket: 'KOSPI' | 'KOSDAQ', name: string): MarketIndexBar => {
      const key = `market-index:${indexMarket}`
      const historicalIndex = pinnedSnapshotTime !== undefined
        ? (historicalIndexData ?? []).filter(candidate => candidate.market === indexMarket).sort((a, b) => a.date.localeCompare(b.date)).at(-1)
        : undefined
      const value = pinnedSnapshotTime !== undefined
        ? historicalIndex?.overview.changeRate
        : isLatestDailyView
          ? marketSummary?.marketOverviews.items.find(candidate => candidate.market === indexMarket)?.changeRate
          : undefined
      return value === undefined ? { key, name, value: null, reason: '이 보기의 지수 값이 없습니다.' } : { key, name, value }
    }
    const kospi = barOf('KOSPI', '코스피')
    const kosdaq = barOf('KOSDAQ', '코스닥')
    return (market === 'KOSPI' ? [kospi] : market === 'KOSDAQ' ? [kosdaq] : [kospi, kosdaq]) as MarketScreenData['indexBars']
  }, [marketSummary, historicalIndexData, pinnedSnapshotTime, isLatestDailyView, market])
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
  const marketData: MarketScreenData = {
    id: 'KOREA',
    label: summaryMarketLabel,
    currencyUnit: '원',
    tree: rootNodes,
    indexBars,
    state: isLoading ? { status: 'loading' } : isError ? { status: 'error', retry: refetchHeatmap } : { status: 'ready' },
    refresh: { run: refetchHeatmap, isRunning: isRefetchingHeatmap, help: SNAPSHOT_REFRESH_HELP },
    session: <span className="flex shrink-0"><ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} /></span>,
    period: {
      snapshotTime: data?.snapshotTime ?? null,
      liveSnapshotTime,
      isPast: isPastSnapshot,
      rangeStart: isPastSnapshot && pinnedSnapshotTime ? rangeStartTime ?? null : null,
      excludedStocks: rangeExcludedStocks,
      clear: () => onChangePinnedSnapshotTime(null),
      picker: (
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
      ),
    },
    isMineEmpty: settingsModalProps.taxonomy === 'MINE' && rootNodes.every(node => collectItems(node).length === 0),
    mineSetupPath: SECTOR_KOREA,
    features: {
      subMarkets: [{ id: 'KOSPI', label: '코스피' }, { id: 'KOSDAQ', label: '코스닥' }],
      afterHours: true,
      timeWindowNotice: <NxtOnlyNotice active={nxtOnly && nxtOnlyWindow !== null && !isPastSnapshot && rangeStartTime === undefined} window={nxtOnlyWindow} ready={!isLoading && !isError && Boolean(data?.snapshotTime)} nodes={rootNodes} />,
      exchangeTaxonomy: true,
      intradayDelta: true,
    },
  }
  return (
    <SummaryScreen
      market={marketData}
      menu={summaryMenu}
      taxonomy={settingsModalProps.taxonomy}
      filters={{ excludedSectorIds, excludedMarketValueTiers }}
      colors={{ colorScale, strongIndustryColor, legendSwatches: settingsModalProps.legendSwatches }}
      mapPath={marketRoute('/map', market)}
      onSelectIndex={handleSelectIndex}
      settings={controls => (
        <SettingsPanel pageLabel="Summary" tabStorageName="Home" {...settingsModalProps} {...controls} stockCountLabel={stockCountLabel} taxonomyAtBottom snapshotTime={data?.taxonomyUpdatedAt}>
          <SettingsPanelGroup section="composition">
            <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
            <SettingsExcludeSection {...settingsModalProps} />
          </SettingsPanelGroup>
          <SettingsPanelGroup section="colors">
            <SettingsColorSection {...settingsModalProps} colorEditorProps={colorEditorPanelProps} fixed={settingsModalProps.taxonomy !== 'MINE'} />
            <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} fixed={settingsModalProps.taxonomy !== 'MINE'} />
          </SettingsPanelGroup>
        </SettingsPanel>
      )}
    />
  )
}
