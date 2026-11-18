import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { useTaxonomySelection } from '@/hooks/useTaxonomySelection'
import { useOverseasMiddle } from '@/hooks/useOverseasMiddle'
import { OVERSEAS_MIDDLE } from '@/utils/overseasMiddle'
import type { OverseasMarket } from '@/utils/markets'

export type OverseasSheet = 'MARKETRY' | 'MINE'

// 일본·미국 화면의 모드(MARKETRY·내 기준). 한국 화면과 같은 브라우저 공통 선택을 쓰므로, 페이지와 시장을 옮겨도 고른 모드가 유지된다.
// 주소의 ?sheet=MINE·MARKETRY는 그 모드로 고른 뒤 주소에서 지운다(한국 CustomPage와 같다).
// 내 기준은 관리자만 쓴다. 일반 회원에게는 항상 MARKETRY로 보인다.
export function useOverseasSheet() {
  const { data: session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useTaxonomySelection()
  const canUseMine = isAdminSession(session)
  const explicit = searchParams.get('sheet')?.toUpperCase() ?? null
  const urlChoice = explicit === 'MINE' || explicit === 'MARKETRY' ? explicit : null
  useEffect(() => {
    if (urlChoice === null) return
    setSelected(urlChoice)
    setSearchParams(previous => {
      const params = new URLSearchParams(previous)
      params.delete('sheet')
      return params
    }, { replace: true })
  }, [urlChoice, setSelected, setSearchParams])
  const sheet: OverseasSheet = canUseMine && (urlChoice ?? selected) === 'MINE' ? 'MINE' : 'MARKETRY'
  const selectSheet = useCallback((next: OverseasSheet) => setSelected(next), [setSelected])
  return { sheet, canUseMine, selectSheet }
}

// 설정창 Mode 줄의 세 칸(MARKETRY · 가운데 외부 분류 · 내 기준)을 한 번에 다룬다.
// 가운데 칸 선택은 시장별로 따로 저장하고, 내 기준·MARKETRY 선택은 기존 공통 모드를 그대로 쓴다.
export function useOverseasMode(market: OverseasMarket) {
  const base = useOverseasSheet()
  const [middle, setMiddle] = useOverseasMiddle(market)
  const externalReady = OVERSEAS_MIDDLE[market].externalReady
  const isExternal = middle === 'EXTERNAL' && externalReady
  // 외부 분류를 보는 동안에는 편집 모드(내 기준)가 아니다.
  const sheet: OverseasSheet = isExternal ? 'MARKETRY' : base.sheet
  const modeKey: 'MARKETRY' | 'MINE' | 'KRX' = isExternal ? 'KRX' : sheet === 'MINE' ? 'MINE' : 'MARKETRY'
  const alsoTaxonomies: ('MINE' | 'KRX')[] = [...(base.canUseMine ? ['MINE' as const] : []), ...(externalReady ? ['KRX' as const] : [])]
  const selectMode = useCallback((next: 'MARKETRY' | 'MINE' | 'EXTERNAL') => {
    if (next === 'EXTERNAL') {
      setMiddle('EXTERNAL')
      return
    }
    setMiddle('MARKETRY')
    base.selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')
  }, [base, setMiddle])
  return { sheet, canUseMine: base.canUseMine, modeKey, alsoTaxonomies, selectMode }
}
