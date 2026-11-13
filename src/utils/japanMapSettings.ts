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

// 일본 지도 설정을 서버에 저장하는 이름 — 국내 지도처럼 설정창의 저장 버튼으로 올라가고 계정에 저장된다.
// 일본 지도 설정은 항목마다 저장 이름을 따로 둔다. 설정창 항목의 저장 안 한 변경 점이 항목별로 찍히게 하기 위해서다.
export const JAPAN_MAP_SETTING_PREFIX = 'japan.map.'
export const japanMapSettingKey = (name: keyof typeof JAPAN_MAP_DEFAULTS) => `${JAPAN_MAP_SETTING_PREFIX}${name}`

// 설정창 항목이 국내 설정 이름으로 적어 둔 변경 점 이름을 일본 지도 저장 이름으로 바꾼다.
export const JAPAN_MAP_DRAFT_KEY_MAP: Readonly<Record<string, string>> = {
  'heatmap.sectorLevelEnabled': japanMapSettingKey('sectorLevelEnabled'),
  'heatmap.selectedMaxDepth': japanMapSettingKey('maxDepth'),
  'heatmap.activeDepthMetric': japanMapSettingKey('activeDepthMetric'),
  'heatmap.depthMetricEnabled': japanMapSettingKey('depthMetricEnabled'),
  'heatmap.depthMetricMinIndex': japanMapSettingKey('depthMetricMinIndex'),
  'heatmap.depthMetricMaxIndex': japanMapSettingKey('depthMetricMaxIndex'),
  'heatmap.boxSizeMarketCapRatio': japanMapSettingKey('boxSizeMarketCapRatio'),
  'heatmap.stockLabelEnabled': japanMapSettingKey('stockLabelEnabled'),
  'heatmap.stockLabelModeIndex': japanMapSettingKey('stockLabelModeIndex'),
  'heatmap.decimalPlacesIndex': japanMapSettingKey('decimalPlaces'),
  'heatmap.topPickEnabled': japanMapSettingKey('topPickEnabled'),
  'heatmap.topPickDepth': japanMapSettingKey('topPickDepth'),
  'heatmap.topPickCount': japanMapSettingKey('topPickCount'),
}

// 계정에 저장된 설정에서 일본 지도 항목만 골라 형식이 맞는 것만 돌려준다.
export function japanMapSavedValues(account: Record<string, unknown> | undefined): Partial<JapanMapPreferences> {
  const picked: Record<string, unknown> = {}
  for (const name of Object.keys(JAPAN_MAP_DEFAULTS)) picked[name] = account?.[`${JAPAN_MAP_SETTING_PREFIX}${name}`]
  return pickJapanMapPreferenceValues(picked)
}

// 값 중 이름과 형식이 맞는 것만 골라낸다. 나머지는 버린다.
export function pickJapanMapPreferenceValues(source: unknown): Partial<JapanMapPreferences> {
  if (typeof source !== 'object' || source === null) return {}
  const record = source as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const [key, fallback] of Object.entries(JAPAN_MAP_DEFAULTS)) {
    const value = record[key]
    if (value === undefined) continue
    if (value === null ? key === 'maxDepth' : typeof value === typeof fallback || (key === 'maxDepth' && typeof value === 'number')) {
      result[key] = value
    }
  }
  return result as Partial<JapanMapPreferences>
}

// 관리자가 정한 일본 지도 기본값(서버의 관리 기본값 japan)을 코드 기본값 위에 얹는다. 형식이 맞지 않는 값은 쓰지 않는다.
export function japanMapManagedDefaults(profiles: Record<string, unknown> | undefined): JapanMapPreferences {
  return { ...JAPAN_MAP_DEFAULTS, ...pickJapanMapPreferenceValues(profiles?.japan) }
}

// 기본값 화면(관리자)이 보여 주는 모양 — 국내 MARKETRY·거래소와 같은 줄을 쓰도록 같은 이름('heatmap.*')으로 옮긴다.
// 일본 지도에 없는 항목(시가총액 범위, 업종 제외)은 전체·없음으로 둔다.
export function japanMapDisplayValues(preferences: JapanMapPreferences): { preferences: Record<string, unknown>; excludedSectors: Array<[string, string]> } {
  return {
    preferences: {
      'heatmap.tierRangeMinValue': 0,
      'heatmap.tierRangeMaxValue': null,
      'heatmap.sectorLevelEnabled': preferences.sectorLevelEnabled,
      'heatmap.selectedMaxDepth': preferences.maxDepth,
      'heatmap.activeDepthMetric': preferences.activeDepthMetric,
      'heatmap.depthMetricEnabled': preferences.depthMetricEnabled,
      'heatmap.depthMetricMinIndex': preferences.depthMetricMinIndex,
      'heatmap.depthMetricMaxIndex': preferences.depthMetricMaxIndex,
      'heatmap.boxSizeMarketCapRatio': preferences.boxSizeMarketCapRatio,
      'heatmap.stockLabelEnabled': preferences.stockLabelEnabled,
      'heatmap.stockLabelModeIndex': preferences.stockLabelModeIndex,
      'heatmap.decimalPlacesIndex': preferences.decimalPlaces,
      'heatmap.strongIndustryColor': JAPAN_MAP_FIXED.strongIndustryColor,
      'heatmap.topPickEnabled': preferences.topPickEnabled,
      'heatmap.topPickDepth': preferences.topPickDepth,
      'heatmap.topPickCount': preferences.topPickCount,
    },
    excludedSectors: [],
  }
}

// 관리자가 서버에 저장할 값 — 설정 이름 그대로 모든 항목을 보낸다.
export function japanMapPublishPayload(preferences: JapanMapPreferences): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const key of Object.keys(JAPAN_MAP_DEFAULTS)) payload[key] = preferences[key as keyof JapanMapPreferences]
  return payload
}

// 텔레그램 렌더러가 여는 일본 지도 화면인지. 이때는 이 브라우저의 저장값을 쓰지 않고 관리자가 정한 기본값만 쓴다.
export function isJapanMapCapture() {
  return window.location.pathname === '/map/japan' && new URLSearchParams(window.location.search).get('capture') === 'mobile'
}

// 설정창이 고른 탭을 기억하는 이름. 국내 화면과 겹치지 않게 일본 화면마다 따로 둔다.
export const JAPAN_REFRESH_HELP = '5분마다 갱신됩니다.\n시세는 약 20분 지연됩니다.'

export const JAPAN_SETTINGS_TAB_STORAGE = { map: 'JapanMap', graph: 'JapanGraph', stock: 'JapanStock', sector: 'JapanSector' } as const

// 일본 화면의 Basis는 MARKETRY만 제공해서 다른 분류를 고를 수 없다. 공통 선택 영역에 넘기는 빈 동작이다.
export const NO_TAXONOMY_CHANGE = () => {}
