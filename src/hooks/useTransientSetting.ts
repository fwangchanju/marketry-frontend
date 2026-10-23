import { useCallback, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'

// 실험 탭 값 하나를 다루는 훅 — useState와 같은 [value, setValue] 시그니처.
// 서버·브라우저 어디에도 저장하지 않고 이 탭의 메모리에만 둔다. 페이지를 옮겨도 이어지지만 새로고침하면 기본값으로 돌아온다.
// 같은 키를 쓰는 모든 컴포넌트가 값을 함께 본다(useGlobalSettings와 MapPage가 같은 값을 읽는다).
const values = new Map<string, unknown>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTransientSetting<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const value = useSyncExternalStore(subscribe, () => (values.has(key) ? (values.get(key) as T) : initialValue))
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    next => {
      const prev = values.has(key) ? (values.get(key) as T) : initialValue
      values.set(key, typeof next === 'function' ? (next as (prev: T) => T)(prev) : next)
      listeners.forEach(listener => listener())
    },
    [key, initialValue],
  )
  return [value, setValue]
}
