// 거래소·MARKETRY 모드 설정을 이 브라우저에 바로 저장하는 도우미(2026-11-16 사용자 결정).
// 내 기준 모드는 서버에 저장하고, 이 두 모드는 서버에 두지 않는다. 저장소를 인자로 받아 테스트할 수 있게 둔다.
import { profileFromSettingKey } from './settingsSchema.ts'

const PREFIX = 'settings.browser.v1.'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

// 거래소·MARKETRY 키인지 판별한다. 내 기준 키와 그 밖의 키는 false다.
export function isBrowserSavedSettingKey(key: string): boolean {
  return profileFromSettingKey(key) !== null
}

// 저장된 값을 읽는다. 없거나 읽기가 막히면 found=false다.
export function readBrowserSetting(key: string, storage: StorageLike | null = defaultStorage()): { found: boolean; value: unknown } {
  if (!storage) return { found: false, value: undefined }
  try {
    const raw = storage.getItem(PREFIX + key)
    if (raw === null) return { found: false, value: undefined }
    return { found: true, value: JSON.parse(raw) }
  } catch {
    return { found: false, value: undefined }
  }
}

export function writeBrowserSetting(key: string, value: unknown, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 저장이 막혀도 화면 동작은 계속되게 조용히 무시
  }
}

export function clearBrowserSetting(key: string, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(PREFIX + key)
  } catch {
    // 조용히 무시
  }
}
