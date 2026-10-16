// 거래소 분류(KRX) 트리는 모든 업종의 sectorId가 0이라 id로 업종을 구별하는 제외 기능이 한 업종만 제외해도 전부 사라진다.
// 비로그인(거래소 분류만 씀)에게는 업종명 경로로 만든 고유 음수 id를 붙여 구별한다. 같은 이름이면 항상 같은 id다.
import type { TreemapSectorNode } from '@/types/api'

function hashPath(path: string): number {
  let hash = 5381
  for (let index = 0; index < path.length; index += 1) hash = ((hash * 33) ^ path.charCodeAt(index)) >>> 0
  return hash
}

export function withStableSectorIds(nodes: TreemapSectorNode[], parentPath = ''): TreemapSectorNode[] {
  return nodes.map(node => {
    const path = `${parentPath}>${node.sectorName}`
    return {
      ...node,
      sectorId: node.sectorId === 0 ? -(hashPath(path) + 1) : node.sectorId,
      children: withStableSectorIds(node.children, path),
    }
  })
}
