import type { HeatmapSectorNode } from '@/types/api'
import { isMarketValueExcluded, type MarketValueExclusions } from './marketValueTier.ts'

// 상위·하위 제외가 겹쳐도 각 줄은 자기 하위 전체를 센다. 중복은 하위 줄의 흐린 표시로 알린다.
export function collectExcludedSectorCounts(nodes: HeatmapSectorNode[], exclusions: MarketValueExclusions): Map<number, number> {
  const counts = new Map<number, number>()
  const visit = (node: HeatmapSectorNode): number => {
    const own = node.items.filter(item => item.totalMarketValue > 0 && !isMarketValueExcluded(item, exclusions)).length
    const total = own + node.children.reduce((sum, child) => sum + visit(child), 0)
    counts.set(node.sectorId, total)
    return total
  }
  nodes.forEach(visit)
  return counts
}
