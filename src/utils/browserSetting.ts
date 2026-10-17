import { useCallback, useSyncExternalStore } from 'react'

// 관리자 페이지 미사용 탭으로 옮긴 설정의 값 — 서버에 저장하지 않고 이 브라우저(localStorage)에만 둔다.
// 한 탭에서 바꾸면 같은 브라우저의 다른 화면(지도 페이지)도 바로 읽도록 같은 창 안 변경은 직접 만든 이벤트로 알린다.
const CHANGE_EVENT = 'marketry-browser-setting'

function readStored<T extends number | string | boolean>(key: string, initialValue: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === null) return initialValue
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === typeof initialValue ? (parsed as T) : initialValue
  } catch {
    return initialValue
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

export function useBrowserSetting<T extends number | string | boolean>(key: string, initialValue: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(subscribe, () => readStored(key, initialValue), () => initialValue)
  const setValue = useCallback((next: T) => {
    try {
      window.localStorage.setItem(key, JSON.stringify(next))
    } catch {
      // 저장소를 못 쓰는 브라우저(비공개 창 등)에서는 저장 없이 넘어간다.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [key])
  return [value, setValue]
}
