import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { marketParams } from '@/api/custom'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'

// 설정창 맨 아래 시각. MARKETRY 모드는 지금 보이는 MARKETRY 버전을 올린 시각(모두에게 보인다),
// 내 기준 모드는 내 기준을 마지막으로 고친 시각이다. 한국의 내 분류 시각과 같은 뜻이다.
export function useSnapshotPublishedAt(market: SnapshotMarket, sheet: 'MARKETRY' | 'MINE') {
  const { routeSegment } = snapshotMarketInfo(market)
  const { data: session } = useSession()
  const isMine = sheet === 'MINE' && isAdminSession(session)
  const query = useQuery({
    queryKey: ['overseas-time', market, isMine ? 'mine' : 'marketry'],
    queryFn: async () => (isMine
      ? (await client.get<{ editedAt: string | null }>('/custom/sectors/edited-at', { params: marketParams(market) })).data.editedAt
      : (await client.get<{ publishedAt: string | null }>(`/${routeSegment}/classification-published-at`)).data.publishedAt),
  })
  return query.data ?? null
}
