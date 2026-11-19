import { useSyncExternalStore } from 'react'
import { canReadSettingsStorage, canWriteSettingsStorage, readSettingStorage, subscribeSettingsStorageGate, writeSettingStorage } from './settingsStorageGate.ts'

// 모바일 화면 모드 — 야간(기본)·주간. 로그인한 사용자만 이 브라우저에 저장하고(비로그인은 저장하지 않고 야간으로 시작한다) 서버·계정에는 올리지 않는다.
// 색은 index.css의 `:root[data-theme="light"]`가 모바일 화면(폭 767px 이하, 눕힌 폰)에서만 덮어쓴다(PC 화면은 영향이 없다).
export type MobileTheme = 'dark' | 'light'

const STORAGE_KEY = 'marketry.mobileTheme'
const listeners = new Set<() => void>()

export function parseMobileTheme(value: unknown): MobileTheme {
  return value === 'light' ? 'light' : 'dark'
}

// 비로그인이 이 화면에서 바꾼 모드 — 저장하지 않고 메모리에만 둔다.
let guestTheme: MobileTheme | null = null

export function readMobileTheme(): MobileTheme {
  if (!canReadSettingsStorage()) return guestTheme ?? 'dark'
  return parseMobileTheme(readSettingStorage(STORAGE_KEY))
}

// 문서에 모드를 적용한다. 브라우저 기본 컨트롤 색과 강제 다크 변환도 같은 모드로 알린다.
export function applyMobileTheme(theme: MobileTheme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
}

export function writeMobileTheme(theme: MobileTheme): void {
  if (canWriteSettingsStorage()) writeSettingStorage(STORAGE_KEY, theme)
  else guestTheme = theme
  applyMobileTheme(theme)
  listeners.forEach(listener => listener())
}

// 로그인 여부가 확인되면 저장된 모드를 다시 적용한다(비로그인이면 야간으로 돌아간다).
subscribeSettingsStorageGate(() => {
  applyMobileTheme(readMobileTheme())
  listeners.forEach(listener => listener())
})

const subscribe = (onChange: () => void) => {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function useMobileTheme(): readonly [MobileTheme, (theme: MobileTheme) => void] {
  const theme = useSyncExternalStore(subscribe, readMobileTheme, () => 'dark' as MobileTheme)
  return [theme, writeMobileTheme]
}
