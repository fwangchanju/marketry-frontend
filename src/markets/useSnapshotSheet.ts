import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { useTaxonomySelection } from '@/hooks/useTaxonomySelection'

export type SnapshotSheet = 'MARKETRY' | 'MINE'

// 일본·미국 화면의 모드(MARKETRY·내 기준). 한국 화면과 같은 브라우저 공통 선택을 쓰므로, 페이지와 시장을 옮겨도 고른 모드가 유지된다.
// 주소의 ?sheet=MINE·MARKETRY는 그 모드로 고른 뒤 주소에서 지운다(한국 CustomPage와 같다).
// 내 기준은 관리자만 쓴다. 일반 회원에게는 항상 MARKETRY로 보인다.
export function useSnapshotSheet(storageKey?: string) {
  const { data: session } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selected, setSelected] = useTaxonomySelection('MARKETRY', storageKey)
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
  const sheet: SnapshotSheet = canUseMine && (urlChoice ?? selected) === 'MINE' ? 'MINE' : 'MARKETRY'
  const selectSheet = useCallback((next: SnapshotSheet) => setSelected(next), [setSelected])
  return { sheet, canUseMine, selectSheet }
}
