export interface SectorLayoutWeightInput {
  marketValue: number
}

// 업종 칸의 목표 면적을 현재 표시 중인 전체 형제 칸 기준으로 계산한다.
// 0은 균등 배분, 100은 시총 비례, 중간값은 두 면적 비율의 선형 보간이다.
export function calculateSectorLayoutWeights<T extends SectorLayoutWeightInput>(items: T[], marketCapRatio: number): number[] {
  if (items.length === 0) return []

  const equalShare = 1 / items.length
  const totalMarketValue = items.reduce((sum, item) => sum + Math.max(item.marketValue, 0), 0)
  const ratio = Math.max(0, Math.min(100, marketCapRatio)) / 100

  return items.map(item => {
    const marketCapShare = totalMarketValue > 0 ? Math.max(item.marketValue, 0) / totalMarketValue : equalShare
    return equalShare * (1 - ratio) + marketCapShare * ratio
  })
}
