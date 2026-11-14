import { createDefaultColorScale } from './heatmapColorScale.ts'
import { settingDefaultsFor } from './settingDefaults.ts'

export type UsaDepthMetric = 'weightedAvgChangeRate' | 'simpleAvgChangeRate' | 'upDownCount' | 'marketValue'

// 미국 지도의 설정 기본값. 국내·일본 지도의 설정과 따로 저장한다.
export const USA_MAP_DEFAULTS = {
  sectorLevelEnabled: true,
  maxDepth: 2 as number | null, // 섹터와 업종 두 단계
  depthMetricEnabled: true,
  activeDepthMetric: 'weightedAvgChangeRate' as UsaDepthMetric,
  depthMetricMinIndex: 0,
  depthMetricMaxIndex: 1, // 섹터~업종
  boxSizeMarketCapRatio: 100, // 시가총액에 비례
  stockLabelEnabled: true,
  stockLabelModeIndex: 3, // 이름과 등락률
  decimalPlaces: 1,
  // 상위 업종 강조 — 일본 지도와 같은 기본값(2단계 중 업종 기준 3개).
  topPickEnabled: true,
  topPickDepth: 1,
  topPickCount: 3,
}
export type UsaMapPreferences = typeof USA_MAP_DEFAULTS

// 설정 화면이 없는 값은 여기서 고정한다.
export const USA_MAP_FIXED = {
  boxLabelMinAreaPercent: 0.01,
  stockPopupOnHover: false,
  // 국내 지도 MARKETRY 모드의 강조 색상과 같은 값을 그대로 쓴다(청록). 일본 지도·그래프와 같다.
  strongIndustryColor: settingDefaultsFor(false, 'marketry').strongIndustryColor,
  colorScale: createDefaultColorScale(),
} as const

// 미국 지도 설정을 서버에 저장하는 이름 — 일본 지도처럼 설정창의 저장 버튼으로 올라가고 계정에 저장된다.
// 항목마다 저장 이름을 따로 둬서 설정창 항목의 저장 안 한 변경 점이 항목별로 찍힌다. 'usa.'로 시작하는 이름은 임시값 범위도 따로 센다.
export const USA_MAP_SETTING_PREFIX = 'usa.map.'
export const usaMapSettingKey = (name: keyof typeof USA_MAP_DEFAULTS) => `${USA_MAP_SETTING_PREFIX}${name}`

// 설정창 항목이 국내 설정 이름으로 적어 둔 변경 점 이름을 미국 지도 저장 이름으로 바꾼다.
export const USA_MAP_DRAFT_KEY_MAP: Readonly<Record<string, string>> = {
  'heatmap.sectorLevelEnabled': usaMapSettingKey('sectorLevelEnabled'),
  'heatmap.selectedMaxDepth': usaMapSettingKey('maxDepth'),
  'heatmap.activeDepthMetric': usaMapSettingKey('activeDepthMetric'),
  'heatmap.depthMetricEnabled': usaMapSettingKey('depthMetricEnabled'),
  'heatmap.depthMetricMinIndex': usaMapSettingKey('depthMetricMinIndex'),
  'heatmap.depthMetricMaxIndex': usaMapSettingKey('depthMetricMaxIndex'),
  'heatmap.boxSizeMarketCapRatio': usaMapSettingKey('boxSizeMarketCapRatio'),
  'heatmap.stockLabelEnabled': usaMapSettingKey('stockLabelEnabled'),
  'heatmap.stockLabelModeIndex': usaMapSettingKey('stockLabelModeIndex'),
  'heatmap.decimalPlacesIndex': usaMapSettingKey('decimalPlaces'),
  'heatmap.topPickEnabled': usaMapSettingKey('topPickEnabled'),
  'heatmap.topPickDepth': usaMapSettingKey('topPickDepth'),
  'heatmap.topPickCount': usaMapSettingKey('topPickCount'),
}

// 설정창이 고른 탭을 기억하는 이름. 국내·일본 화면과 겹치지 않게 미국 화면마다 따로 둔다.
export const USA_SETTINGS_TAB_STORAGE = { map: 'UsaMap', graph: 'UsaGraph', stock: 'UsaStock', sector: 'UsaSector' } as const

// 미국 화면의 Basis는 MARKETRY만 제공해서 다른 분류를 고를 수 없다. 공통 선택 영역에 넘기는 빈 동작이다.
export const NO_TAXONOMY_CHANGE = () => {}
