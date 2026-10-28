import { useQuery } from '@tanstack/react-query'
import { getMarketNotices } from '@/api/heatmap'
import { heatmapKeys } from './queryKeys'
import { INFREQUENT_DATA_CACHE } from './cacheConfig'

export function useMarketNotices() {
  return useQuery({
    queryKey: heatmapKeys.notices(),
    queryFn: getMarketNotices,
    ...INFREQUENT_DATA_CACHE,
  })
}
