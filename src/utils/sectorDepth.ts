import type { TreemapSectorNode } from '@/types/api'

export interface DepthEntry {
  node: TreemapSectorNode
  // 위에서부터 이어 붙인 이름 — 비교 시점과 짝을 맞출 때 쓴다. 업종명은 한 분류 안에서 겹치지 않지만(거래소는 이름으로 묶고, 내 분류·MARKETRY는 DB가 막는다) 경로로 구분해 둔다.
  pathKey: string
}

// 제외한 업종·시가총액 구간을 뺐을 때 이 업종에 남는 종목이 있는지 — 지도 페이지는 남는 종목이 없는 업종을 그리지 않으므로 같은 기준으로 맞춘다.
function hasVisibleStocks(node: TreemapSectorNode, excludedSectorIds: Set<number>, excludedTiers: Set<string>): boolean {
  if (excludedSectorIds.has(node.sectorId)) return false
  if (node.items.some(item => !excludedTiers.has(item.marketValueTier))) return true
  return node.children.some(child => hasVisibleStocks(child, excludedSectorIds, excludedTiers))
}

// 고른 깊이(1=대분류, 2=중분류, 3=소분류)의 업종을 모은다. 그 깊이에 닿기 전에 하위 업종이 끝나는 업종은 그대로 한 막대가 된다.
// 제외한 업종은 그 밑까지 뺀다.
export function collectAtDepth(
  nodes: TreemapSectorNode[],
  depth: number,
  excludedSectorIds: Set<number>,
  excludedTiers: Set<string> = new Set<string>(),
  parentKey = '',
  level = 1,
): DepthEntry[] {
  const entries: DepthEntry[] = []
  for (const node of nodes) {
    if (!hasVisibleStocks(node, excludedSectorIds, excludedTiers)) continue
    const pathKey = parentKey ? `${parentKey}>${node.sectorName}` : node.sectorName
    if (level >= depth || node.children.length === 0) entries.push({ node, pathKey })
    else entries.push(...collectAtDepth(node.children, depth, excludedSectorIds, excludedTiers, pathKey, level + 1))
  }
  return entries
}
