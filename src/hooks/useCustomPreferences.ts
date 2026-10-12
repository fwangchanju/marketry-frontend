import { useQuery } from '@tanstack/react-query'
import queryClient from '@/api/queryClient'
import { getCustomPreferences, replaceCustomPreferences } from '@/api/custom'
import { migratePreferences } from '@/utils/settingsSchema'
import { customPreferenceKeys } from './queryKeys'
import { useIsLoggedIn } from './useSession'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'
import type { CustomPreferences } from '@/types/api'

const SAVE_DEBOUNCE_MS = 500

// setPreference 호출이 여러 훅 인스턴스(usePageSetting마다 하나씩)에서 동시에 일어나도 저장은
// "payload 전체 교체" 한 번으로 합쳐져야 한다 — 그래서 디바운스 타이머를 모듈 스코프에 하나만 두고,
// react-query 캐시(queryClient)를 사실상의 공유 상태 저장소로 쓴다.
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const current = queryClient.getQueryData<CustomPreferences>(customPreferenceKeys.preferences())
    if (current === undefined) return
    replaceCustomPreferences(current).catch(() => {
      // 실패해도 조용히 무시한다 — 다음 변경 때 최신 전체 payload로 다시 저장 시도된다. 매번 알림을
      // 띄우면 설정 조작 자체를 방해한다(전역 mutation 에러 알림도 useMutation을 거치지 않는 이 저장
      // 경로에는 적용되지 않는다 — 의도적인 조용한 실패).
    })
  }, SAVE_DEBOUNCE_MS)
}

// 로그아웃 시 이전 계정의 미저장 변경분이 다음 로그인 사용자에게 새어나가지 않도록 대기 중인 저장을
// 취소한다. useSession의 useLogout이 queryClient.clear() 직전에 호출한다.
export function cancelPendingPreferenceSave() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
}

// 로그인 사용자의 페이지 설정(user_preference) — 사용자가 바꾼 값만 담는 sparse JSON을 전체 교체
// 방식·500ms 디바운스로 저장한다. 초기 로드가 끝나기 전에는(isLoaded=false) 아무것도 저장하지 않는다
// (usePageSetting이 이 isLoaded로 저장 여부를 가른다). 비로그인 사용자는 이 쿼리 자체가 비활성이라
// 서버에 전혀 접근하지 않는다 — 기존 sessionStorage 값을 자동으로 올려보내지 않는다.
export function useCustomPreferences() {
  const isLoggedIn = useIsLoggedIn()
  const query = useQuery({
    queryKey: customPreferenceKeys.preferences(),
    // 저장된 설정의 버전이 낮으면(없으면 포함) 새 모양으로 옮기고 서버에도 한 번 반영한다 — utils/settingsSchema.ts 참고.
    // 로드가 끝나기 전에는 아무것도 저장하지 않으므로(isLoaded) 사용자의 변경 저장과 겹치지 않는다.
    queryFn: async () => {
      const { preferences, changed } = migratePreferences(await getCustomPreferences())
      if (changed) replaceCustomPreferences(preferences).catch(() => {})
      return preferences
    },
    enabled: isLoggedIn,
    ...STATIC_REFERENCE_CACHE,
  })

  const setPreference = (key: string, value: unknown) => {
    const current = queryClient.getQueryData<CustomPreferences>(customPreferenceKeys.preferences()) ?? {}
    queryClient.setQueryData(customPreferenceKeys.preferences(), { ...current, [key]: value })
    scheduleSave()
  }

  // 저장 버튼용 — 바로 서버에 올리고, 성공했을 때만 화면의 저장값(캐시)을 바꾼다. 실패하면 던져서 호출한 쪽이 알리게 한다.
  // 대기 중이던 디바운스 저장은 이 요청이 대신하므로 취소하고, 실패하면 다시 걸어 둔다.
  const commitPreferences = async (entries: Array<[string, unknown]>) => {
    const current = queryClient.getQueryData<CustomPreferences>(customPreferenceKeys.preferences()) ?? {}
    const next = { ...current, ...Object.fromEntries(entries) }
    const hadPendingSave = saveTimer !== null
    cancelPendingPreferenceSave()
    try {
      await replaceCustomPreferences(next)
    } catch (error) {
      if (hadPendingSave) scheduleSave()
      throw error
    }
    queryClient.setQueryData(customPreferenceKeys.preferences(), next)
  }

  return { data: query.data, isLoaded: query.isSuccess, setPreference, commitPreferences }
}
