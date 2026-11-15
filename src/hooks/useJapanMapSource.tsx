import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import JapanDatePicker from '@/components/JapanDatePicker'
import JapanSessionChip from '@/components/JapanSessionChip'
import stocks from '@/data/japanStocks.json'
import type { OverseasMapSource } from '@/hooks/overseasMapSource'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useJapanMapPreferences } from '@/hooks/useJapanMapPreferences'
import { useJapanPeriodQuotes, useJapanPreviousTradingDay, useJapanQuotes, useJapanSnapshotTimes } from '@/hooks/useJapanQuotes'
import { JAPAN_MAP_DRAFT_KEY_MAP, JAPAN_MAP_FIXED, JAPAN_REFRESH_HELP, JAPAN_SETTINGS_TAB_STORAGE } from '@/utils/japanMapSettings'
import { buildJapanTree, excludePreviousCloseQuotes, findJapanCloseSnapshotTime, japanFilterQueryState, shouldFilterJapanQuotes, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { overseasMarketInfo } from '@/utils/markets'

// 일본 지도의 데이터·설정 — 공통 지도 화면(OverseasMapView)이 받는 모양으로 돌려준다.
// 일본은 5분마다 갱신되는 시세를 그리고, 장 중에는 전일 종가가 없는 종목을 지도에서 뺀다.
export function useJapanMapSource(): OverseasMapSource {
  const categories = useQuery({ queryKey: ['japan', 'categories'], queryFn: async () => (await client.get<JapanCategory[]>('/japan/categories')).data })
  const classifications = useQuery({ queryKey: ['japan', 'classifications'], queryFn: async () => (await client.get<Record<string, JapanClassification>>('/japan/classifications')).data })
  const names = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data })
  const snapshotTimes = useJapanSnapshotTimes()
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('JAPAN', snapshotTimes.data)
  const quotes = useJapanQuotes(selectedTime)
  const liveQuotes = useJapanQuotes()
  const periodQuotes = useJapanPeriodQuotes(rangeStart, selectedTime)
  // 기준가가 없어 기간에서 뺀 종목 — 제외 종목 배지에 이름과 함께 보인다.
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names.data?.[stock.stockCode] ?? stock.stockCode }))
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const applyQuoteFilter = shouldFilterJapanQuotes(snapshotTime, new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }), rangeStart)
  const previousTradingDay = useJapanPreviousTradingDay(snapshotTime?.slice(0, 10) ?? null, applyQuoteFilter)
  const previousTime = applyQuoteFilter && previousTradingDay.data
    ? findJapanCloseSnapshotTime(snapshotTimes.data ?? [], previousTradingDay.data)
    : null
  const previousQuotes = useJapanQuotes(previousTime, previousTime !== null)
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
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || names.isFetching,
    refetchAll,
    preferences,
    update,
    DatePicker: JapanDatePicker,
    sessionChip: <JapanSessionChip session={session} />,
    refreshHelp: JAPAN_REFRESH_HELP,
    currencyUnit: '엔',
    levelLabels: ['대분류', '중분류', '소분류'],
    defaultMaxDepth: 3,
    fixed: JAPAN_MAP_FIXED,
    draftKeyMap: JAPAN_MAP_DRAFT_KEY_MAP,
    tabStorageName: JAPAN_SETTINGS_TAB_STORAGE.map,
    totalCount: stocks.length,
    countShown: () => mapQuotes.length,
  }
}
