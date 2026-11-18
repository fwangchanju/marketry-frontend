import type { MarketValueTierItem } from '@/types/api'
import type { CurrencyUnit } from './currencyUnit.ts'

// 일본·미국 지도의 시가총액 범위 눈금(현지 통화 금액, 오름차순). 한국처럼 소형주·중형주 같은 이름은 붙이지 않는다 —
// 닛케이225·S&P500은 원래 상위 종목만 모은 목록이라 대·중·소로 나누면 어색해서, 눈금마다 금액만 보여 준다.
// 첫 눈금 0은 "하한 없음"이다.
export const OVERSEAS_MARKET_VALUE_THRESHOLDS: Record<Exclude<CurrencyUnit, '원'>, readonly number[]> = {
  엔: [0, 50_000_000_000, 500_000_000_000], // 500억 엔, 5,000억 엔
  달러: [0, 10_000_000_000, 100_000_000_000], // 100억 달러, 1,000억 달러
}

// 슬라이더가 쓰는 눈금 목록. 이름(label)은 비워 두어 눈금 아래 구간 이름이 나오지 않게 한다.
export function overseasMarketValueSteps(unit: CurrencyUnit): MarketValueTierItem[] {
  if (unit === '원') return []
  return OVERSEAS_MARKET_VALUE_THRESHOLDS[unit].map((thresholdValue, index) => ({ id: -index - 1, label: '', thresholdValue, isExcludedByDefault: false }))
}
