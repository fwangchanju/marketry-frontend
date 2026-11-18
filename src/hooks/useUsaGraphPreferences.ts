import { useMemo } from 'react'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { usePageSetting } from './usePageSetting'
import { USA_GRAPH_DEFAULTS, usaGraphSettingKey, type UsaGraphPreferences } from '@/utils/usaGraphSettings'

// 미국 그래프의 표시 설정 — 일본 그래프와 같이 바꾼 값은 임시값이고 설정창의 저장을 눌러야 계정에 저장된다(usePageSetting).
export function useUsaGraphPreferences() {
  const { sheet } = useOverseasSheet()
  const settingKey = (name: Parameters<typeof usaGraphSettingKey>[0]) => overseasSettingKey(usaGraphSettingKey(name), sheet)
  const [groupDepth, setGroupDepth] = usePageSetting(settingKey('groupDepth'), USA_GRAPH_DEFAULTS.groupDepth)
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting(settingKey('avgChangeRateUseSimple'), USA_GRAPH_DEFAULTS.avgChangeRateUseSimple)
  const preferences = useMemo<UsaGraphPreferences>(() => ({ groupDepth, avgChangeRateUseSimple }), [groupDepth, avgChangeRateUseSimple])
  const update = (changes: Partial<UsaGraphPreferences>) => {
    if ('groupDepth' in changes) setGroupDepth(changes.groupDepth!)
    if ('avgChangeRateUseSimple' in changes) setAvgChangeRateUseSimple(changes.avgChangeRateUseSimple!)
  }
  return { preferences, update }
}
