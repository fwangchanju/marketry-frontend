import { useMemo } from 'react'
import { usePageSetting } from './usePageSetting'
import { usePersistedState } from './usePersistedState'
import { japanGraphSettingKey, type JapanGraphPreferences } from '@/utils/japanGraphSettings'

// 일본 그래프의 표시 설정 — 국내 그래프(섹터 페이지)와 같이 바꾼 값은 임시값이고 설정창의 저장을 눌러야 계정에 저장된다(usePageSetting).
// 항목마다 저장 이름이 따로라 설정창 항목 제목에 저장 안 한 변경 점이 항목별로 찍힌다.
// 비교 시점의 분 수는 국내 그래프처럼 저장 대상이 아니라 이 브라우저에만 둔다.
export function useJapanGraphPreferences() {
  const [graphMode, setGraphMode] = usePageSetting<JapanGraphPreferences['graphMode']>(japanGraphSettingKey('graphMode'), 'current')
  const [groupDepth, setGroupDepth] = usePageSetting(japanGraphSettingKey('groupDepth'), 1)
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting(japanGraphSettingKey('avgChangeRateUseSimple'), false)
  const [beforeMinutes, setBeforeMinutes] = usePersistedState('japan.graph.beforeMinutes', 15)
  const preferences = useMemo<JapanGraphPreferences>(
    () => ({ graphMode, groupDepth, avgChangeRateUseSimple, beforeMinutes }),
    [graphMode, groupDepth, avgChangeRateUseSimple, beforeMinutes],
  )
  const update = (changes: Partial<JapanGraphPreferences>) => {
    if ('graphMode' in changes) setGraphMode(changes.graphMode!)
    if ('groupDepth' in changes) setGroupDepth(changes.groupDepth!)
    if ('avgChangeRateUseSimple' in changes) setAvgChangeRateUseSimple(changes.avgChangeRateUseSimple!)
    if ('beforeMinutes' in changes) setBeforeMinutes(changes.beforeMinutes!)
  }
  return { preferences, update }
}
