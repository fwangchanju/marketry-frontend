import { useMemo } from 'react'
import { valueRangeAt, valueRangeExclusions, valueRangeIndexes } from '@/utils/marketValueRange'
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
  const found = valueRangeIndexes(tiers, minValue, maxValue)
  const minIndex = Math.max(0, found.minIndex)
  const maxIndex = Math.max(minIndex, found.maxIndex)
  const setRange = (min: number, max: number) => {
    const range = valueRangeAt(tiers, min, max)
    setMinValue(range.min)
    setMaxValue(range.max)
  }
  const excludedMarketValueTiers = useMemo<MarketValueExclusions>(() => {
    if (tiers.length === 0 || (minIndex === 0 && maxIndex === tiers.length - 1)) return NO_EXCLUSIONS
    return valueRangeExclusions(tiers, minIndex, maxIndex)
  }, [tiers, minIndex, maxIndex])
  return { tiers, minIndex, maxIndex, setRange, excludedMarketValueTiers }
}

export type OverseasTierRange = ReturnType<typeof useOverseasTierRange>
