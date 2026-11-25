import MarketSessionChip from '@/components/MarketSessionChip'
import { useMarketPeriodQuotes, useMarketPreviousTradingDay, useMarketQuotes, useMarketSnapshotTimes } from '@/markets/useMarketQuotes'
import { useMemo } from 'react'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import stocks from '@/data/japanStocks.json'
import type { OverseasMapSource } from '@/hooks/overseasMapSource'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { flattenAllItems } from '@/hooks/useFilteredHeatmap'
import { useJapanMapPreferences } from '@/hooks/useJapanMapPreferences'
import { useOverseasPreviewIndex } from '@/hooks/useOverseasPreviewIndex'
import { JAPAN_MAP_DRAFT_KEY_MAP, JAPAN_MAP_FIXED, JAPAN_MAP_SETTING_PREFIX, JAPAN_REFRESH_HELP, JAPAN_SETTINGS_TAB_STORAGE } from '@/utils/japanMapSettings'
import { buildJapanTree, excludePreviousCloseQuotes, findJapanCloseSnapshotTime, japanFilterQueryState, shouldFilterJapanQuotes } from '@/utils/japanMap'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { overseasMarketInfo } from '@/utils/markets'

// 일본 지도의 데이터·설정 — 공통 지도 화면(OverseasMapView)이 받는 모양으로 돌려준다.
// 일본은 5분마다 갱신되는 시세를 그리고, 장 중에는 전일 종가가 없는 종목을 지도에서 뺀다.
export function useJapanMapSource(): OverseasMapSource {
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { sheet } = useOverseasSheet()
  const { categories, classifications } = useOverseasClassificationData('JAPAN', sheet)
  const names = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data })
  const snapshotTimes = useMarketSnapshotTimes('JAPAN')
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('JAPAN', snapshotTimes.data)
  const quotes = useMarketQuotes('JAPAN', selectedTime)
  const liveQuotes = useMarketQuotes('JAPAN')
  const periodQuotes = useMarketPeriodQuotes('JAPAN', rangeStart, selectedTime)
  // 기준가가 없어 기간에서 뺀 종목 — 제외 종목 배지에 이름과 함께 보인다.
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names.data?.[stock.stockCode] ?? stock.stockCode }))
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const applyQuoteFilter = shouldFilterJapanQuotes(snapshotTime, new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }), rangeStart)
  const previousTradingDay = useMarketPreviousTradingDay('JAPAN', snapshotTime?.slice(0, 10) ?? null, applyQuoteFilter)
  const previousTime = applyQuoteFilter && previousTradingDay.data
    ? findJapanCloseSnapshotTime(snapshotTimes.data ?? [], previousTradingDay.data)
    : null
  const previousQuotes = useMarketQuotes('JAPAN', previousTime, previousTime !== null)
  const mapQuotes = useMemo(() => {
    if (!applyQuoteFilter || !shownQuotes || !quotes.data || !previousQuotes.data) return shownQuotes?.quotes ?? []
    const valid = new Set(excludePreviousCloseQuotes(quotes.data.quotes, previousQuotes.data.quotes).map(quote => quote.stockCode))
    return shownQuotes.quotes.filter(quote => valid.has(quote.stockCode))
  }, [applyQuoteFilter, shownQuotes, quotes.data, previousQuotes.data])
  const tree = useMemo(() => (categories.data && classifications.data && names.data && shownQuotes && shownQuotes.snapshotTime ? buildJapanTree(stocks, categories.data, classifications.data, names.data, mapQuotes, shownQuotes.snapshotTime) : []), [categories.data, classifications.data, names.data, shownQuotes, mapQuotes])
  const { preferences, update, isLoadingDefaults } = useJapanMapPreferences()
  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), names.refetch(), ...(previousTime ? [previousQuotes.refetch()] : []), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const filterState = japanFilterQueryState(applyQuoteFilter, snapshotTimes.isLoading || previousTradingDay.isLoading, snapshotTimes.isError, previousTime, previousQuotes.isLoading, previousQuotes.isError)
  const isLoading = isPeriodResolving || isLoadingDefaults || categories.isLoading || classifications.isLoading || names.isLoading || quotes.isLoading || periodQuotes.isLoading || filterState.isLoading
  const isError = categories.isError || classifications.isError || names.isError || quotes.isError || periodQuotes.isError || filterState.isError
  const { graphIndexItems, isFetching: isIndexFetching } = useOverseasPreviewIndex('JAPAN', snapshotTime, liveQuotes.data?.snapshotTime ?? null, rangeStart)
  // 국내 지도처럼 데이터가 없으면 지금 시각의 세션을 보여 준다.
  const session = japanSessionAt(snapshotTime ?? new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T'))
  return {
    market: 'JAPAN',
    label: overseasMarketInfo('JAPAN').badgeLabel,
    tree,
    snapshotTime,
    liveSnapshotTime: liveQuotes.data?.snapshotTime ?? null,
    selectedTime,
    rangeStart,
    select,
    selectRange,
    rangeExcludedStocks,
    isLoading,
    isError,
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || names.isFetching || isIndexFetching,
    graphIndexItems,
    refetchAll,
    preferences,
    update,
    sessionChip: <MarketSessionChip market="JAPAN" session={session} />,
    refreshHelp: JAPAN_REFRESH_HELP,
    currencyUnit: '엔',
    chart: { market: 'japan' },
    levelLabels: ['대분류', '중분류', '소분류'],
    defaultMaxDepth: 3,
    fixed: JAPAN_MAP_FIXED,
    draftKeyMap: sheet === 'MINE' ? JAPAN_MAP_DRAFT_KEY_MAP : undefined,
    settingPrefix: overseasSettingKey(JAPAN_MAP_SETTING_PREFIX, sheet),
    tabStorageName: JAPAN_SETTINGS_TAB_STORAGE.map,
    totalCount: stocks.length,
    // 화면에 그려진 종목을 센다(미국과 같다) — 시가총액 범위처럼 종목을 거르는 설정이 개수에 반영된다.
    countShown: filteredRootNodes => filteredRootNodes.reduce((count, root) => count + flattenAllItems([root]).length, 0),
  }
}
