import { useMemo } from 'react'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import UsaDatePicker from '@/components/UsaDatePicker'
import UsaSessionChip from '@/components/UsaSessionChip'
import type { OverseasSummarySource } from '@/hooks/overseasSummarySource'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useUsaPeriodQuotes, useUsaQuotes, useUsaSnapshotTimes, useUsaStocks } from '@/hooks/useUsaQuotes'
import { buildJapanTree } from '@/utils/japanMap'
import { overseasMarketInfo } from '@/utils/markets'
import { USA_MAP_FIXED, USA_MAP_SETTING_PREFIX } from '@/utils/usaMapSettings'
import { USA_SESSION, usaRefreshHelp } from '@/utils/usaMarketSession'

// 미국 서머리의 데이터·설정 — 공통 서머리 화면(OverseasSummaryView)이 받는 모양으로 돌려준다.
// 미국은 하루 한 번 저장된 종가로 그리고, 지도 트리는 일본과 같은 부품(buildJapanTree)으로 만든다.
export function useUsaSummarySource(): OverseasSummarySource {
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { sheet } = useOverseasSheet()
  const { categories, classifications } = useOverseasClassificationData('USA', sheet)
  const names = useQuery({ queryKey: ['usa', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/usa/stock-names')).data })
  const stocks = useUsaStocks()
  // 날짜·기간은 지도·그래프와 같은 저장소를 쓴다(다른 화면에서 고른 기간이 이어진다).
  const times = useUsaSnapshotTimes()
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('USA', times.data)
  const quotes = useUsaQuotes(selectedTime)
  const liveQuotes = useUsaQuotes(null)
  const periodQuotes = useUsaPeriodQuotes(rangeStart, selectedTime)
  // 기간이면 기간 등락률 시세를, 아니면 고른 날짜(없으면 최신)의 시세를 쓴다.
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const tree = useMemo(() => {
    const snap = shownQuotes?.snapshotTime ?? null
    if (!categories.data || !classifications.data || !shownQuotes || !snap) return []
    if (!stocks.data || !names.data) return []
    const koreanNames = Object.fromEntries(stocks.data.map(stock => [stock.symbol, names.data?.[stock.symbol] ?? stock.symbol]))
    const treeStocks = stocks.data.map(stock => ({ code: stock.symbol, name: stock.name }))
    return buildJapanTree(treeStocks, categories.data, classifications.data, koreanNames, shownQuotes.quotes, snap)
  }, [categories.data, classifications.data, shownQuotes, names.data, stocks.data])
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names.data?.[stock.stockCode] ?? stock.stockCode }))
  const refetchAll = () => Promise.all([quotes.refetch(), categories.refetch(), classifications.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
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
    isLoading: isPeriodResolving || categories.isLoading || classifications.isLoading || quotes.isLoading || periodQuotes.isLoading,
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching,
    refetchAll,
    DatePicker: UsaDatePicker,
    sessionChip: snapshotTime ? <UsaSessionChip session={USA_SESSION} /> : null,
    refreshHelp: usaRefreshHelp(snapshotTime),
    fixed: USA_MAP_FIXED,
    tabStorageName: 'Home',
    settingPrefix: overseasSettingKey(USA_MAP_SETTING_PREFIX, sheet),
    currencyUnit: '달러',
    shownCount: shownQuotes?.quotes.length ?? 0,
    totalCount: stocks.data?.length ?? 0,
  }
}
