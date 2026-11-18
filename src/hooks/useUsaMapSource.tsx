import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import UsaDatePicker from '@/components/UsaDatePicker'
import UsaSessionChip from '@/components/UsaSessionChip'
import type { OverseasMapSource } from '@/hooks/overseasMapSource'
import { flattenAllItems } from '@/hooks/useFilteredHeatmap'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useUsaMapPreferences } from '@/hooks/useUsaMapPreferences'
import { useUsaPeriodQuotes, useUsaQuotes, useUsaSnapshotTimes, useUsaStocks } from '@/hooks/useUsaQuotes'
import { buildJapanTree, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { overseasMarketInfo } from '@/utils/markets'
import { USA_MAP_DRAFT_KEY_MAP, USA_MAP_FIXED, USA_MAP_SETTING_PREFIX, USA_SETTINGS_TAB_STORAGE } from '@/utils/usaMapSettings'
import { USA_SESSION, usaRefreshHelp } from '@/utils/usaMarketSession'

// 미국 지도의 데이터·설정 — 공통 지도 화면(OverseasMapView)이 받는 모양으로 돌려준다.
// 미국은 하루 한 번 저장된 종가로 그리고, 분류는 섹터·업종 두 단계다. 지도 트리는 일본과 같은 부품(buildJapanTree)으로 만든다.
export function useUsaMapSource(): OverseasMapSource {
  const categories = useQuery({ queryKey: ['usa', 'categories'], queryFn: async () => (await client.get<JapanCategory[]>('/usa/categories')).data })
  const classifications = useQuery({ queryKey: ['usa', 'classifications'], queryFn: async () => (await client.get<Record<string, JapanClassification>>('/usa/classifications')).data })
  const stocks = useUsaStocks()
  const snapshotTimes = useUsaSnapshotTimes()
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('USA', snapshotTimes.data)
  const quotes = useUsaQuotes(selectedTime)
  const periodQuotes = useUsaPeriodQuotes(rangeStart, selectedTime)
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const liveQuotes = useUsaQuotes()
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const treeStocks = useMemo(() => (stocks.data ?? []).map(stock => ({ code: stock.symbol, name: stock.name })), [stocks.data])
  // 박스 라벨은 일본 지도처럼 한글 종목명을 쓴다. 한글 이름이 아직 없는 종목은 티커로 대신한다.
  const koreanNames = useQuery({ queryKey: ['usa', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/usa/stock-names')).data })
  const names = useMemo(() => Object.fromEntries((stocks.data ?? []).map(stock => [stock.symbol, koreanNames.data?.[stock.symbol] ?? stock.symbol])), [stocks.data, koreanNames.data])
  // 기준가가 없어 기간에서 뺀 종목 — 제외 종목 배지에 이름과 함께 보인다.
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names[stock.stockCode] ?? stock.stockCode }))
  const tree = useMemo(() => (categories.data && classifications.data && stocks.data && shownQuotes?.snapshotTime ? buildJapanTree(treeStocks, categories.data, classifications.data, names, shownQuotes.quotes, shownQuotes.snapshotTime) : []), [categories.data, classifications.data, stocks.data, shownQuotes, treeStocks, names])
  const { preferences, update } = useUsaMapPreferences()
  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), stocks.refetch(), koreanNames.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const isLoading = isPeriodResolving || categories.isLoading || classifications.isLoading || stocks.isLoading || koreanNames.isLoading || quotes.isLoading || periodQuotes.isLoading
  const isError = categories.isError || classifications.isError || stocks.isError || koreanNames.isError || quotes.isError || periodQuotes.isError
  return {
    market: 'USA',
    label: overseasMarketInfo('USA').badgeLabel,
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
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching || stocks.isFetching,
    refetchAll,
    preferences,
    update,
    DatePicker: UsaDatePicker,
    sessionChip: <UsaSessionChip session={USA_SESSION} />,
    refreshHelp: usaRefreshHelp(snapshotTime),
    currencyUnit: '달러',
    levelLabels: ['대분류', '중분류'],
    defaultMaxDepth: 2,
    fixed: USA_MAP_FIXED,
    draftKeyMap: USA_MAP_DRAFT_KEY_MAP,
    settingPrefix: USA_MAP_SETTING_PREFIX,
    tabStorageName: USA_SETTINGS_TAB_STORAGE.map,
    totalCount: treeStocks.length,
    // 미국은 필터를 거친 트리에 남은 종목 수를 센다.
    countShown: filteredRootNodes => filteredRootNodes.reduce((count, root) => count + flattenAllItems([root]).length, 0),
  }
}
