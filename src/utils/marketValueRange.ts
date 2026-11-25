import type { MarketValueExclusions } from './marketValueTier.ts'

type Tier = { thresholdValue: number }

// 저장된 금액(상한 null은 무제한)이 눈금의 어디인지. 모든 시장이 같은 식을 쓴다. 저장 이름과 기본값은 시장이 정한다.
export function valueRangeIndexes(tiers: readonly Tier[], minValue: number, maxValue: number | null): { minIndex: number; maxIndex: number } {
  const minIndex = tiers.findLastIndex(tier => tier.thresholdValue <= minValue)
  return { minIndex, maxIndex: Math.max(minIndex, tiers.findLastIndex(tier => maxValue === null || tier.thresholdValue < maxValue)) }
}

export function valueRangeAt(tiers: readonly Tier[], minIndex: number, maxIndex: number): { min: number; max: number | null } {
  return { min: tiers[minIndex].thresholdValue, max: tiers[maxIndex + 1]?.thresholdValue ?? null }
}

export function valueRangeExclusions(tiers: readonly Tier[], minIndex: number, maxIndex: number): MarketValueExclusions {
  return Object.assign(new Set<string>(), { marketValueRange: valueRangeAt(tiers, minIndex, maxIndex) })
}
