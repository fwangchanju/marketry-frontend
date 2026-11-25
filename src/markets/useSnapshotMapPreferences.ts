import { useMemo } from 'react'
import type { OverseasSheet } from '@/hooks/useOverseasSheet'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import type { OverseasMarket } from '@/utils/markets'
import { overseasSettingKey } from '@/utils/overseasSettingKey'
import { useDefaultPreferences } from '@/hooks/useDefaultPreferences'
import { usePageSetting } from '@/hooks/usePageSetting'
import type { JapanMapPreferences } from '@/utils/japanMapSettings'

// 스냅샷 시장의 지도 표시 설정 — 코드 기본값 위에 관리자가 정한 기본값(서버)을 얹고, 그 위에 사용자가 바꾼 값을 얹는다.
// 바꾼 값은 임시값이고 설정창의 저장을 눌러야 계정에 저장된다(usePageSetting). 항목마다 저장 이름이 따로라
// 설정창 항목 제목에 저장 안 한 변경 점이 항목별로 찍힌다. 텔레그램 렌더러는 개인 저장값을 쓰지 않고 관리자가 정한 기본값만 쓴다.
export function useSnapshotMapPreferences(market: OverseasMarket, sheet: OverseasSheet) {
  const { settingPrefix, mapDefaults, isMapCapture } = SNAPSHOT_MARKETS[market]
  const settingKey = (name: keyof JapanMapPreferences) => overseasSettingKey(`${settingPrefix}${name}`, sheet)
  const defaults = useDefaultPreferences()
  const isCapture = isMapCapture()
  const base = useMemo(() => mapDefaults(defaults.data), [mapDefaults, defaults.data])
  const [sectorLevelEnabled, setSectorLevelEnabled] = usePageSetting(settingKey('sectorLevelEnabled'), base.sectorLevelEnabled)
  const [maxDepth, setMaxDepth] = usePageSetting<number | null>(settingKey('maxDepth'), base.maxDepth)
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(settingKey('depthMetricEnabled'), base.depthMetricEnabled)
  const [activeDepthMetric, setActiveDepthMetric] = usePageSetting(settingKey('activeDepthMetric'), base.activeDepthMetric)
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting(settingKey('depthMetricMinIndex'), base.depthMetricMinIndex)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting(settingKey('depthMetricMaxIndex'), base.depthMetricMaxIndex)
  const [boxSizeMarketCapRatio, setBoxSizeMarketCapRatio] = usePageSetting(settingKey('boxSizeMarketCapRatio'), base.boxSizeMarketCapRatio)
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting(settingKey('stockLabelEnabled'), base.stockLabelEnabled)
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting(settingKey('stockLabelModeIndex'), base.stockLabelModeIndex)
  const [decimalPlaces, setDecimalPlaces] = usePageSetting(settingKey('decimalPlaces'), base.decimalPlaces)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting(settingKey('topPickEnabled'), base.topPickEnabled)
  const [topPickDepth, setTopPickDepth] = usePageSetting(settingKey('topPickDepth'), base.topPickDepth)
  const [topPickCount, setTopPickCount] = usePageSetting(settingKey('topPickCount'), base.topPickCount)
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
