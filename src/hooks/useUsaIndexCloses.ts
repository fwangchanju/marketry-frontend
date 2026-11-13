import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import type { IndexClose } from '@/utils/indexChange'

// S&P 500 지수의 날짜별 종가. 그래프의 지수 기준 막대에 쓴다. 값이 없는 날짜는 응답에 빠진다.
export function useUsaIndexCloses(from: string | null, to: string | null) {
  return useQuery({
    enabled: from !== null && to !== null,
    queryKey: ['usa', 'index-closes', from, to],
    queryFn: async () => (await client.get<IndexClose[]>('/usa/index-closes', { params: { from, to } })).data,
  })
}
