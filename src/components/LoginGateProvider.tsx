import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LoginGateContext } from '@/hooks/useLoginGate'
import LoginModal from './LoginModal'
import { isLocalAutoLoginEnabled } from '@/utils/localDevLogin'
import { parseOAuthReturnLocation } from '@/utils/oauthReturn'

// App 루트에서 한 번만 감싼다 — 어느 화면에서든 useLoginGate()로 같은 팝업을 띄울 수 있다.
export default function LoginGateProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [initialOAuthReturn] = useState(() => parseOAuthReturnLocation(location.pathname, location.search, location.hash))
  const [returnTo, setReturnTo] = useState<string | null>(initialOAuthReturn?.returnTo ?? null)
  const [hideMessage, setHideMessage] = useState(initialOAuthReturn !== null)
  const [loginError, setLoginError] = useState(initialOAuthReturn?.error ?? null)

  // 팝업이 닫힐 때까지 기다리는 호출자에게 "사용자가 로그인 없이 닫았다"를 알린다. 팝업을 다시 열면 앞선 대기는 닫힌 것으로 치지 않고 끝낸다.
  const dismissWaiterRef = useRef<((dismissed: boolean) => void) | null>(null)

  const requireLogin = useCallback((path: string, options?: { hideMessage?: boolean }) => {
    // 로컬 자동 로그인이 켜져 있으면 팝업 대신 자동으로 로그인되므로 팝업을 열지 않는다(게스트 상태면 정상으로 연다).
    // 로그아웃·계정 전환으로 게스트 상태가 렌더 없이 바뀌므로 누를 때마다 다시 확인한다.
    if (isLocalAutoLoginEnabled()) return Promise.resolve(false)
    dismissWaiterRef.current?.(false)
    setHideMessage(options?.hideMessage ?? false)
    setReturnTo(path)
    return new Promise<boolean>(resolve => { dismissWaiterRef.current = resolve })
  }, [])
  const close = useCallback(() => {
    setReturnTo(null)
    setLoginError(null)
    dismissWaiterRef.current?.(true)
    dismissWaiterRef.current = null
  }, [])
  useEffect(() => {
    const currentReturn = parseOAuthReturnLocation(location.pathname, location.search, location.hash)
    if (!currentReturn) return
    navigate(currentReturn.returnTo, { replace: true })
  }, [location.pathname, location.search, location.hash, navigate])
  const value = useMemo(() => ({ requireLogin }), [requireLogin])

  return (
    <LoginGateContext.Provider value={value}>
      {children}
      {returnTo !== null && <LoginModal returnTo={returnTo} hideMessage={hideMessage} loginError={loginError} onClose={close} />}
    </LoginGateContext.Provider>
  )
}
