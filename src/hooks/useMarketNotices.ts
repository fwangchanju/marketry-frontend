import { useQuery } from '@tanstack/react-query'
import { getMarketNotices } from '@/api/treemap'
import { treemapKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useMarketNotices() {
  return useQuery({
    queryKey: treemapKeys.notices(),
    queryFn: getMarketNotices,
    ...INFREQUENT_DATA_CACHE,
  })
}
