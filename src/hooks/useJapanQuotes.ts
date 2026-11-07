import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'

export type JapanQuote = { stockCode: string; currentPrice: number; lastPrice: number; changeRate: number; totalMarketValue: number }
type JapanQuoteSnapshot = { snapshotTime: string | null; quotes: JapanQuote[] }

const ENDPOINT = '/japan/quotes'

// 시각을 주지 않으면 서버에 저장된 가장 최근 시세를 받는다.
export function useJapanQuotes(snapshotTime: string | null = null, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['japan', 'quotes', snapshotTime],
    queryFn: async () => (await client.get<JapanQuoteSnapshot>(ENDPOINT, { params: snapshotTime ? { snapshotTime } : undefined })).data,
  })
}

export function useJapanSnapshotTimes() {
  return useQuery({
    queryKey: ['japan', 'quotes', 'snapshots'],
    queryFn: async () => (await client.get<string[]>(`${ENDPOINT}/snapshots`)).data,
  })
}
