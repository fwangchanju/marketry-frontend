import type { MarketValueTierItem, TreemapItem } from '@/types/api'

// 등급명 제외와 금액 범위 제외를 함께 전달한다. 기존 Set만 넘기는 호출자는 등급명 기준을 유지한다.
export type MarketValueExclusions = Set<string> & {
  marketValueRange?: { min: number; max: number | null }
}

export function isMarketValueExcluded(
  item: Pick<TreemapItem, 'marketValueTier' | 'totalMarketValue'>,
  exclusions: MarketValueExclusions,
): boolean {
  const range = exclusions.marketValueRange
  return range
    ? item.totalMarketValue < range.min || (range.max !== null && item.totalMarketValue >= range.max)
    : exclusions.has(item.marketValueTier)
}

// 중간 눈금에는 등급명을 추가하지 않는다. 서버의 기존 등급 정의는 그대로 둔다.
export function marketValueSliderSteps(tiers: MarketValueTierItem[]): MarketValueTierItem[] {
  if (tiers.length === 0) return []
  const extra = [300_000_000_000, 1_000_000_000_000, 10_000_000_000_000]
    .filter(value => value > tiers[0].thresholdValue && !tiers.some(tier => tier.thresholdValue === value))
    .map((thresholdValue, index) => ({ id: -index - 1, label: '', thresholdValue, isExcludedByDefault: false }))
  return [...tiers, ...extra].sort((a, b) => a.thresholdValue - b.thresholdValue)
}

// 시가총액 구간 정의는 더 이상 프론트 하드코딩이 아니라 GET /map/value-tiers 조회 결과
// (useMarketValueTiers)를 그대로 쓴다 — thresholdValue 오름차순으로 내려온다는 게 백엔드 계약.
// 이 파일은 그 목록을 필터링에 쓰기 위한 순수 변환 함수만 모아둔다.

// 화면 진입 시 필터 토글의 초기 상태 — 이후 사용자가 바꾼 상태는 프론트가 직접 관리(세션스토리지)한다.
export function defaultExcludedTierLabels(tiers: MarketValueTierItem[]): Set<string> {
  return new Set(tiers.filter(tier => tier.isExcludedByDefault).map(tier => tier.label))
}

// 오름차순 정렬된 tiers 배열의 [minIndex, maxIndex] 구간(포함) 밖에 있는 등급만 제외 대상으로 변환한다.
export function tierRangeToExcludedLabels(
  tiers: MarketValueTierItem[],
  minIndex: number,
  maxIndex: number,
): Set<string> {
  return new Set(tiers.filter((_, index) => index < minIndex || index > maxIndex).map(tier => tier.label))
}
