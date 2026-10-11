import type { MarketMapSectorNode } from '@/types/api'

export interface DepthEntry {
  node: MarketMapSectorNode
  // 같은 이름의 업종이 다른 대분류 밑에 또 있을 수 있어 위에서부터 이어 붙인 이름으로 구분한다.
  pathKey: string
}

// 고른 깊이(1=대분류, 2=중분류, 3=소분류)의 업종을 모은다. 그 깊이에 닿기 전에 하위 업종이 끝나는 업종은 그대로 한 막대가 된다.
// 제외한 업종은 그 밑까지 뺀다.
export function collectAtDepth(
  nodes: MarketMapSectorNode[],
  depth: number,
  excludedSectorIds: Set<number>,
  parentKey = '',
  level = 1,
): DepthEntry[] {
  const entries: DepthEntry[] = []
  for (const node of nodes) {
    if (excludedSectorIds.has(node.sectorId)) continue
    const pathKey = parentKey ? `${parentKey}>${node.sectorName}` : node.sectorName
    if (level >= depth || node.children.length === 0) entries.push({ node, pathKey })
    else entries.push(...collectAtDepth(node.children, depth, excludedSectorIds, pathKey, level + 1))
  }
  return entries
}
