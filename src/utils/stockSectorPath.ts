import type { HeatmapSectorNode } from '@/types/api'

// 종목이 속한 분류를 맨 위(대분류)부터 차례로 돌려준다(예: ['반도체 소·부·장', '후공정 장비']). 트리에 없으면 null.
// 지도에서 어느 업종 안으로 들어가 있든 같은 결과를 주도록 전체 트리에서 찾는다.
export function findStockSectorPath(nodes: readonly HeatmapSectorNode[], stockCode: string): string[] | null {
  for (const node of nodes) {
    if (node.items.some(item => item.stockCode === stockCode)) return [node.sectorName]
    const deeper = findStockSectorPath(node.children, stockCode)
    if (deeper) return [node.sectorName, ...deeper]
  }
  return null
}
