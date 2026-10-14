import { useQuery } from '@tanstack/react-query'
import { getMarketValueTiers } from '@/api/treemap'
import { getCustomValueTiers } from '@/api/custom'
import { treemapKeys, customTreemapKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'
import { useIsLoggedIn } from './useSession'

// 비로그인/미로그인 상태에서는 공개 기본값(GET /map/value-tiers)을, 로그인 사용자는 본인 값
// (GET /custom/value-tiers)을 받는다(가입/로그인 전환 지시서 4) — 응답 모양은 동일하다.
export function useMarketValueTiers() {
  const isLoggedIn = useIsLoggedIn()
  return useQuery({
    queryKey: isLoggedIn ? customTreemapKeys.valueTiers() : treemapKeys.valueTiers(),
    queryFn: isLoggedIn ? getCustomValueTiers : getMarketValueTiers,
    ...STATIC_REFERENCE_CACHE,
  })
}
