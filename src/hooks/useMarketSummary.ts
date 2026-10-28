import { useQuery } from '@tanstack/react-query'
import { getMarketSummary } from '@/api/marketSummary'
import { marketSummaryKeys } from './queryKeys'
import { MARKET_DATA_CACHE } from './cacheConfig'

export function useMarketSummary(enabled = true) {
  return useQuery({
    queryKey: marketSummaryKeys.summary(),
    enabled,
    queryFn: getMarketSummary,
    ...MARKET_DATA_CACHE,
  })
}
