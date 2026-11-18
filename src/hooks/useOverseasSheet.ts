import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'

export type OverseasSheet = 'MARKETRY' | 'MINE'

// 일본·미국 종목·섹터 화면의 모드. 한국처럼 주소의 ?sheet=MINE이 "내 기준"이고, 내 기준은 관리자만 쓴다(일반 회원이 주소로 열어도 MARKETRY로 본다).
export function useOverseasSheet() {
  const { data: session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const canUseMine = isAdminSession(session)
  const sheet: OverseasSheet = canUseMine && searchParams.get('sheet') === 'MINE' ? 'MINE' : 'MARKETRY'
  const selectSheet = useCallback((next: OverseasSheet) => {
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      if (next === 'MINE') params.set('sheet', 'MINE')
      else params.delete('sheet')
      return params
    }, { replace: true })
  }, [setSearchParams])
  return { sheet, canUseMine, selectSheet }
}
