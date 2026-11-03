import type { HeatmapItem, HeatmapSectorNode } from '@/types/api'
import { isMarketValueExcluded } from './marketValueTier.ts'

export interface MobileSectorSummary {
  marketValue: number
  weightedAvg: number
  simpleAvg: number | null
  advancers: number
  decliners: number
  unchanged: number
  items: HeatmapItem[]
}

// 모바일 업종 카드에 필요한 집계를 모바일 전용으로 계산한다. 분류 트리 안에서 같은 종목코드가 반복되어도 한 번만 합산한다.
export function summarizeMobileSector(node: HeatmapSectorNode, excludedTiers: Set<string>): MobileSectorSummary | null {
  const uniqueItems = new Map<string, HeatmapItem>()
  const collect = (current: HeatmapSectorNode) => {
    for (const item of current.items) {
      if (!isMarketValueExcluded(item, excludedTiers)) uniqueItems.set(item.stockCode, item)
    }
    current.children.forEach(collect)
  }
  collect(node)

  const items = [...uniqueItems.values()]
  const marketValue = items.reduce((sum, item) => sum + item.totalMarketValue, 0)
  if (marketValue <= 0) return null
  const weightedAvg = items.reduce((sum, item) => sum + item.changeRate * item.totalMarketValue, 0) / marketValue
  const simpleAvg = items.length ? items.reduce((sum, item) => sum + item.changeRate, 0) / items.length : null
  const advancers = items.filter(item => item.changeRate > 0).length
  const decliners = items.filter(item => item.changeRate < 0).length
  return { marketValue, weightedAvg, simpleAvg, advancers, decliners, unchanged: items.length - advancers - decliners, items }
}
