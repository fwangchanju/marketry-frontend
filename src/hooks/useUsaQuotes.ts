import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { calculateJapanPeriod } from '@/utils/japanPeriod'

export type UsaQuote = { stockCode: string; currentPrice: number; lastPrice: number; changeRate: number; totalMarketValue: number }
export type UsaQuoteSnapshot = { snapshotTime: string | null; quotes: UsaQuote[] }
export type UsaStock = { symbol: string; name: string }

const ENDPOINT = '/usa/quotes'

// 시각을 주지 않으면 서버에 저장된 가장 최근 시세를 받는다. 미국은 하루 한 번 저장돼서 시각은 항상 그 거래일 16:00이다.
export function useUsaQuotes(snapshotTime: string | null = null, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['usa', 'quotes', snapshotTime],
    queryFn: async () => (await client.get<UsaQuoteSnapshot>(ENDPOINT, { params: snapshotTime ? { snapshotTime } : undefined })).data,
  })
}

export function useUsaSnapshotTimes(enabled = true) {
  return useQuery({
    queryKey: ['usa', 'quotes', 'snapshots'],
    enabled,
    queryFn: async () => (await client.get<string[]>(`${ENDPOINT}/snapshots`)).data,
  })
}

// 지도에 올릴 종목(티커와 영문 이름). 일본처럼 번들 파일에 넣지 않고 서버 목록을 쓴다.
export function useUsaStocks() {
  return useQuery({
    queryKey: ['usa', 'stocks'],
    queryFn: async () => (await client.get<UsaStock[]>('/usa/stocks')).data,
  })
}

// 기간 보기 — 시작일 시세의 전일 종가를 기준으로 종료일 시세까지의 등락률을 계산한다. 일본과 같은 계산이다(서버 API 없음).
export function useUsaPeriodQuotes(startTime: string | null, endTime: string | null) {
  const start = useUsaQuotes(startTime, startTime !== null)
  const end = useUsaQuotes(endTime, startTime !== null && endTime !== null)
  const data = startTime !== null && end.data && start.data ? {
    ...end.data,
    quotes: calculateJapanPeriod(start.data.quotes, end.data.quotes),
  } : undefined
  return { data, isLoading: startTime !== null && (start.isLoading || end.isLoading), isError: startTime !== null && (start.isError || end.isError), refetch: () => Promise.all([start.refetch(), end.refetch()]) }
}
