import type { SnapshotSheet } from '@/markets/useSnapshotSheet'

// 일본·미국 화면의 설정 저장 이름을 모드별로 나눈다(한국과 같은 규칙).
// - 내 기준: 이름 그대로 — 바꾼 값은 임시값이고 설정창의 저장 버튼을 눌러야 계정에 저장된다.
// - MARKETRY: 한국 MARKETRY 모드의 프로필 이름 아래에 둔다 — 버튼 없이 이 브라우저에 바로 저장된다(usePageSetting의 browserSaved).
// 접두어('japan.map.')에도 그대로 쓸 수 있다(접두어 + 항목 이름이 저장 이름이 되므로).
export const snapshotSettingKey = (key: string, sheet: SnapshotSheet) => (sheet === 'MINE' ? key : `heatmap.profile.marketry.${key}`)
