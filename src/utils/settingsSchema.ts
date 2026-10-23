// 서버에 저장되는 사용자 설정(user_preference)의 버전 관리.
//
// 설정은 `키: 값` 모양의 JSON으로 저장되고(usePageSetting), 저장값에 `settings.version`을 함께 둔다. 나중에 키 이름을 바꾸거나
// 항목을 없애도, 이미 저장된 사용자 값을 로그인할 때 새 모양으로 옮길 수 있게 하려는 것이다.
//
// 키를 바꾸는 방법:
//   1. SETTINGS_SCHEMA_VERSION을 1 올린다.
//   2. MIGRATIONS에 이전 버전 번호를 키로 하는 함수를 추가한다 — MIGRATIONS[1]은 "버전 1 → 2"로 옮기는 규칙이고,
//      저장된 설정 객체를 받아 새 모양의 객체를 돌려준다(예: 이름을 바꾼 키의 값을 새 키로 복사하고 옛 키를 지운다).
// 버전이 없는 저장값은 0으로 본다. 현재 버전보다 높은 값(더 새로운 화면에서 저장한 것)은 건드리지 않는다.

export const SETTINGS_VERSION_KEY = 'settings.version'
export const SETTINGS_SCHEMA_VERSION = 1

type Preferences = Record<string, unknown>

const MIGRATIONS: Record<number, (preferences: Preferences) => Preferences> = {}

export function migratePreferences(raw: Preferences): { preferences: Preferences; changed: boolean } {
  const stored = raw[SETTINGS_VERSION_KEY]
  const storedVersion = typeof stored === 'number' && Number.isFinite(stored) ? stored : 0
  if (storedVersion >= SETTINGS_SCHEMA_VERSION) return { preferences: raw, changed: false }

  let next: Preferences = { ...raw }
  for (let version = storedVersion; version < SETTINGS_SCHEMA_VERSION; version += 1) {
    next = MIGRATIONS[version]?.(next) ?? next
  }
  next[SETTINGS_VERSION_KEY] = SETTINGS_SCHEMA_VERSION
  return { preferences: next, changed: true }
}
