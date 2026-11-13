// 미국 그래프 설정을 서버에 저장하는 이름 — 일본 그래프처럼 설정창의 저장 버튼으로 올라가고 계정에 저장된다.
// 미국은 하루 한 번만 저장돼서 일본 그래프의 "N분 전 대비" 모드와 비교 분 수는 없다.
export type UsaGraphPreferences = { groupDepth: number; avgChangeRateUseSimple: boolean }

export const USA_GRAPH_DEFAULTS: UsaGraphPreferences = { groupDepth: 1, avgChangeRateUseSimple: false }

// 'usa.'로 시작하는 이름은 임시값 범위도 미국 화면끼리 따로 센다(settingsDraft).
export const USA_GRAPH_SETTING_PREFIX = 'usa.graph.'
export const usaGraphSettingKey = (name: keyof UsaGraphPreferences) => `${USA_GRAPH_SETTING_PREFIX}${name}`

// 설정창 항목이 국내 그래프 설정 이름으로 적어 둔 변경 점 이름을 미국 그래프 저장 이름으로 바꾼다.
export const USA_GRAPH_DRAFT_KEY_MAP: Readonly<Record<string, string>> = {
  'groupPage.depth': usaGraphSettingKey('groupDepth'),
  'heatmap.avgChangeRateUseSimple': usaGraphSettingKey('avgChangeRateUseSimple'),
}
