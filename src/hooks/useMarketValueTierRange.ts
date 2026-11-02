import { useMemo } from 'react'
import { usePageSetting } from './usePageSetting'
import { useIsLoggedIn } from './useSession'
import { useCustomPreferences } from './useCustomPreferences'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import { useMarketValueTiers } from './useMarketValueTiers'
import { defaultExcludedTierLabels, marketValueSliderSteps } from '@/utils/marketValueTier'
import { profileSettingKey, type SettingsProfile } from '@/utils/settingsSchema'

const MIN_INDEX_KEY = 'heatmap.tierRangeMinIndex'
const MAX_INDEX_KEY = 'heatmap.tierRangeMaxIndex'

// 시가총액 구간은 선택한 분류 프로필별로 저장하고, 같은 분류의 지도와 섹터 랭킹은 값을 공유한다.
// enabled=false면(예: 기본 분류 트리 모드) 필터 자체를 적용하지 않는다.
export function useMarketValueTierRange(enabled: boolean, profile: SettingsProfile) {
  const isLoggedIn = useIsLoggedIn()
  const { isLoaded: isPreferencesLoaded } = useCustomPreferences()
  const { data: valueTiersData, isSuccess: isValueTiersSuccess } = useMarketValueTiers()
  const baseTiers = useMemo(() => valueTiersData ?? [], [valueTiersData])
  const tiers = useMemo(() => marketValueSliderSteps(baseTiers), [baseTiers])

  // 예전에 저장한 인덱스는 원래 등급 목록으로 해석한다. 새 선택은 금액으로 저장해서,
  // 눈금 추가로 기존 사용자 범위가 달라지지 않도록 한다(-1은 미설정, 상한 null은 무제한).
  const [storedMinIndex] = usePageSetting(profileSettingKey(profile, MIN_INDEX_KEY), -1)
  const [storedMaxIndex] = usePageSetting(profileSettingKey(profile, MAX_INDEX_KEY), -1)
  const [storedMinValue, setMinValue] = usePageSetting(profileSettingKey(profile, 'heatmap.tierRangeMinValue'), -1)
  const [storedMaxValue, setMaxValue] = usePageSetting<number | null>(profileSettingKey(profile, 'heatmap.tierRangeMaxValue'), -1)

  // 저장된 값이 없을 때의 기본 범위는 값을 써 넣지 않고 계산만 한다 — 써 넣으면 사용자가 바꾸지 않았는데도 "저장 안 된
  // 변경"이 생기고, 서버 설정이 도착하기 전에 기본값이 저장값을 덮어쓴다.
  const defaultRange = useMemo(() => {
    const tiers = baseTiers
    if (tiers.length === 0) return null
    // 기본 범위는 utils/settingDefaults.ts의 tierRange를 따른다 — 'all'은 모든 구간, 'topTwoTiers'는 가장 큰 두 구간,
    // 그 밖에는 기본 제외 구간(소형주)만 뺀다.
    const tierRange = settingDefaultsFor(isLoggedIn).tierRange
    if (tierRange === 'all') return { min: 0, max: tiers.length - 1 }
    if (tierRange === 'topThreeTiers') return { min: Math.max(0, tiers.length - 3), max: tiers.length - 1 }
    if (tierRange === 'topTwoTiers') return { min: Math.max(0, tiers.length - 2), max: tiers.length - 1 }
    const excludedLabels = defaultExcludedTierLabels(tiers)
    const first = tiers.findIndex(tier => !excludedLabels.has(tier.label))
    const last = tiers.findLastIndex(tier => !excludedLabels.has(tier.label))
    return { min: first === -1 ? 0 : first, max: last === -1 ? tiers.length - 1 : last }
  }, [baseTiers, isLoggedIn])

  const legacyMinIndex = storedMinIndex !== -1 ? storedMinIndex : (defaultRange?.min ?? -1)
  const legacyMaxIndex = storedMaxIndex !== -1 ? storedMaxIndex : (defaultRange?.max ?? -1)
  const minValue = storedMinValue >= 0 ? storedMinValue : (baseTiers[legacyMinIndex]?.thresholdValue ?? 0)
  const maxValue = storedMaxValue !== -1 ? storedMaxValue : (baseTiers[legacyMaxIndex + 1]?.thresholdValue ?? null)
  const minIndex = tiers.findLastIndex(tier => tier.thresholdValue <= minValue)
  const maxIndex = Math.max(minIndex, tiers.findLastIndex(tier => maxValue === null || tier.thresholdValue < maxValue))
  const setMinIndex = (index: number) => setMinValue(tiers[index].thresholdValue)
  const setMaxIndex = (index: number) => setMaxValue(tiers[index + 1]?.thresholdValue ?? null)

  const excludedMarketValueTiers = useMemo(
    () =>
      enabled && tiers.length > 0 && minIndex !== -1
        ? Object.assign(new Set<string>(), { marketValueRange: {
            min: tiers[minIndex].thresholdValue,
            max: tiers[maxIndex + 1]?.thresholdValue ?? null,
          } })
        : new Set<string>(),
    [enabled, tiers, minIndex, maxIndex],
  )

  // 구간 준비됨(marketry-frontend 지시서 결정 4) — 커스텀 모드가 아니면(구간 필터 자체가
  // 꺼져 있다) 항상 준비된 것으로 본다. 커스텀 모드면 value-tiers 조회가 끝나고, 구간이 아예
  // 없거나(minIndex를 정할 필요가 없음) minIndex가 채워진 뒤에야 준비됐다고 본다. 그 전에
  // 스크린샷에 찍히면(data-capture-ready) 소형주가 포함된 숫자가 찍히는데, 캡션(백엔드)은 그 구간을 뺀다.
  const isTierRangeReady = !enabled || ((!isLoggedIn || isPreferencesLoaded) && isValueTiersSuccess && (tiers.length === 0 || minIndex !== -1))

  return { tiers, minIndex, maxIndex, setMinIndex, setMaxIndex, excludedMarketValueTiers, isTierRangeReady }
}
