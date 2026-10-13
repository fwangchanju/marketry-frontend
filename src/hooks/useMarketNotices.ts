import { useQuery } from '@tanstack/react-query'
import { getMarketNotices } from '@/api/marketMap'
import { marketMapKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useMarketNotices() {
  return useQuery({
    queryKey: marketMapKeys.notices(),
    queryFn: getMarketNotices,
    ...INFREQUENT_DATA_CACHE,
  })
}
