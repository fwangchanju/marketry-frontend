import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { calculatePeriodDetailed, type PeriodExcludedStock } from '@/utils/japanPeriod'

export type JapanQuote = { stockCode: string; currentPrice: number; lastPrice: number; changeRate: number; totalMarketValue: number; closeVerified?: boolean | null }
export type JapanQuoteSnapshot = { snapshotTime: string | null; quotes: JapanQuote[] }

const ENDPOINT = '/japan/quotes'

// 시각을 주지 않으면 서버에 저장된 가장 최근 시세를 받는다.
export function useJapanQuotes(snapshotTime: string | null = null, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['japan', 'quotes', snapshotTime],
    queryFn: async () => (await client.get<JapanQuoteSnapshot>(ENDPOINT, { params: snapshotTime ? { snapshotTime } : undefined })).data,
  })
}

export function useJapanSnapshotTimes(enabled = true) {
  return useQuery({
    queryKey: ['japan', 'quotes', 'snapshots'],
    enabled,
    queryFn: async () => (await client.get<string[]>(`${ENDPOINT}/snapshots`)).data,
  })
}

export function useJapanPreviousTradingDay(date: string | null, enabled = true) {
  return useQuery({
    queryKey: ['japan', 'quotes', 'previous-trading-day', date],
    enabled: enabled && date !== null,
    queryFn: async () => (await client.get<string>(`${ENDPOINT}/previous-trading-day`, { params: { date } })).data,
  })
}

// 기간 시작일의 전일 종가와 종료일 시세가 모두 있는 종목만 계산한다.
export function useJapanPeriodQuotes(startTime: string | null, endTime: string | null) {
  const start = useJapanQuotes(startTime, startTime !== null)
  const end = useJapanQuotes(endTime, startTime !== null && endTime !== null)
  const detailed = startTime !== null && end.data && start.data ? calculatePeriodDetailed(start.data.quotes, end.data.quotes) : undefined
  const data = detailed && end.data ? { ...end.data, quotes: detailed.quotes } : undefined
  // 기준가가 없어 뺀 종목(신규 상장 등) — 기간 보기 배지에 쓴다.
  const excluded: PeriodExcludedStock[] = detailed?.excluded ?? []
  return { data, excluded, isLoading: startTime !== null && (start.isLoading || end.isLoading), isError: startTime !== null && (start.isError || end.isError), refetch: () => Promise.all([start.refetch(), end.refetch()]) }
}
