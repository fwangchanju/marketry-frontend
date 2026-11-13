import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'

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
