import { useCallback, useEffect, useState, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import { getSettingsStorageGateVersion, readSettingStorage, subscribeSettingsStorageGate, writeSettingStorage } from '@/utils/settingsStorageGate'

// 이 브라우저에만 남기는 화면 취향(예: 설정창을 열린 채로 시작할지)을 위한 useState 대체 훅. 서버에는 보내지 않는다.
// 로그인한 사용자만 저장되어 탭을 닫아도 유지된다. 비로그인은 저장하지 않고 이 화면의 메모리에서만 쓴다(settingsStorageGate).
export function useLocalPersistedState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const readInitial = useCallback((): T => {
    const raw = readSettingStorage(key)
    if (raw === null) return initialValue
    try {
      return JSON.parse(raw) as T
    } catch {
      return initialValue
    }
  }, [key, initialValue])
  const [state, setState] = useState<T>(readInitial)
  // 로그인 여부가 확인되거나 바뀌면 저장값을 다시 읽는다(비로그인이면 기본값으로 돌아간다).
  const gateVersion = useSyncExternalStore(subscribeSettingsStorageGate, getSettingsStorageGateVersion, () => 0)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그인 상태가 바뀔 때 저장소에서 다시 읽는 값이라 렌더 중 계산할 수 없다.
    if (gateVersion > 0) setState(readInitial())
  }, [gateVersion, readInitial])

  const setLocalState = useCallback<Dispatch<SetStateAction<T>>>(
    value => {
      setState(prev => {
        const next = value instanceof Function ? value(prev) : value
        writeSettingStorage(key, JSON.stringify(next))
        return next
      })
    },
    [key],
  )

  return [state, setLocalState]
}
