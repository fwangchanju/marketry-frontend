import { useMemo } from 'react'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasClassificationData } from '@/hooks/useOverseasClassificationData'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import JapanDatePicker from '@/components/JapanDatePicker'
import JapanSessionChip from '@/components/JapanSessionChip'
import japanStocks from '@/data/japanStocks.json'
import type { OverseasSummarySource } from '@/hooks/overseasSummarySource'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import { useJapanPeriodQuotes, useJapanQuotes, useJapanSnapshotTimes } from '@/hooks/useJapanQuotes'
import { buildJapanTree } from '@/utils/japanMap'
import { JAPAN_MAP_FIXED, JAPAN_MAP_SETTING_PREFIX, JAPAN_REFRESH_HELP } from '@/utils/japanMapSettings'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { overseasMarketInfo } from '@/utils/markets'

// 일본 서머리의 데이터·설정 — 공통 서머리 화면(OverseasSummaryView)이 받는 모양으로 돌려준다.
export function useJapanSummarySource(): OverseasSummarySource {
  // 내 기준 모드(관리자)는 MARKETRY에 올리기 전 사본 분류로 그린다.
  const { sheet } = useOverseasSheet()
  const { categories, classifications } = useOverseasClassificationData('JAPAN', sheet)
  const names = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data })
  // 날짜·기간은 지도·그래프와 같은 저장소를 쓴다(다른 화면에서 고른 기간이 이어진다).
  const times = useJapanSnapshotTimes()
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod('JAPAN', times.data)
  const quotes = useJapanQuotes(selectedTime)
  const liveQuotes = useJapanQuotes(null)
  const periodQuotes = useJapanPeriodQuotes(rangeStart, selectedTime)
  // 기간이면 기간 등락률 시세를, 아니면 고른 날짜(없으면 최신)의 시세를 쓴다.
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const tree = useMemo(() => {
    const snap = shownQuotes?.snapshotTime ?? null
    if (!categories.data || !classifications.data || !shownQuotes || !snap) return []
    if (!names.data) return []
    return buildJapanTree(japanStocks, categories.data, classifications.data, names.data, shownQuotes.quotes, snap)
  }, [categories.data, classifications.data, shownQuotes, names.data])
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: names.data?.[stock.stockCode] ?? stock.stockCode }))
  const refetchAll = () => Promise.all([quotes.refetch(), categories.refetch(), classifications.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
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
    isLoading: isPeriodResolving || categories.isLoading || classifications.isLoading || quotes.isLoading || periodQuotes.isLoading,
    isFetching: quotes.isFetching || categories.isFetching || classifications.isFetching,
    refetchAll,
    DatePicker: JapanDatePicker,
    sessionChip: snapshotTime ? <JapanSessionChip session={japanSessionAt(snapshotTime)} /> : null,
    refreshHelp: JAPAN_REFRESH_HELP,
    fixed: JAPAN_MAP_FIXED,
    tabStorageName: 'Home',
    settingPrefix: overseasSettingKey(JAPAN_MAP_SETTING_PREFIX, sheet),
    currencyUnit: '엔',
    shownCount: shownQuotes?.quotes.length ?? 0,
    totalCount: japanStocks.length,
  }
}
