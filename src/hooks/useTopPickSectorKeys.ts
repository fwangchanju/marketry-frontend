import { useMemo } from 'react'
import { collectSectorsAtDepth, type FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { pickTopSectorKeys } from '@/utils/topPickSectors'

const NO_TOP_PICKS = new Set<string>()

// 상위 업종 강조 — 고른 단계의 업종 중 등락률이 높은 순서로 뽑는다. 필터가 적용된 전체 트리 기준이라 업종 안으로 들어가도 바뀌지 않는다.
export function useTopPickSectorKeys({ nodes, enabled, depth, maxDepth, count, metric }: {
  nodes: FilteredHeatmapSectorNode[]
  enabled: boolean
  depth: number
  maxDepth: number
  count: number
  metric: Parameters<typeof pickTopSectorKeys>[2]
}) {
  return useMemo(
    () => (enabled && depth >= 0 && depth < maxDepth ? pickTopSectorKeys(collectSectorsAtDepth(nodes, depth), count, metric) : NO_TOP_PICKS),
    [nodes, enabled, depth, maxDepth, count, metric],
  )
}
