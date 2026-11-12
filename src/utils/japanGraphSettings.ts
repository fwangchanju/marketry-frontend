// 일본 그래프 설정을 서버에 저장하는 이름 — 국내 그래프처럼 설정창의 저장 버튼으로 올라가고 계정에 저장된다.
export type JapanGraphPreferences = { graphMode: 'current' | 'delta'; groupDepth: number; avgChangeRateUseSimple: boolean; beforeMinutes: number }

export const JAPAN_GRAPH_SETTING_PREFIX = 'japan.graph.'
export const japanGraphSettingKey = (name: Exclude<keyof JapanGraphPreferences, 'beforeMinutes'>) => `${JAPAN_GRAPH_SETTING_PREFIX}${name}`

// 설정창 항목이 국내 그래프 설정 이름으로 적어 둔 변경 점 이름을 일본 그래프 저장 이름으로 바꾼다.
export const JAPAN_GRAPH_DRAFT_KEY_MAP: Readonly<Record<string, string>> = {
  'groupPage.depth': japanGraphSettingKey('groupDepth'),
  'groupPage.graphMode': japanGraphSettingKey('graphMode'),
  'heatmap.avgChangeRateUseSimple': japanGraphSettingKey('avgChangeRateUseSimple'),
}
