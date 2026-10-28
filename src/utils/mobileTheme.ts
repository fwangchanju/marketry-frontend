import { useSyncExternalStore } from 'react'

// 모바일 화면 모드 — 야간(기본)·주간. 이 브라우저에만 저장하고 서버·계정에는 올리지 않는다.
// 색은 index.css의 `:root[data-theme="light"]`가 모바일 화면(폭 767px 이하, 눕힌 폰)에서만 덮어쓴다(PC 화면은 영향이 없다).
export type MobileTheme = 'dark' | 'light'

const STORAGE_KEY = 'marketry.mobileTheme'
const listeners = new Set<() => void>()

export function parseMobileTheme(value: unknown): MobileTheme {
  return value === 'light' ? 'light' : 'dark'
}

export function readMobileTheme(): MobileTheme {
  try {
    return parseMobileTheme(localStorage.getItem(STORAGE_KEY))
  } catch {
    return 'dark'
  }
}

// 문서에 모드를 적용한다. 브라우저 기본 컨트롤 색과 강제 다크 변환도 같은 모드로 알린다.
export function applyMobileTheme(theme: MobileTheme): void {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', theme)
}

export function writeMobileTheme(theme: MobileTheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 저장이 막혀도 이 화면에서는 바뀐 모드를 그대로 쓴다.
  }
  applyMobileTheme(theme)
  listeners.forEach(listener => listener())
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange)
  return () => { listeners.delete(onChange) }
}

export function useMobileTheme(): readonly [MobileTheme, (theme: MobileTheme) => void] {
  const theme = useSyncExternalStore(subscribe, readMobileTheme, () => 'dark' as MobileTheme)
  return [theme, writeMobileTheme]
}
