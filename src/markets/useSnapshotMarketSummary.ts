import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import { useSnapshotMarketIndex } from '@/markets/useSnapshotMarketIndex'
import type { OverseasSheet } from '@/hooks/useOverseasSheet'
import type { OverseasSummarySource } from '@/hooks/overseasSummarySource'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useListedStocks, useMarketPeriodQuotes, useMarketQuotes, useMarketSnapshotTimes, type MarketQuoteSnapshot } from '@/markets/useMarketQuotes'
import { buildJapanTree } from '@/utils/japanMap'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'
import { overseasSettingKey } from '@/utils/overseasSettingKey'

// 스냅샷 목록으로 시세를 주는 시장의 SUMMARY 데이터. 시장마다 다른 값은 SNAPSHOT_MARKETS에서만 온다.
export function useSnapshotMarketSummary(market: OverseasMarket, sheet: OverseasSheet): OverseasSummarySource {
  const { currencyUnit, settingPrefix, fixed, bundledStocks, intradayDelta, session, refreshHelp } = SNAPSHOT_MARKETS[market]
  const { routeSegment, badgeLabel } = overseasMarketInfo(market)
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { categories, classifications } = useOverseasClassificationData(market, sheet)
  const names = useQuery({ queryKey: [routeSegment, 'names'], queryFn: async () => (await client.get<Record<string, string>>(`/${routeSegment}/stock-names`)).data })
  const listed = useListedStocks(market, bundledStocks === null)
  // 이름표에 없는 종목은 번들 목록이면 그 이름, 서버 목록이면 티커로 보인다.
  const stocks = useMemo(() => bundledStocks ?? listed.data?.map(stock => ({ code: stock.symbol, name: stock.symbol })), [bundledStocks, listed.data])
  // 날짜·기간은 지도·그래프와 같은 저장소를 쓴다(다른 화면에서 고른 기간이 이어진다).
  const times = useMarketSnapshotTimes(market)
  const { selectedTime, rangeStart, isResolving, select, selectRange } = useCrossMarketPeriod(market, times.data)
  const quotes = useMarketQuotes(market, selectedTime)
  const liveQuotes = useMarketQuotes(market, null)
  const periodQuotes = useMarketPeriodQuotes(market, rangeStart, selectedTime)
  // 기간이면 기간 등락률 시세를, 아니면 고른 날짜(없으면 최신)의 시세를 쓴다.
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const liveSnapshotTime = liveQuotes.data?.snapshotTime ?? null
  const treeOf = useCallback((snapshot: MarketQuoteSnapshot | undefined) => {
    if (!categories.data || !classifications.data || !snapshot?.snapshotTime || !stocks || !names.data) return []
    return buildJapanTree(stocks, categories.data, classifications.data, names.data, snapshot.quotes, snapshot.snapshotTime)
  }, [categories.data, classifications.data, names.data, stocks])
  const tree = useMemo(() => treeOf(shownQuotes), [treeOf, shownQuotes])
  const index = useSnapshotMarketIndex(market, snapshotTime, liveSnapshotTime, rangeStart)
  const required = [quotes, categories, classifications, names, ...(bundledStocks === null ? [listed] : [])]
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
    isLoading: isResolving || required.some(query => query.isLoading) || periodQuotes.isLoading,
    isError: required.some(query => query.isError) || times.isError || periodQuotes.isError,
    isIndexLoading: index.isLoading,
    isIndexFetching: index.isFetching,
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || index.isFetching,
    graphIndexItems: index.graphIndexItems,
    indexBars: index.indexBars,
    refetchAll: () => Promise.all([...required.map(query => query.refetch()), times.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])]),
    sessionChip: snapshotTime ? session(snapshotTime) : null,
    refreshHelp: refreshHelp(snapshotTime),
    fixed,
    intradayDelta,
    tabStorageName: 'Home',
    settingPrefix: overseasSettingKey(settingPrefix, sheet),
    currencyUnit,
    totalCount: stocks?.length ?? 0,
  }
}
