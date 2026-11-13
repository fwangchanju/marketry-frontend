import { usePageSetting } from './usePageSetting'
import { USA_MAP_DEFAULTS, usaMapSettingKey, type UsaMapPreferences } from '@/utils/usaMapSettings'

// 미국 지도의 표시 설정 — 코드 기본값 위에 사용자가 바꾼 값을 얹는다. 일본 지도와 달리 관리자 기본값은 아직 없다.
// 바꾼 값은 임시값이고 설정창의 저장을 눌러야 계정에 저장된다(usePageSetting). 항목마다 저장 이름이 따로라 설정창 항목 제목에
// 저장 안 한 변경 점이 항목별로 찍힌다.
export function useUsaMapPreferences() {
  const base = USA_MAP_DEFAULTS
  const [sectorLevelEnabled, setSectorLevelEnabled] = usePageSetting(usaMapSettingKey('sectorLevelEnabled'), base.sectorLevelEnabled)
  const [maxDepth, setMaxDepth] = usePageSetting<number | null>(usaMapSettingKey('maxDepth'), base.maxDepth)
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(usaMapSettingKey('depthMetricEnabled'), base.depthMetricEnabled)
  const [activeDepthMetric, setActiveDepthMetric] = usePageSetting(usaMapSettingKey('activeDepthMetric'), base.activeDepthMetric)
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting(usaMapSettingKey('depthMetricMinIndex'), base.depthMetricMinIndex)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting(usaMapSettingKey('depthMetricMaxIndex'), base.depthMetricMaxIndex)
  const [boxSizeMarketCapRatio, setBoxSizeMarketCapRatio] = usePageSetting(usaMapSettingKey('boxSizeMarketCapRatio'), base.boxSizeMarketCapRatio)
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting(usaMapSettingKey('stockLabelEnabled'), base.stockLabelEnabled)
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting(usaMapSettingKey('stockLabelModeIndex'), base.stockLabelModeIndex)
  const [decimalPlaces, setDecimalPlaces] = usePageSetting(usaMapSettingKey('decimalPlaces'), base.decimalPlaces)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting(usaMapSettingKey('topPickEnabled'), base.topPickEnabled)
  const [topPickDepth, setTopPickDepth] = usePageSetting(usaMapSettingKey('topPickDepth'), base.topPickDepth)
  const [topPickCount, setTopPickCount] = usePageSetting(usaMapSettingKey('topPickCount'), base.topPickCount)
  const preferences: UsaMapPreferences = { ...base, sectorLevelEnabled, maxDepth, depthMetricEnabled, activeDepthMetric, depthMetricMinIndex, depthMetricMaxIndex, boxSizeMarketCapRatio, stockLabelEnabled, stockLabelModeIndex, decimalPlaces, topPickEnabled, topPickDepth, topPickCount }
  const update = (changes: Partial<UsaMapPreferences>) => {
    if ('sectorLevelEnabled' in changes) setSectorLevelEnabled(changes.sectorLevelEnabled!)
    if ('maxDepth' in changes) setMaxDepth(changes.maxDepth!)
    if ('depthMetricEnabled' in changes) setDepthMetricEnabled(changes.depthMetricEnabled!)
    if ('activeDepthMetric' in changes) setActiveDepthMetric(changes.activeDepthMetric!)
    if ('depthMetricMinIndex' in changes) setDepthMetricMinIndex(changes.depthMetricMinIndex!)
    if ('depthMetricMaxIndex' in changes) setDepthMetricMaxIndex(changes.depthMetricMaxIndex!)
    if ('boxSizeMarketCapRatio' in changes) setBoxSizeMarketCapRatio(changes.boxSizeMarketCapRatio!)
    if ('stockLabelEnabled' in changes) setStockLabelEnabled(changes.stockLabelEnabled!)
    if ('stockLabelModeIndex' in changes) setStockLabelModeIndex(changes.stockLabelModeIndex!)
    if ('decimalPlaces' in changes) setDecimalPlaces(changes.decimalPlaces!)
    if ('topPickEnabled' in changes) setTopPickEnabled(changes.topPickEnabled!)
    if ('topPickDepth' in changes) setTopPickDepth(changes.topPickDepth!)
    if ('topPickCount' in changes) setTopPickCount(changes.topPickCount!)
  }
  return { preferences, update }
}
