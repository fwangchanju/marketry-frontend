import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useSnapshotClassificationData } from '@/markets/useSnapshotClassificationData'
import { useSnapshotMarketIndex } from '@/markets/useSnapshotMarketIndex'
import type { SnapshotSheet } from '@/markets/useSnapshotSheet'
import type { SnapshotSource } from '@/markets/snapshotSource'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useMarketStocks } from '@/markets/useMarketStocks'
import { useMarketPeriodQuotes, useMarketPreviousTradingDay, useMarketQuotes, useMarketSnapshotTimes, type MarketQuoteSnapshot } from '@/markets/useMarketQuotes'
import { buildSnapshotTree, excludePreviousCloseQuotes, findCloseSnapshotTime, staleQuoteQueryState, shouldFilterStaleQuotes } from '@/utils/snapshotTree'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'
import { snapshotSettingKey } from '@/utils/snapshotSettingKey'

// 스냅샷 목록으로 시세를 주는 시장의 SUMMARY 데이터. 시장마다 다른 값은 SNAPSHOT_MARKETS에서만 온다.
export function useSnapshotMarketSummary(market: SnapshotMarket, sheet: SnapshotSheet, hideStaleQuotes = false): SnapshotSource {
  const { hidesStaleQuotes, currencyUnit, settingPrefix, fixed, intradayDelta, session, refreshHelp } = SNAPSHOT_MARKETS[market]
  const { routeSegment, badgeLabel } = snapshotMarketInfo(market)
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { categories, classifications } = useSnapshotClassificationData(market, sheet)
  const names = useQuery({ queryKey: [routeSegment, 'names'], queryFn: async () => (await client.get<Record<string, string>>(`/${routeSegment}/stock-names`)).data })
  const listed = useMarketStocks(market)
  // 이름표에 없는 종목은 번들 목록이면 그 이름, 서버 목록이면 티커로 보인다.
  const stocks = listed.stocks
  // 날짜·기간은 지도·그래프와 같은 저장소를 쓴다(다른 화면에서 고른 기간이 이어진다).
  const times = useMarketSnapshotTimes(market)
  const { selectedTime, rangeStart, isResolving, select, selectRange } = useCrossMarketPeriod(market, times.data)
  const quotes = useMarketQuotes(market, selectedTime)
  const liveQuotes = useMarketQuotes(market, null)
  const periodQuotes = useMarketPeriodQuotes(market, rangeStart, selectedTime)
  // 기간이면 기간 등락률 시세를, 아니면 고른 날짜(없으면 최신)의 시세를 쓴다.
  const baseQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  // 장 중에 아직 전일 종가 그대로인 종목을 뺀다(그 시장이 쓰고, 화면이 원할 때만).
  const filtersStale = hideStaleQuotes && hidesStaleQuotes && shouldFilterStaleQuotes(snapshotTime, new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }), rangeStart)
  const previousDay = useMarketPreviousTradingDay(market, snapshotTime?.slice(0, 10) ?? null, filtersStale)
  const previousTime = filtersStale && previousDay.data ? findCloseSnapshotTime(times.data ?? [], previousDay.data) : null
  const previousQuotes = useMarketQuotes(market, previousTime, previousTime !== null)
  const shownQuotes = useMemo(() => {
    if (!filtersStale || !baseQuotes || !quotes.data || !previousQuotes.data) return baseQuotes
    const valid = new Set(excludePreviousCloseQuotes(quotes.data.quotes, previousQuotes.data.quotes).map(quote => quote.stockCode))
    return { ...baseQuotes, quotes: baseQuotes.quotes.filter(quote => valid.has(quote.stockCode)) }
  }, [filtersStale, baseQuotes, quotes.data, previousQuotes.data])
  const staleState = staleQuoteQueryState(filtersStale, times.isLoading || previousDay.isLoading, times.isError, previousTime, previousQuotes.isLoading, previousQuotes.isError)
  const liveSnapshotTime = liveQuotes.data?.snapshotTime ?? null
  const treeOf = useCallback((snapshot: MarketQuoteSnapshot | undefined) => {
    if (!categories.data || !classifications.data || !snapshot?.snapshotTime || !stocks || !names.data) return []
    return buildSnapshotTree(stocks, categories.data, classifications.data, names.data, snapshot.quotes, snapshot.snapshotTime)
  }, [categories.data, classifications.data, names.data, stocks])
  const tree = useMemo(() => treeOf(shownQuotes), [treeOf, shownQuotes])
  const index = useSnapshotMarketIndex(market, snapshotTime, liveSnapshotTime, rangeStart, times.data)
  const required = [quotes, categories, classifications, names, listed]
  return {
    market,
    label: badgeLabel,
    tree,
    treeOf,
    snapshotTimes: times.data,
    snapshotTime,
    liveSnapshotTime,
    rangeStart,
    select,
    selectRange,
    rangeExcludedStocks: periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names.data?.[stock.stockCode] ?? stock.stockCode })),
    isLoading: isResolving || required.some(query => query.isLoading) || periodQuotes.isLoading || staleState.isLoading,
    isError: required.some(query => query.isError) || times.isError || periodQuotes.isError || staleState.isError,
    isIndexLoading: index.isLoading || times.isLoading,
    isIndexFetching: index.isFetching,
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || index.isFetching,
    graphIndexItems: index.graphIndexItems,
    indexBars: index.indexBars,
    refetchAll: () => Promise.all([...required.map(query => query.refetch()), times.refetch(), ...(previousTime ? [previousQuotes.refetch()] : []), ...(rangeStart ? [periodQuotes.refetch()] : [])]),
    sessionChip: snapshotTime ? session(snapshotTime) : null,
    refreshHelp: refreshHelp(snapshotTime),
    fixed,
    intradayDelta,
    tabStorageName: 'Home',
    settingPrefix: snapshotSettingKey(settingPrefix, sheet),
    currencyUnit,
    totalCount: stocks?.length ?? 0,
  }
}
