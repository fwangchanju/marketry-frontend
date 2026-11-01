import type { HeatmapSectorNode, HeatmapItem } from '@/types/api'
import { isMarketValueExcluded } from './marketValueTier.ts'

export interface SectorAverage {
  weightedAvg: number | null
  simpleAvg: number | null
}

// node.items + 모든 하위 섹터의 items(재귀) — 하위 섹터가 isExcluded여도 포함한다.
export function collectItems(node: HeatmapSectorNode): HeatmapItem[] {
  const items = [...node.items]
  for (const child of node.children) items.push(...collectItems(child))
  return items
}

// 섹터(하위 전체 포함)의 등락률 평균 — 백엔드 집계(SectorTierAggregationService.collectItems)와 같은 규칙으로
// 계산한다. 거르는 건 marketValueTier가 excludedTierLabels에 있는
// 것 하나뿐이다 — 하위 제외 섹터도, 시가총액 0인 종목도 전부 더한다. 지도 헤더·업종 톱픽·섹터
// 그래프·텔레그램 캡션이 전부 이 값을 봐야 화면 숫자가 일치한다. 반드시 필터 전 원본 노드에 적용해야
// 한다 — 필터로 거른 뒤의 items/children으로 새로 만든 노드에 적용하면 이 규칙이 깨진다.
export function computeSectorAverage(
  node: HeatmapSectorNode,
  excludedTierLabels: Set<string>,
): SectorAverage {
  let weightedSum = 0
  let totalValue = 0
  let simpleSum = 0
  let itemCount = 0
  for (const item of collectItems(node)) {
    if (isMarketValueExcluded(item, excludedTierLabels)) continue
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

export interface SectorSummary {
  weightedAvg: number
  simpleAvg: number | null
  // 업종 시가총액·오른/내린/보합 종목 수 — 등락률 평균과 같은 종목 모음(원본 노드, 시총 구간 제외만 반영)이다.
  marketValue: number
  advancers: number
  decliners: number
  unchanged: number
  // 위 숫자를 만든 종목들(제외한 하위 업종의 종목도 포함, 시총 구간 제외만 뺀 것)
  items: HeatmapItem[]
}

// PC 홈의 업종 지도와 모바일 업종 지도·그래프가 같은 숫자를 보이도록 업종 하나의 값을 한 곳에서 만든다.
// computeSectorAverage와 같은 규칙이라 반드시 필터 전 원본 노드를 넘긴다. 시총 구간에 해당하는 종목이 하나도 없으면 null이다.
export function summarizeSector(node: HeatmapSectorNode, excludedTierLabels: Set<string>): SectorSummary | null {
  const average = computeSectorAverage(node, excludedTierLabels)
  if (average.weightedAvg === null) return null
  const items = collectItems(node).filter(item => !isMarketValueExcluded(item, excludedTierLabels))
  const advancers = items.filter(item => item.changeRate > 0).length
  const decliners = items.filter(item => item.changeRate < 0).length
  return {
    weightedAvg: average.weightedAvg,
    simpleAvg: average.simpleAvg,
    marketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0),
    advancers,
    decliners,
    unchanged: items.length - advancers - decliners,
    items,
  }
}
