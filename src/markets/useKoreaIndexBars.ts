import { closeChangeRate } from '@/utils/indexChange'
import type { MarketIndexBar, MarketScreenData } from '@/markets/marketContract'
import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getMarketIndexHistory } from '@/api/marketSummary'
import { useKoreaSettings } from '@/markets/useKoreaSettings'
import { useMarketSummary } from '@/hooks/useMarketSummary'
import { usePreviousTradingDay } from '@/hooks/useHeatmap'
import { trendMonths } from '@/utils/trendDates'

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

// 한국 지수 막대(코스피·코스닥) — SUMMARY와 MOBILE이 함께 쓴다. 최신 하루는 요약 값, 지난 날짜·기간은 날짜별 지수로 구한다.
export function useKoreaIndexBars({ market, pinnedSnapshotTime, rangeStartTime, changeRateMode, changeRateChoice }: Pick<ReturnType<typeof useKoreaSettings>, 'market' | 'pinnedSnapshotTime' | 'rangeStartTime' | 'changeRateMode' | 'changeRateChoice'>, enabled = true) {
  // 지도 위 한 줄에 넣을 코스피·코스닥 지수 등락률 — 지도 조회(ALL STOCK)에는 지수가 없어 요약 조회에서 받는다.
  const { data: marketSummary, isLoading: isMarketSummaryLoading, isFetching: isMarketSummaryFetching } = useMarketSummary(enabled)
  const queryClient = useQueryClient()
  const rangePreviousDay = usePreviousTradingDay(market, rangeStartTime?.slice(0, 10) ?? null, { enabled: rangeStartTime !== undefined })
  const indexEndDate = pinnedSnapshotTime?.slice(0, 10) ?? marketSummary?.marketOverviews.snapshotTime?.slice(0, 10) ?? null
  const { data: historicalIndexData, isLoading: isHistoricalIndexLoading, isFetching: isHistoricalIndexFetching } = useQuery({
    queryKey: ['home-historical-market-index', indexEndDate, rangeStartTime, rangePreviousDay?.snapshotTime, changeRateChoice],
    enabled: Boolean(enabled && indexEndDate && pinnedSnapshotTime !== undefined && (!rangeStartTime || rangePreviousDay !== undefined)),
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
        const changeRate = closeChangeRate(baseValue, overview.indexValue)
        if (changeRate === null) return []
        const changeValue = overview.indexValue - baseValue
        return [{ date, market: overview.market, overview: { ...overview, changeValue, changeRate } }]
      })
    },
    staleTime: 60_000,
  })
  // 실시간 요약 지수는 최신 일간 보기에서만 쓴다. 과거 날짜·기간 보기에는 조회한 해당 날짜/기간의 지수 추이를 쓴다.
  const isLatestDailyView = pinnedSnapshotTime === undefined && rangeStartTime === undefined && changeRateMode === 'daily' && changeRateChoice === 'daily'
  // 코스피·코스닥 서머리에는 그 시장의 지수 막대만 넣는다(그래프 화면과 같다). 전체 서머리에는 둘 다 넣는다.
  const indexBars = useMemo(() => {
    const barOf = (indexMarket: 'KOSPI' | 'KOSDAQ', name: string): MarketIndexBar => {
      const key = `market-index:${indexMarket}`
      // 그날의 지수가 없으면 더 앞 날짜 값으로 대신하지 않는다.
      const historicalIndex = pinnedSnapshotTime !== undefined
        ? historicalIndexData?.find(candidate => candidate.market === indexMarket && candidate.date === indexEndDate)
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
  }, [marketSummary, historicalIndexData, indexEndDate, pinnedSnapshotTime, isLatestDailyView, market])
  return {
    indexBars,
    isLoading: (isLatestDailyView && isMarketSummaryLoading) || (pinnedSnapshotTime !== undefined && isHistoricalIndexLoading),
    isFetching: (isLatestDailyView && isMarketSummaryFetching) || (pinnedSnapshotTime !== undefined && isHistoricalIndexFetching),
  }
}
