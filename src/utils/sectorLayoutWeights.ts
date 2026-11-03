export interface SectorLayoutWeightInput {
  marketValue: number
}

export const MOBILE_BALANCED_BOX_SIZE_RATIO = 60

// 이전 설정에서 균형으로 저장된 50·65·70·75는 새 균형값 60으로 읽는다.
export function normalizeMobileBoxSizeRatio(ratio: number): number {
  return ratio === 50 || ratio === 65 || ratio === 70 || ratio === 75 ? MOBILE_BALANCED_BOX_SIZE_RATIO : ratio
}

// 업종 총시총에 설정 비율을 지수로 적용한다. 0은 업종별 동일 가중치, 50은 업종 총시총의 제곱근,
// 현재 균형값 60은 0.6제곱, 100은 업종 총시총이다. MobileSectorMap이 형제 칸 사이에서 면적 비율로 정규화한다.
export function calculateSectorLayoutWeights<T extends SectorLayoutWeightInput>(items: T[], marketCapRatio: number): number[] {
  if (items.length === 0) return []

  const ratio = Math.max(0, Math.min(100, marketCapRatio)) / 100
  if (items.every(item => item.marketValue <= 0)) return items.map(() => 1)

  return items.map(item => Math.pow(Math.max(item.marketValue, 0), ratio))
}
