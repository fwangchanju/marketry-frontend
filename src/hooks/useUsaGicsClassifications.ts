import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import type { GicsClassificationMap } from '@/utils/usaGicsTree'

// 미국 S&P 500 GICS 분류(읽기 전용). enabled가 꺼져 있으면 요청하지 않는다.
export function useUsaGicsClassifications(enabled: boolean) {
  return useQuery({
    queryKey: ['usa', 'gics-classifications'],
    enabled,
    queryFn: async () => (await client.get<GicsClassificationMap>('/usa/gics-classifications')).data,
  })
}
