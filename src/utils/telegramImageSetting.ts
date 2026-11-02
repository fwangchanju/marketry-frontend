import { MEMBER_DEFAULTS } from './settingDefaults.ts'
import { marketValueSliderSteps } from './marketValueTier.ts'
import type { TelegramImageLegacySetting } from '../api/adminTelegram.ts'
import type { TelegramImageValues } from '../hooks/useTelegramImageSetting.ts'

export function resolveTelegramPreference<T>(capture: boolean, values: Record<string, unknown> | undefined, key: string, fallback: T): T {
  if (!capture || !values) return fallback
  if (Object.hasOwn(values, key)) return values[key] as T
  const legacyKey = key.startsWith('heatmap.profile.marketry.')
    ? `heatmap.${key.slice('heatmap.profile.marketry.'.length)}`
    : key
  return Object.hasOwn(values, legacyKey) ? values[legacyKey] as T : fallback
}

// 별도 발송값이 아직 없을 때 렌더러 소유자 설정의 기본값과 옛 범위 인덱스를 현재 표시값으로 풀어낸다.
export function legacyTelegramImageValues(legacy: TelegramImageLegacySetting): TelegramImageValues {
  const p = legacy.preferences
  const get = (key: string, fallback: unknown) => Object.hasOwn(p, key) ? p[key] : fallback
  const base = legacy.tiers
  const steps = marketValueSliderSteps(base)
  const defaultMin = Math.max(0, base.length - 3)
  const legacyMin = Number(get('heatmap.tierRangeMinIndex', -1))
  const legacyMax = Number(get('heatmap.tierRangeMaxIndex', -1))
  const minIndex = legacyMin >= 0 ? legacyMin : defaultMin
  const maxIndex = legacyMax >= 0 ? legacyMax : base.length - 1
  const rawMin = Number(get('heatmap.tierRangeMinValue', -1))
  const rawMax = get('heatmap.tierRangeMaxValue', -1) as number | null
  const min = rawMin >= 0 ? rawMin : (base[minIndex]?.thresholdValue ?? 0)
  const max = rawMax !== -1 ? rawMax : (base[maxIndex + 1]?.thresholdValue ?? null)
  const stepMin = steps.findLastIndex(tier => tier.thresholdValue <= min)
  const stepMax = Math.max(stepMin, steps.findLastIndex(tier => max === null || tier.thresholdValue < max))
  const metric = get('heatmap.activeDepthMetric', MEMBER_DEFAULTS.depthMetric)
  const mode = get('heatmap.stockLabelModeIndex', MEMBER_DEFAULTS.stockLabelModeIndex)
  const count = get('heatmap.topPickCount', MEMBER_DEFAULTS.topPickCount)
  const color = get('heatmap.strongIndustryColor', MEMBER_DEFAULTS.strongIndustryColor)
  return {
    preferences: {
      'heatmap.tierRangeMinValue': steps[stepMin]?.thresholdValue ?? 0,
      'heatmap.tierRangeMaxValue': steps[stepMax + 1]?.thresholdValue ?? null,
      'heatmap.sectorFilterEnabled': get('heatmap.sectorFilterEnabled', MEMBER_DEFAULTS.sectorFilterEnabled),
      'heatmap.sectorLevelEnabled': get('heatmap.sectorLevelEnabled', MEMBER_DEFAULTS.sectorLevelEnabled),
      'heatmap.selectedMaxDepth': get('heatmap.selectedMaxDepth', MEMBER_DEFAULTS.maxDepth),
      'heatmap.activeDepthMetric': metric,
      'heatmap.depthMetricEnabled': get('heatmap.depthMetricEnabled', metric !== null),
      'heatmap.depthMetricMinIndex': get('heatmap.depthMetricMinIndex', MEMBER_DEFAULTS.depthMetricMinIndex),
      'heatmap.depthMetricMaxIndex': get('heatmap.depthMetricMaxIndex', MEMBER_DEFAULTS.depthMetricMaxIndex),
      'heatmap.boxSizeMarketCapRatio': get('heatmap.boxSizeMarketCapRatio', MEMBER_DEFAULTS.boxSizeMarketCapRatio),
      'heatmap.stockLabelModeIndex': mode,
      'heatmap.stockLabelEnabled': get('heatmap.stockLabelEnabled', mode !== 0),
      'heatmap.decimalPlacesIndex': get('heatmap.decimalPlacesIndex', MEMBER_DEFAULTS.decimalPlacesIndex),
      'heatmap.strongIndustryColor': color === '#eab308' ? MEMBER_DEFAULTS.strongIndustryColor : color,
      'heatmap.topPickDepth': get('heatmap.topPickDepth', MEMBER_DEFAULTS.topPickDepth),
      'heatmap.topPickCount': count,
      'heatmap.topPickEnabled': get('heatmap.topPickEnabled', count !== 0),
    },
    excludedSectors: legacy.excludedSectors,
  }
}
