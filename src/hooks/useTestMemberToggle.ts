import { useState } from 'react'
import { devLogin, devSignup } from '@/api/auth'
import { settleSessionRefresh } from '@/api/client'
import { cancelPendingPreferenceSave } from '@/hooks/useCustomPreferences'
import { isTestMemberActive, setTestMemberActive } from '@/utils/localDevLogin'

// 로컬 개발 전용 "테스트 회원" 전환 — 눌러서 로컬 DB에 새 USER 계정(테스트 회원)으로 바꾸고, 테스트 회원일 때 다시 누르면 로그아웃 없이 원래 계정으로 돌아온다.
// 전환하는 쪽은 Admin 설정창, 돌아오는 쪽은 계정 메뉴(테스트 회원은 관리자가 아니라 Admin 페이지에 못 들어오기 때문)가 같은 규칙을 쓰도록 한 곳에 둔다.
export function useTestMemberToggle() {
  const [isTestMember] = useState(isTestMemberActive)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggle = async () => {
    setIsPending(true)
    setError(null)
    cancelPendingPreferenceSave()
    try {
      await settleSessionRefresh()
      if (isTestMember) {
        await devLogin()
        setTestMemberActive(false)
      } else {
        await devSignup()
        setTestMemberActive(true)
      }
      // 현재 화면을 다시 열어 이전 회원의 캐시를 비우고, 비회원 확인 모드만 해제한다.
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('guest', '0')
      window.location.assign(currentUrl.href)
    } catch {
      setError(isTestMember ? '전환 실패: 원래 계정으로 돌아가지 못했습니다.' : '생성 실패: 백엔드 local 프로필을 확인하세요.')
      setIsPending(false)
    }
  }

  return { isTestMember, isPending, error, toggle }
}
