import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

type Options<T> = { serialize?: (value: T) => unknown; deserialize?: (raw: unknown) => T; liveDefault?: boolean }

// 새로고침(하드 리프레시 포함) 사이에는 유지하되, 탭/창을 닫으면 사라지는 게 자연스러운 "토글성" 상태를
// 위한 useState 대체 훅. sessionStorage에 저장할 뿐 백엔드에는 전혀 관여하지 않는다.
// Map/Set처럼 JSON이 기본으로 못 다루는 값은 serialize/deserialize로 변환해서 넘긴다.
export function usePersistedState<T>(key: string, initialValue: T, options?: Options<T>): [T, Dispatch<SetStateAction<T>>] {
  // serialize/deserialize는 호출부에서 매 렌더마다 새 함수로 넘어오는 경우가 많아, setPersistedState를
  // useCallback으로 안정된 identity로 유지하기 위해 최신 값만 ref로 따라간다(의존성 배열엔 넣지 않음).
  // 렌더 중 ref를 직접 mutate하지 않도록 커밋 이후(useEffect)에 동기화한다.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw === null) return initialValue
      const deserialize = options?.deserialize ?? ((v: unknown) => v as T)
      return deserialize(JSON.parse(raw))
    } catch {
      return initialValue
    }
  })
  const [hasStoredValue, setHasStoredValue] = useState(() => {
    try { return sessionStorage.getItem(key) !== null } catch { return false }
  })
  const resolvedState = options?.liveDefault && !hasStoredValue ? initialValue : state
  const currentValueRef = useRef(resolvedState)

  useEffect(() => {
    currentValueRef.current = resolvedState
  }, [resolvedState])

  const setPersistedState = useCallback<Dispatch<SetStateAction<T>>>(value => {
    const next = value instanceof Function ? value(currentValueRef.current) : value
    currentValueRef.current = next
    setState(next)
    setHasStoredValue(true)
    try {
      const serialize = optionsRef.current?.serialize ?? ((v: T) => v)
      sessionStorage.setItem(key, JSON.stringify(serialize(next)))
    } catch {
      // 프라이빗 모드 등으로 접근이 막혀도 화면 동작 자체는 계속되게 조용히 무시
    }
  }, [key])

  return [resolvedState, setPersistedState]
}
