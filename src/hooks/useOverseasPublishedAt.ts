import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'

// 설정창 맨 아래 "업데이트" 시각 — MARKETRY 분류를 마지막으로 업데이트하거나 롤백한 시각(없으면 null). 모든 사용자에게 보인다.
export function useOverseasPublishedAt(market: OverseasMarket) {
  const { routeSegment } = overseasMarketInfo(market)
  const query = useQuery({
    queryKey: ['overseas-published-at', market],
    queryFn: async () => (await client.get<{ publishedAt: string | null }>(`/${routeSegment}/classification-published-at`)).data.publishedAt,
  })
  return query.data ?? null
}
