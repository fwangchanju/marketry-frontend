import type { TreemapSectorNode, TreemapItem } from '@/types/api'

export interface SectorAverage {
  weightedAvg: number | null
  simpleAvg: number | null
}

// node.items + 모든 하위 섹터의 items(재귀) — 하위 섹터가 isExcluded여도 포함한다.
export function collectItems(node: TreemapSectorNode): TreemapItem[] {
  const items = [...node.items]
  for (const child of node.children) items.push(...collectItems(child))
  return items
}

// 섹터(하위 전체 포함)의 등락률 평균 — 백엔드가 예전에 집계 테이블에 저장하던 규칙과 같게 계산한다
// (marketry-backend collectItems). 거르는 건 marketValueTier가 excludedTierLabels에 있는
// 것 하나뿐이다 — 하위 제외 섹터도, 시가총액 0인 종목도 전부 더한다. 지도 헤더·업종 톱픽·섹터
// 그래프·텔레그램 캡션이 전부 이 값을 봐야 화면 숫자가 일치한다. 반드시 필터 전 원본 노드에 적용해야
// 한다 — 필터로 거른 뒤의 items/children으로 새로 만든 노드에 적용하면 이 규칙이 깨진다.
export function computeSectorAverage(
  node: TreemapSectorNode,
  excludedTierLabels: Set<string>,
): SectorAverage {
  let weightedSum = 0
  let totalValue = 0
  let simpleSum = 0
  let itemCount = 0
  for (const item of collectItems(node)) {
    if (excludedTierLabels.has(item.marketValueTier)) continue
    weightedSum += item.changeRate * item.totalMarketValue
    totalValue += item.totalMarketValue
    simpleSum += item.changeRate
    itemCount += 1
  }
  return {
    weightedAvg: totalValue > 0 ? weightedSum / totalValue : null,
    simpleAvg: itemCount > 0 ? simpleSum / itemCount : null,
  }
}
