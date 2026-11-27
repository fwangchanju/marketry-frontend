import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'
import { INFREQUENT_DATA_CACHE } from '@/hooks/cacheConfig'

// 설정창 맨 아래 시각. MARKETRY 모드는 MARKETRY 분류를 마지막으로 업데이트·롤백한 시각(모두에게 보인다),
// 내 기준 모드는 관리자가 내 기준을 마지막으로 고친 시각(관리자 전용)이다. 한국의 내 분류 시각과 같은 뜻이다.
export function useSnapshotPublishedAt(market: SnapshotMarket, sheet: 'MARKETRY' | 'MINE') {
  const { routeSegment } = snapshotMarketInfo(market)
  const { data: session } = useSession()
  const isMine = sheet === 'MINE' && isAdminSession(session)
  const query = useQuery({
    queryKey: ['overseas-time', market, isMine ? 'mine' : 'marketry'],
    queryFn: async () => (isMine
      ? (await client.get<{ editedAt: string | null }>(`/admin/overseas-classification-drafts/${market}/edited-at`)).data.editedAt
      : (await client.get<{ publishedAt: string | null }>(`/${routeSegment}/classification-published-at`)).data.publishedAt),
    ...INFREQUENT_DATA_CACHE,
  })
  return query.data ?? null
}
