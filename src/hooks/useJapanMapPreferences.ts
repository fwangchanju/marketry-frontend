import { useMemo } from 'react'
import { useDefaultPreferences } from './useDefaultPreferences'
import { usePageSetting } from './usePageSetting'
import { isJapanMapCapture, japanMapManagedDefaults, japanMapSettingKey, type JapanMapPreferences } from '@/utils/japanMapSettings'

// 일본 지도의 표시 설정 — 코드 기본값 위에 관리자가 정한 기본값(서버)을 얹고, 그 위에 사용자가 바꾼 값을 얹는다.
// 국내 지도와 같이 바꾼 값은 임시값이고 설정창의 저장을 눌러야 계정에 저장된다(usePageSetting). 항목마다 저장 이름이 따로라
// 설정창 항목 제목에 저장 안 한 변경 점이 항목별로 찍힌다. 텔레그램 렌더러는 개인 저장값을 쓰지 않고 관리자가 정한 기본값만 쓴다.
export function useJapanMapPreferences() {
  const defaults = useDefaultPreferences()
  const isCapture = isJapanMapCapture()
  const base = useMemo(() => japanMapManagedDefaults(defaults.data), [defaults.data])
  const [sectorLevelEnabled, setSectorLevelEnabled] = usePageSetting(japanMapSettingKey('sectorLevelEnabled'), base.sectorLevelEnabled)
  const [maxDepth, setMaxDepth] = usePageSetting<number | null>(japanMapSettingKey('maxDepth'), base.maxDepth)
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(japanMapSettingKey('depthMetricEnabled'), base.depthMetricEnabled)
  const [activeDepthMetric, setActiveDepthMetric] = usePageSetting(japanMapSettingKey('activeDepthMetric'), base.activeDepthMetric)
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting(japanMapSettingKey('depthMetricMinIndex'), base.depthMetricMinIndex)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting(japanMapSettingKey('depthMetricMaxIndex'), base.depthMetricMaxIndex)
  const [boxSizeMarketCapRatio, setBoxSizeMarketCapRatio] = usePageSetting(japanMapSettingKey('boxSizeMarketCapRatio'), base.boxSizeMarketCapRatio)
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting(japanMapSettingKey('stockLabelEnabled'), base.stockLabelEnabled)
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting(japanMapSettingKey('stockLabelModeIndex'), base.stockLabelModeIndex)
  const [decimalPlaces, setDecimalPlaces] = usePageSetting(japanMapSettingKey('decimalPlaces'), base.decimalPlaces)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting(japanMapSettingKey('topPickEnabled'), base.topPickEnabled)
  const [topPickDepth, setTopPickDepth] = usePageSetting(japanMapSettingKey('topPickDepth'), base.topPickDepth)
  const [topPickCount, setTopPickCount] = usePageSetting(japanMapSettingKey('topPickCount'), base.topPickCount)
  const preferences = useMemo<JapanMapPreferences>(
    () => (isCapture
      ? base
      : { ...base, sectorLevelEnabled, maxDepth, depthMetricEnabled, activeDepthMetric, depthMetricMinIndex, depthMetricMaxIndex, boxSizeMarketCapRatio, stockLabelEnabled, stockLabelModeIndex, decimalPlaces, topPickEnabled, topPickDepth, topPickCount }),
    [isCapture, base, sectorLevelEnabled, maxDepth, depthMetricEnabled, activeDepthMetric, depthMetricMinIndex, depthMetricMaxIndex, boxSizeMarketCapRatio, stockLabelEnabled, stockLabelModeIndex, decimalPlaces, topPickEnabled, topPickDepth, topPickCount],
  )
  const update = (changes: Partial<JapanMapPreferences>) => {
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
  return { preferences, update, isLoadingDefaults: defaults.isLoading }
}
