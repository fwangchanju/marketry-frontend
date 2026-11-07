import { useState } from 'react'
import { devLogin, devSignup } from '@/api/auth'
import { settleSessionRefresh } from '@/api/client'
import { cancelPendingPreferenceSave } from '@/hooks/useCustomPreferences'
import { setLocalGuestMode, setTestMemberActive } from '@/utils/localDevLogin'

// 로컬 개발 전용 계정 전환 — 관리자 계정(원래 계정)과 테스트 회원 중 원하는 쪽으로 항상 로그인한다.
// 전환은 로그인 상태와 상관없이 눌린 버튼 그대로 동작하고, 테스트 회원은 로컬 DB의 고정된 계정 하나를 쓴다.
export type DevAccount = 'admin' | 'test'

export function useTestMemberToggle() {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // returnTo를 주면 실제 로그인처럼 그 주소로 돌아온다. 없으면 지금 주소를 다시 연다.
  const loginAs = async (account: DevAccount, returnTo?: string) => {
    setIsPending(true)
    setError(null)
    cancelPendingPreferenceSave()
    try {
      await settleSessionRefresh()
      if (account === 'admin') {
        await devLogin()
        setTestMemberActive(false)
      } else {
        await devSignup()
        setTestMemberActive(true)
      }
      // 이전 회원의 캐시를 비우고, 자동 로그인을 다시 허용한다.
      setLocalGuestMode(false)
      const nextUrl = new URL(returnTo ?? window.location.href, window.location.origin)
      nextUrl.searchParams.delete('guest')
      window.location.assign(nextUrl.href)
    } catch {
      setError(account === 'admin' ? '로그인 실패: 관리자 계정으로 들어가지 못했습니다.' : '로그인 실패: 백엔드 local 프로필을 확인하세요.')
      setIsPending(false)
    }
  }

  return { isPending, error, loginAs }
}
