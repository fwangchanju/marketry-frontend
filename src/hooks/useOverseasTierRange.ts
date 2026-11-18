import { useMemo } from 'react'
import { usePageSetting } from './usePageSetting'
import { overseasMarketValueSteps } from '@/utils/overseasMarketValue'
import type { MarketValueExclusions } from '@/utils/marketValueTier'
import type { CurrencyUnit } from '@/utils/currencyUnit'

const NO_EXCLUSIONS: MarketValueExclusions = new Set<string>()

// 일본·미국 지도의 시가총액 범위 — 값은 금액으로 저장한다(국내 지도와 같은 방식, 상한 null은 무제한).
// 저장 이름은 시장별 접두어('japan.map.'·'usa.map.')에 붙인다. 기본값(0 이상, 상한 없음)은 전체 종목이라 지금 화면과 같다.
export function useOverseasTierRange(settingPrefix: string, unit: CurrencyUnit) {
  const tiers = useMemo(() => overseasMarketValueSteps(unit), [unit])
  const [minValue, setMinValue] = usePageSetting<number>(`${settingPrefix}tierRangeMinValue`, 0)
  const [maxValue, setMaxValue] = usePageSetting<number | null>(`${settingPrefix}tierRangeMaxValue`, null)
  const minIndex = Math.max(0, tiers.findLastIndex(tier => tier.thresholdValue <= minValue))
  const maxIndex = Math.max(minIndex, tiers.findLastIndex(tier => maxValue === null || tier.thresholdValue < maxValue))
  const setRange = (min: number, max: number) => {
    setMinValue(tiers[min].thresholdValue)
    setMaxValue(tiers[max + 1]?.thresholdValue ?? null)
  }
  const excludedMarketValueTiers = useMemo<MarketValueExclusions>(() => {
    if (tiers.length === 0 || (minIndex === 0 && maxIndex === tiers.length - 1)) return NO_EXCLUSIONS
    return Object.assign(new Set<string>(), { marketValueRange: { min: tiers[minIndex].thresholdValue, max: tiers[maxIndex + 1]?.thresholdValue ?? null } })
  }, [tiers, minIndex, maxIndex])
  return { tiers, minIndex, maxIndex, setRange, excludedMarketValueTiers }
}
