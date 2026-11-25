import { usePageSetting } from '@/hooks/usePageSetting'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import type { OverseasSheet } from '@/hooks/useOverseasSheet'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import type { OverseasMarket } from '@/utils/markets'
import { overseasSettingKey } from '@/utils/overseasSettingKey'

// 스냅샷 시장의 그래프 표시 설정. 바꾼 값은 임시값이고 설정창의 저장을 눌러야 계정에 저장된다(usePageSetting).
// 비교 시점의 분 수는 저장 대상이 아니라 이 브라우저에만 둔다.
export function useSnapshotGraphPreferences(market: OverseasMarket, sheet: OverseasSheet) {
  const prefix = SNAPSHOT_MARKETS[market].graphSettingPrefix
  const keyOf = (name: string) => overseasSettingKey(`${prefix}${name}`, sheet)
  const [graphMode, setGraphMode] = usePageSetting<'current' | 'delta'>(keyOf('graphMode'), 'current')
  const [groupDepth, setGroupDepth] = usePageSetting(keyOf('groupDepth'), 1)
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting(keyOf('avgChangeRateUseSimple'), false)
  const [beforeMinutes, setBeforeMinutes] = useTransientSetting(`${prefix}beforeMinutes`, 15)
  return { graphMode, setGraphMode, groupDepth, setGroupDepth, avgChangeRateUseSimple, setAvgChangeRateUseSimple, beforeMinutes, setBeforeMinutes }
}

// 설정창 항목이 적어 둔 변경 점 이름을 이 시장의 저장 이름으로 바꾼다.
export function snapshotGraphDraftKeyMap(market: OverseasMarket): Readonly<Record<string, string>> {
  const prefix = SNAPSHOT_MARKETS[market].graphSettingPrefix
  return { 'groupPage.depth': `${prefix}groupDepth`, 'groupPage.graphMode': `${prefix}graphMode`, 'heatmap.avgChangeRateUseSimple': `${prefix}avgChangeRateUseSimple` }
}
