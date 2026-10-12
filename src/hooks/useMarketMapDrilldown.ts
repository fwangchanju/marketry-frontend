import { useState } from 'react'
import type { MarketMapSectorNode } from '@/types/api'

// 섹터 이름은 DB에서 전체 유일(uk_market_map_category_name)이 보장되므로, 트리 전체를 뒤져서
// 루트부터 해당 이름까지의 전체 경로를 찾을 수 있다. "전체" 화면에서는 세부 섹터 헤더가 이미
// 중첩 렌더링돼있어 부모를 거치지 않고 바로 클릭할 수 있는데, 그 경우에도 조상 이름이 빠지지 않게
// 클릭한 이름 하나만 쌓는 대신 이 전체 경로로 교체해야 한다.
function findPathToSector<T extends MarketMapSectorNode>(
  nodes: T[],
  targetName: string,
  ancestors: string[] = [],
): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.sectorName === targetName) return path
    const found = findPathToSector(node.children as T[], targetName, path)
    if (found) return found
  }
  return null
}

export function useMarketMapDrilldown<T extends MarketMapSectorNode>(rootNodes: T[]) {
  const [path, setPath] = useState<string[]>([])

  let currentNode: T | null = null
  let currentSiblings = rootNodes
  for (const name of path) {
    const found = currentSiblings.find(n => n.sectorName === name)
    if (!found) break
    currentNode = found
    currentSiblings = found.children as T[]
  }

  // 업종을 찾아 들어가면 그 업종까지의 경로를, 트리에 없으면 그대로 두고 null을 돌려준다.
  const enterSector = (sectorName: string): string[] | null => {
    const fullPath = findPathToSector(rootNodes, sectorName)
    if (!fullPath) return null
    setPath(fullPath)
    return fullPath
  }
  const goBack = () => setPath(prev => prev.slice(0, -1))
  const goToDepth = (depth: number) => setPath(prev => prev.slice(0, depth))
  const reset = () => setPath([])

  return { path, setPath, currentNode, currentSiblings, enterSector, goBack, goToDepth, reset }
}
