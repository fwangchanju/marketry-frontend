import { useMemo } from 'react'
import type { MarketScreenData } from '@/markets/marketContract'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useMarketIndexCloses, useMarketIndexQuotes } from '@/markets/useMarketQuotes'
import { graphIndexValue, indexChangeRate, indexRange, intradayRateAt, shiftDate } from '@/utils/indexChange'
import type { OverseasMarket } from '@/utils/markets'

const INDEX_LOOKBACK_DAYS = 14

// 지수 막대 — SUMMARY와 그룹 등락률 미리보기가 함께 쓴다. 그래프 화면과 같은 조회 이름을 써서 같은 값을 공유한다.
export function useSnapshotMarketIndex(market: OverseasMarket, snapshotTime: string | null, liveSnapshotTime: string | null, rangeStart: string | null) {
  const { key, name, hasIntraday } = SNAPSHOT_MARKETS[market].index
  const day = snapshotTime?.slice(0, 10) ?? null
  const span = hasIntraday ? indexRange(rangeStart, snapshotTime, liveSnapshotTime) : day === null ? null : { startDate: rangeStart?.slice(0, 10) ?? day, endDate: day }
  const closes = useMarketIndexCloses(market, span ? shiftDate(span.startDate, -INDEX_LOOKBACK_DAYS) : null, span?.endDate ?? null)
  const intraday = useMarketIndexQuotes(market, hasIntraday && rangeStart === null ? day : null)
  const value = graphIndexValue({
    showDelta: false,
    nowRate: hasIntraday && rangeStart === null ? intradayRateAt(intraday.data, snapshotTime) : null,
    beforeRate: null,
    dailyRate: span && closes.data ? indexChangeRate(closes.data, span.startDate, span.endDate) : null,
  })
  // 값이 없어도 막대 자리를 이유와 함께 넘긴다(빠뜨린 것과 정말 없는 것을 구분한다).
  const indexBars = useMemo<MarketScreenData['indexBars']>(
    () => [value === null ? { key, name, value: null, reason: '이 날짜의 지수 값이 없습니다.' } : { key, name, value }],
    [key, name, value],
  )
  return {
    graphIndexItems: value === null ? [] : [{ key, name, value }],
    indexBars,
    isLoading: closes.isLoading || intraday.isLoading,
    isFetching: closes.isFetching || intraday.isFetching,
  }
}
