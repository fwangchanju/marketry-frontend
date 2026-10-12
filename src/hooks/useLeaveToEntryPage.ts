import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

// 안내창·로그인 팝업을 닫은 뒤 들어온 곳으로 돌려보낸다. 주소를 직접 열어 이전 화면이 없으면 Home으로 보낸다.
export function useLeaveToEntryPage() {
  const navigate = useNavigate()
  return useCallback(() => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate('/home', { replace: true })
  }, [navigate])
}
