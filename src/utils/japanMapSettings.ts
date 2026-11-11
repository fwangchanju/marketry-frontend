import { createDefaultColorScale } from './heatmapColorScale.ts'
import { settingDefaultsFor } from './settingDefaults.ts'

export type JapanDepthMetric = 'weightedAvgChangeRate' | 'simpleAvgChangeRate' | 'upDownCount' | 'marketValue'

// 일본 지도의 설정 기본값. 국내 지도의 설정·기본값을 따르지 않는다.
export const JAPAN_MAP_DEFAULTS = {
  sectorLevelEnabled: true,
  maxDepth: 2 as number | null, // 중분류까지
  depthMetricEnabled: true,
  activeDepthMetric: 'weightedAvgChangeRate' as JapanDepthMetric,
  depthMetricMinIndex: 0,
  depthMetricMaxIndex: 1, // 대분류~중분류
  boxSizeMarketCapRatio: 100, // 시가총액에 비례
  stockLabelEnabled: true,
  stockLabelModeIndex: 3, // 이름과 등락률
  decimalPlaces: 1,
  // 상위 업종 강조 — 국내 지도의 MARKETRY 기본값과 같다(중분류 기준 3개). 일본 지도의 이 브라우저에만 저장한다.
  topPickEnabled: true,
  topPickDepth: 1,
  topPickCount: 3,
}
export type JapanMapPreferences = typeof JAPAN_MAP_DEFAULTS

// 설정 화면이 없는 값은 여기서 고정한다.
export const JAPAN_MAP_FIXED = {
  boxLabelMinAreaPercent: 0.01,
  stockPopupOnHover: false,
  // 국내 지도 MARKETRY 모드의 강조 색상과 같은 값을 그대로 쓴다(청록). 일본 지도·그래프의 업종명과 상위 업종 강조가 같은 색이다.
  strongIndustryColor: settingDefaultsFor(false, 'marketry').strongIndustryColor,
  colorScale: createDefaultColorScale(),
} as const

export const JAPAN_MAP_PREFERENCES_STORAGE = 'marketry:japan-map-settings'

// 저장된 값 중 형식이 맞는 것만 쓰고 나머지는 기본값으로 둔다.
export function readJapanMapPreferences(stored: string | null): JapanMapPreferences {
  if (!stored) return { ...JAPAN_MAP_DEFAULTS }
  try {
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== 'object' || parsed === null) return { ...JAPAN_MAP_DEFAULTS }
    const source = parsed as Record<string, unknown>
    const result: Record<string, unknown> = { ...JAPAN_MAP_DEFAULTS }
    for (const [key, fallback] of Object.entries(JAPAN_MAP_DEFAULTS)) {
      const value = source[key]
      if (value === null ? key === 'maxDepth' : typeof value === typeof fallback || (key === 'maxDepth' && typeof value === 'number')) {
        if (value !== undefined) result[key] = value
      }
    }
    return result as JapanMapPreferences
  } catch {
    return { ...JAPAN_MAP_DEFAULTS }
  }
}

// 설정창이 고른 탭을 기억하는 이름. 국내 화면과 겹치지 않게 일본 화면마다 따로 둔다.
export const JAPAN_REFRESH_HELP = '09:18부터 5분 간격으로 데이터를 수집합니다.\n시세는 약 20분 지연되어 반영됩니다.'

export const JAPAN_SETTINGS_TAB_STORAGE = { map: 'JapanMap', graph: 'JapanGraph', stock: 'JapanStock', sector: 'JapanSector' } as const

// 일본 화면의 Basis는 MARKETRY만 제공해서 다른 분류를 고를 수 없다. 공통 선택 영역에 넘기는 빈 동작이다.
export const NO_TAXONOMY_CHANGE = () => {}
