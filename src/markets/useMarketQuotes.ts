import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'
import type { IndexClose, IntradayIndexQuote } from '@/utils/indexChange'
import { calculatePeriodDetailed, type PeriodExcludedStock } from '@/utils/snapshotPeriod'
import { INFREQUENT_DATA_CACHE, MARKET_DATA_CACHE } from '@/hooks/cacheConfig'

// 스냅샷 목록으로 시세를 주는 시장의 조회. 시장마다 다른 것은 주소 조각뿐이다. 시세가 어느 출처에서 왔는지는 서버만 안다.
export type MarketQuote = { stockCode: string; currentPrice: number; lastPrice: number; changeRate: number; totalMarketValue: number; closeVerified?: boolean | null }
export type MarketQuoteSnapshot = { snapshotTime: string | null; quotes: MarketQuote[] }
export type ListedStock = { symbol: string; name: string }

const segmentOf = (market: SnapshotMarket) => snapshotMarketInfo(market).routeSegment

// 시각을 주지 않으면 서버에 저장된 가장 최근 시세를 받는다.
export function useMarketQuotes(market: SnapshotMarket, snapshotTime: string | null = null, enabled = true) {
  const segment = segmentOf(market)
  return useQuery({
    enabled,
    queryKey: [segment, 'quotes', snapshotTime],
    queryFn: async () => (await client.get<MarketQuoteSnapshot>(`/${segment}/quotes`, { params: snapshotTime ? { snapshotTime } : undefined })).data,
    // 최신 시세는 장중에 5분마다 새로 저장되므로 1분마다 다시 받는다(2026-11-27, 일본·미국 공통). 지난 시각의 시세는 바뀌지 않아 그대로 둔다.
    ...(snapshotTime === null ? MARKET_DATA_CACHE : {}),
  })
}

export function useMarketSnapshotTimes(market: SnapshotMarket, enabled = true) {
  const segment = segmentOf(market)
  return useQuery({
    queryKey: [segment, 'quotes', 'snapshots'],
    enabled,
    queryFn: async () => (await client.get<string[]>(`/${segment}/quotes/snapshots`)).data,
    // 새 5분 시세가 쌓이면 달력·종가 줄 목록에도 따라온다.
    ...INFREQUENT_DATA_CACHE,
  })
}

export function useMarketPreviousTradingDay(market: SnapshotMarket, date: string | null, enabled = true) {
  const segment = segmentOf(market)
  return useQuery({
    queryKey: [segment, 'quotes', 'previous-trading-day', date],
    enabled: enabled && date !== null,
    queryFn: async () => (await client.get<string>(`/${segment}/quotes/previous-trading-day`, { params: { date } })).data,
  })
}

// 종목 목록을 서버에서 받는 시장의 종목(티커와 이름).
export function useListedStocks(market: SnapshotMarket, enabled = true) {
  const segment = segmentOf(market)
  return useQuery({
    queryKey: [segment, 'stocks'],
    enabled,
    queryFn: async () => (await client.get<ListedStock[]>(`/${segment}/stocks`)).data,
    // 종목 목록은 하루에 한 번 정도만 바뀌어 페이지를 옮길 때마다 다시 받지 않는다(2026-11-27).
    ...INFREQUENT_DATA_CACHE,
  })
}

// 지수의 날짜별 종가. 값이 없는 날짜는 응답에 빠진다.
export function useMarketIndexCloses(market: SnapshotMarket, from: string | null, to: string | null) {
  const segment = segmentOf(market)
  return useQuery({
    enabled: from !== null && to !== null,
    queryKey: [segment, 'index-closes', from, to],
    queryFn: async () => (await client.get<IndexClose[]>(`/${segment}/index-closes`, { params: { from, to } })).data,
    ...INFREQUENT_DATA_CACHE,
  })
}

// 기간 시작일의 전일 종가와 종료일 시세가 모두 있는 종목만 계산한다.
export function useMarketPeriodQuotes(market: SnapshotMarket, startTime: string | null, endTime: string | null) {
  const start = useMarketQuotes(market, startTime, startTime !== null)
  const end = useMarketQuotes(market, endTime, startTime !== null && endTime !== null)
  const detailed = startTime !== null && end.data && start.data ? calculatePeriodDetailed(start.data.quotes, end.data.quotes) : undefined
  const data = detailed && end.data ? { ...end.data, quotes: detailed.quotes } : undefined
  // 기준가가 없어 뺀 종목(신규 상장 등) — 기간 보기 배지에 쓴다.
  const excluded: PeriodExcludedStock[] = detailed?.excluded ?? []
  return { data, excluded, isLoading: startTime !== null && (start.isLoading || end.isLoading), isError: startTime !== null && (start.isError || end.isError), refetch: () => Promise.all([start.refetch(), end.refetch()]) }
}

// 지수의 그날 장중 등락률(5분 단위). 장중 값을 저장하는 시장만 켠다.
// 값이 없거나 조회가 실패하면 data가 비어 있고, 종가 기준 막대로만 그린다.
export function useMarketIndexQuotes(market: SnapshotMarket, date: string | null) {
  const segment = segmentOf(market)
  return useQuery({
    enabled: date !== null,
    queryKey: [segment, 'index-quotes', date],
    queryFn: async () => (await client.get<IntradayIndexQuote[]>(`/${segment}/index-quotes`, { params: { date } })).data,
    // 장중 지수는 5분마다 새로 저장되므로 최신 시세와 같이 1분마다 확인한다.
    ...MARKET_DATA_CACHE,
  })
}
