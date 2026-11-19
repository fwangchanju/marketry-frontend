import type { OverseasMarket } from '@/utils/markets'

// 메인 영역 좌상단 시장 배지 오른쪽에 붙이는 국기. 한국 시장(KOREA·KOSPI·KOSDAQ)은 모두 태극기 하나다.
export type MarketFlag = 'KR' | 'JP' | 'US'

export const KOREA_FLAG: MarketFlag = 'KR'

export function flagOfOverseasMarket(market: OverseasMarket): MarketFlag {
  return market === 'JAPAN' ? 'JP' : 'US'
}
