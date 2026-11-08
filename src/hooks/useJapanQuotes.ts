import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { calculateJapanPeriod } from '@/utils/japanPeriod'

export type JapanQuote = { stockCode: string; currentPrice: number; lastPrice: number; changeRate: number; totalMarketValue: number }
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

// 기간 시작일의 전일 종가와 종료일 시세가 모두 있는 종목만 계산한다.
export function useJapanPeriodQuotes(startTime: string | null, endTime: string | null) {
  const start = useJapanQuotes(startTime, startTime !== null)
  const end = useJapanQuotes(endTime, startTime !== null && endTime !== null)
  const data = startTime !== null && end.data && start.data ? {
    ...end.data,
    quotes: calculateJapanPeriod(start.data.quotes, end.data.quotes),
  } : undefined
  return { data, isLoading: startTime !== null && (start.isLoading || end.isLoading), isError: startTime !== null && (start.isError || end.isError), refetch: () => Promise.all([start.refetch(), end.refetch()]) }
}
