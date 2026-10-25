import { useEffect, useSyncExternalStore } from 'react'

// 크롬 계열 브라우저의 키보드 잠금(Keyboard Lock) API — 전체화면 중에 Esc를 브라우저가 가로채지 않고 페이지가 받게 한다.
// Safari·Firefox에는 없다(거기서는 Esc가 항상 바로 전체화면을 끝낸다).
type KeyboardLockApi = { lock?: (keyCodes?: string[]) => Promise<void>; unlock?: () => void }
const keyboardLockApi = () => (navigator as Navigator & { keyboard?: KeyboardLockApi }).keyboard

const getFullscreenSnapshot = () => document.fullscreenElement != null
const getServerFullscreenSnapshot = () => false
const subscribeFullscreen = (onChange: () => void) => {
  const handleFullscreenChange = () => {
    if (!document.fullscreenElement) keyboardLockApi()?.unlock?.()
    onChange()
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
}

// 브라우저 자체의 진짜 Fullscreen API를 토글한다. 사용자가 F11 키나 Esc로 직접 빠져나가는
// 경우도 있어서 fullscreenchange 이벤트로 상태를 동기화한다.
//
// 전체화면에서 Esc를 누르면 브라우저가 페이지에 키 이벤트도 주지 않고 전체화면부터 끝낸다. 그러면 열려 있는 팝업(공유 창 등)을
// 닫기도 전에 전체화면이 풀린다. 그래서 전체화면에 들어가면 Esc를 잠가서 페이지가 받게 하고, Esc를 누르면 열려 있는 팝업이 먼저
// 닫히고(팝업은 preventDefault로 "내가 처리했다"고 표시), 처리한 곳이 없을 때만 전체화면을 끝낸다. 잠금 중에는 Esc를 길게 누르면
// 브라우저가 전체화면을 끝낸다.
export function useNativeFullscreen() {
  // 페이지가 바뀌어도 브라우저에 유지된 현재 전체화면 상태에서 표시를 시작한다.
  const isNativeFullscreen = useSyncExternalStore(subscribeFullscreen, getFullscreenSnapshot, getServerFullscreenSnapshot)

  useEffect(() => {
    if (!isNativeFullscreen) return
    // document가 아니라 window에서 받는다 — 이벤트가 document(팝업들의 Esc 처리)를 먼저 지나간 뒤에 와서, 팝업이 처리했는지 볼 수 있다.
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      void document.exitFullscreen()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isNativeFullscreen])

  const handleToggleNativeFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen()
      return
    }
    void document.documentElement.requestFullscreen().then(() => keyboardLockApi()?.lock?.(['Escape'])?.catch(() => {}))
  }

  return { isNativeFullscreen, handleToggleNativeFullscreen }
}
