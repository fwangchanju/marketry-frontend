import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import type { IntradayIndexQuote } from '@/utils/indexChange'

// 닛케이 지수의 그날 장중 등락률(5분 단위). 그래프의 오늘·"N분 전 대비" 지수 막대에 쓴다.
// 서버에 값이 없거나 조회가 실패하면 data가 비어 있고, 그래프는 종가 기준 막대로만 그린다.
export function useJapanIndexQuotes(date: string | null) {
  return useQuery({
    enabled: date !== null,
    queryKey: ['japan', 'index-quotes', date],
    queryFn: async () => (await client.get<IntradayIndexQuote[]>('/japan/index-quotes', { params: { date } })).data,
  })
}
