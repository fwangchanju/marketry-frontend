import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { devLogin, getSession, logout } from '@/api/auth'
import { getLastRefreshAt, markSessionAnonymous, refreshSessionOnce } from '@/api/client'
import { authKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE } from './cacheConfig'
import { cancelPendingPreferenceSave } from './useCustomPreferences'
import { isLocalAutoLoginEnabled, isLocalGuestMode, setTestMemberActive } from '@/utils/localDevLogin'
import type { AuthSessionResponse } from '@/types/api'

const KEEP_ALIVE_REFRESH_MS = 10 * 60_000
const KEEP_ALIVE_CHECK_MS = 60_000

const LAST_USER_ID_STORAGE_KEY = 'auth.lastUserId'
// 계정마다 뜻이 달라지는 커스텀 모드 관련 저장값 — 로그아웃/계정 전환 시 이전 계정의 값이 새 계정
// 화면에 잠깐이라도 새어나가지 않도록 지운다. treemap.excludedSectorNames는 sectorId가 계정마다
// 다른 섹터를 가리킬 수 있어 특히 중요하다.
const CUSTOM_MODE_STORAGE_KEYS = ['treemap.isCustom', 'treemap.excludedSectorNames']

function clearCustomModeStorage() {
  for (const key of CUSTOM_MODE_STORAGE_KEYS) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // 프라이빗 모드 등으로 접근이 막혀도 화면 동작 자체는 계속되게 조용히 무시
    }
  }
}

// 세션 응답이 도착할 때마다, 마지막으로 본 사용자와 다르면(로그아웃 → 익명, 다른 계정으로 재로그인)
// 계정별로 뜻이 달라지는 저장값을 지운다. 로그아웃은 useLogout이 즉시 처리하지만, 새로고침/직접
// URL 진입처럼 세션이 나중에 확인되는 경로에서도 동일하게 걸리도록 여기서 한 번 더 보정한다.
function reconcileCustomModeStorage(session: AuthSessionResponse) {
  try {
    const stored = sessionStorage.getItem(LAST_USER_ID_STORAGE_KEY)
    const current = session.authenticated ? String(session.userId) : null
    if (stored === current) return
    clearCustomModeStorage()
    if (current === null) sessionStorage.removeItem(LAST_USER_ID_STORAGE_KEY)
    else sessionStorage.setItem(LAST_USER_ID_STORAGE_KEY, current)
  } catch {
    // 위와 동일 — 저장소 접근 실패는 무시
  }
}

export function useSession() {
  return useQuery({
    queryKey: authKeys.session(),
    queryFn: async () => {
      const session = await getSession()
      reconcileCustomModeStorage(session)
      return session
    },
    ...STATIC_REFERENCE_CACHE,
    retry: false,
  })
}

export function useIsLoggedIn(): boolean {
  const { data } = useSession()
  return data?.authenticated ?? false
}

// 페이지 로드당 한 번만 시도하도록 모듈 스코프에 둔다 — NavBar가 리마운트되거나 세션 쿼리가
// 다시 실행돼도 재시도하지 않는다(prod 프로필로 떠 있거나 OWNER_USER_ID가 없는 경우 계속
// 실패 요청을 반복하지 않기 위함).
let devLoginAttempted = false
let guestLogoutAttempted = false

// 로컬 개발 전용 자동 로그인 — VITE_LOCAL_AUTO_LOGIN=1이고 세션 조회가 끝났는데 비로그인이면
// POST /auth/dev-login을 한 번 호출해 구글 로그인과 동일한 쿠키를 심고, 반환된 세션을 쿼리
// 캐시에 바로 반영한다(새로고침 없이 로그인 상태가 된다). 실패하면(백엔드가 prod 프로필로 떠
// 있거나 OWNER_USER_ID가 로컬 DB에 없는 경우 등) 콘솔 경고만 남기고 익명 상태로 남는다.
export function useLocalDevLogin() {
  const localAutoLogin = isLocalAutoLoginEnabled()
  const localGuestMode = isLocalGuestMode()
  const { data: session, isLoading } = useSession()
  const queryClient = useQueryClient()
  const logoutMutation = useLogout()

  // 비로그인 확인 모드(?guest=1)로 열었는데 이전에 심어진 로그인 쿠키로 로그인돼 있으면 한 번 로그아웃한다.
  useEffect(() => {
    if (!localGuestMode || isLoading || !session?.authenticated || guestLogoutAttempted) return
    guestLogoutAttempted = true
    logoutMutation.mutate()
  }, [localGuestMode, isLoading, session?.authenticated, logoutMutation])

  useEffect(() => {
    if (!localAutoLogin || isLoading || session?.authenticated || devLoginAttempted) return
    devLoginAttempted = true

    devLogin()
      .then(parsed => {
        // 자동 로그인은 원래 계정이다 — 테스트 회원으로 바꿔 둔 표시를 끈다.
        setTestMemberActive(false)
        queryClient.setQueryData(authKeys.session(), parsed)
      })
      .catch(error => {
        const status = isAxiosError(error) ? error.response?.status : undefined
        console.warn(
          `[dev-login] 로컬 자동 로그인 실패(status=${status ?? 'unknown'}). ` +
            '백엔드가 prod 프로필 없이 떠 있는지, OWNER_USER_ID가 로컬 DB에 있는 사용자를 ' +
            '가리키는지 확인하세요.',
          error,
        )
      })
  }, [localAutoLogin, isLoading, session?.authenticated, queryClient])
}

// 접근 토큰(15분)이 페이지를 켜둔 채로 만료되면 시세 폴링 같은 GET은 비로그인도 200이라 401이 안
// 나오고, 화면은 로그인 상태인데 서버는 익명으로 처리하게 된다(예: 마켓맵이 기본 설정으로 계산됨).
// 그래서 로그인 상태인 동안은 접근 토큰이 오래되기 전에 선제적으로 갱신한다.
export function useSessionKeepAlive(authenticated: boolean) {
  useEffect(() => {
    if (!authenticated) return

    const check = async () => {
      if (Date.now() - getLastRefreshAt() < KEEP_ALIVE_REFRESH_MS) return
      try {
        await refreshSessionOnce()
      } catch (error) {
        // 다른 탭에서 로그아웃했거나 갱신 토큰이 만료된 경우에만 세션을 익명으로 되돌린다.
        // 네트워크 오류 등 그 외 실패는 조용히 무시하고 다음 check에서 다시 시도한다.
        if (isAxiosError(error) && error.response?.status === 401) markSessionAnonymous()
      }
    }

    check()
    const interval = setInterval(check, KEEP_ALIVE_CHECK_MS)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [authenticated])
}

const ANONYMOUS_SESSION: AuthSessionResponse = {
  authenticated: false,
  userId: null,
  email: null,
  role: null,
  nickname: null,
  profileImageVersion: null,
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // 저장 대기 중인 preferences 디바운스 저장을 취소한 뒤(다음 로그인 사용자에게 새어나가지 않도록)
      // 사용자별 데이터가 남지 않도록 캐시 전체를 비운다 — 이전 계정 화면이 잠깐이라도 보이지 않게.
      cancelPendingPreferenceSave()
      // 세션 쿼리는 지우지 않고 그 자리에서 익명으로 바꾼다 — clear()로 지우면 세션을 구독하던 화면(지도 설정 등)이
      // 새 쿼리를 따라가지 못해서 로그아웃 뒤에도 이전 사용자의 설정이 그대로 보였다. 바꾼 뒤에 나머지를 비운다.
      queryClient.setQueryData(authKeys.session(), ANONYMOUS_SESSION)
      queryClient.removeQueries({ predicate: query => query.queryKey[0] !== authKeys.all[0] })
      clearCustomModeStorage()
      try {
        sessionStorage.removeItem(LAST_USER_ID_STORAGE_KEY)
      } catch {
        // 무시
      }
    },
  })
}
