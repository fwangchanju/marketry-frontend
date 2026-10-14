import { useMemo } from 'react'
import { usePageSetting } from './usePageSetting'
import { useIsLoggedIn } from './useSession'
import { useCustomPreferences } from './useCustomPreferences'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import { useMarketValueTiers } from './useMarketValueTiers'
import { defaultExcludedTierLabels, tierRangeToExcludedLabels } from '@/utils/marketValueTier'

const MIN_INDEX_KEY = 'treemap.tierRangeMinIndex'
const MAX_INDEX_KEY = 'treemap.tierRangeMaxIndex'

// 시가총액 구간(오름차순 tiers 배열 기준) 범위 필터 — 마켓맵 화면과 섹터 랭킹 화면이 세션스토리지
// 키를 그대로 공유해서, 한쪽에서 바꾼 토글 상태가 다른 화면에도 항상 똑같이 반영된다(두 화면 모두
// 배포 전 운영 수치와 일치해야 한다는 요구사항 때문에 상태를 분리해두면 안 됨).
// enabled=false면(예: 기본 분류 트리 모드) 필터 자체를 적용하지 않는다.
export function useMarketValueTierRange(enabled: boolean) {
  const isLoggedIn = useIsLoggedIn()
  const { isLoaded: isPreferencesLoaded } = useCustomPreferences()
  const { data: valueTiersData, isSuccess: isValueTiersSuccess } = useMarketValueTiers()
  const tiers = useMemo(() => valueTiersData ?? [], [valueTiersData])

  // -1 = tiers를 아직 못 받아와서 기본값을 못 정한 상태. tiers가 도착하면 아래 useEffect가
  // isExcludedByDefault 기준으로 딱 한 번만 채운다(이미 저장된 값이 있으면 건드리지 않음). 로그인
  // 사용자는 이 값이 서버 user_preference에 저장된다(usePageSetting).
  const [storedMinIndex, setMinIndex] = usePageSetting(MIN_INDEX_KEY, -1)
  const [storedMaxIndex, setMaxIndex] = usePageSetting(MAX_INDEX_KEY, -1)

  // 저장된 값이 없을 때의 기본 범위는 값을 써 넣지 않고 계산만 한다 — 써 넣으면 사용자가 바꾸지 않았는데도 "저장 안 된
  // 변경"이 생기고, 서버 설정이 도착하기 전에 기본값이 저장값을 덮어쓴다.
  const defaultRange = useMemo(() => {
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
  }, [tiers, isLoggedIn])

  const minIndex = storedMinIndex !== -1 ? storedMinIndex : (defaultRange?.min ?? -1)
  const maxIndex = storedMaxIndex !== -1 ? storedMaxIndex : (defaultRange?.max ?? -1)

  const excludedMarketValueTiers = useMemo(
    () =>
      enabled && tiers.length > 0 && minIndex !== -1
        ? tierRangeToExcludedLabels(tiers, minIndex, maxIndex)
        : new Set<string>(),
    [enabled, tiers, minIndex, maxIndex],
  )

  // 구간 준비됨(marketry-frontend 지시서 결정 4) — 커스텀 모드가 아니면(구간 필터 자체가
  // 꺼져 있다) 항상 준비된 것으로 본다. 커스텀 모드면 value-tiers 조회가 끝나고, 구간이 아예
  // 없거나(minIndex를 정할 필요가 없음) minIndex가 채워진 뒤에야 준비됐다고 본다. 그 전에
  // 캡처되면(data-capture-ready) 소형주가 포함된 숫자가 찍히는데, 캡션(백엔드)은 그 구간을 뺀다.
  const isTierRangeReady = !enabled || ((!isLoggedIn || isPreferencesLoaded) && isValueTiersSuccess && (tiers.length === 0 || minIndex !== -1))

  return { tiers, minIndex, maxIndex, setMinIndex, setMaxIndex, excludedMarketValueTiers, isTierRangeReady }
}
