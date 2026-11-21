import type { FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'

// 종목·업종 헤더와 같은 방식 — 올리면 흰색 35% 덮개가 씌워진다(index.css의 hover와 같은 불투명도).
export const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'

export function toDisplayGroup(node: FilteredHeatmapSectorNode): DisplayGroup {
  return {
    sectorId: node.sectorId,
    sectorName: node.sectorName,
    totalMarketValue: node.totalMarketValue,
    weightedAvgChangeRate: node.weightedAvgChangeRate,
    simpleAvgChangeRate: node.simpleAvgChangeRate,
    items: node.items,
    children: node.children.map(toDisplayGroup),
  }
}
