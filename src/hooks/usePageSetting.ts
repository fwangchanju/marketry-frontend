import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import { useCustomPreferences } from './useCustomPreferences'
import { useIsLoggedIn } from './useSession'
import { readDraft, registerDraftKey, useDraftVersion, writeDraft } from '@/utils/settingsDraft'

// 화면 설정(마켓맵/섹터 페이지의 옵션 사이드바 값 등) 하나를 다루는 훅 — useState와 같은 [value, setValue] 시그니처.
//
// 값을 바꾸면 로그인 여부와 상관없이 이 화면의 메모리에만 임시로 둔다(utils/settingsDraft.ts). 서버에는
// 설정창의 저장 버튼을 눌러야 올라가고, 초기화 버튼이나 브라우저 종료·새로고침이면 임시값이 사라져 저장값으로 돌아온다.
// - 임시값이 있으면 그 값을 쓴다.
// - 없으면 로그인 + 서버 설정 로드 완료일 때 서버 값을 쓰고(서버 payload에 이 키가 없으면 사용자가 아직 저장한 적이 없는 것이라
//   initialValue=코드 기본값), 그 밖(비로그인, 서버 설정을 아직 못 받아온 동안)에는 initialValue를 쓴다.

export function usePageSetting<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const isLoggedIn = useIsLoggedIn()
  const { data: preferences, isLoaded } = useCustomPreferences()
  useDraftVersion()
  useEffect(() => {
    registerDraftKey(key)
  }, [key])

  const draft = readDraft(key)
  const useServer = isLoggedIn && isLoaded
  const hasServerValue = useServer && preferences !== undefined && Object.hasOwn(preferences, key)
  const value = draft.found ? (draft.value as T) : hasServerValue ? (preferences![key] as T) : initialValue

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    next => {
      writeDraft(key, typeof next === 'function' ? (next as (prev: T) => T)(value) : next)
    },
    [value, key],
  )

  return [value, setValue]
}
