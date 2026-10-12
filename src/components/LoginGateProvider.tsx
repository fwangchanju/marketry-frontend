import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { LoginGateContext } from '@/hooks/useLoginGate'
import LoginModal from './LoginModal'
import { isLocalAutoLoginEnabled } from '@/utils/localDevLogin'

// App 루트에서 한 번만 감싼다 — 어느 화면에서든 useLoginGate()로 같은 팝업을 띄울 수 있다.
export default function LoginGateProvider({ children }: { children: ReactNode }) {
  // 로컬 자동 로그인이 켜져 있으면 팝업 대신 자동으로 로그인되므로 팝업을 열지 않는다(?guest=1이면 정상으로 연다).
  const localAutoLogin = isLocalAutoLoginEnabled()
  const [returnTo, setReturnTo] = useState<string | null>(null)
  const [hideMessage, setHideMessage] = useState(false)

  // 팝업이 닫힐 때까지 기다리는 호출자에게 "사용자가 로그인 없이 닫았다"를 알린다. 팝업을 다시 열면 앞선 대기는 닫힌 것으로 치지 않고 끝낸다.
  const dismissWaiterRef = useRef<((dismissed: boolean) => void) | null>(null)

  const requireLogin = useCallback((path: string, options?: { hideMessage?: boolean }) => {
    if (localAutoLogin) return Promise.resolve(false)
    dismissWaiterRef.current?.(false)
    setHideMessage(options?.hideMessage ?? false)
    setReturnTo(path)
    return new Promise<boolean>(resolve => { dismissWaiterRef.current = resolve })
  }, [localAutoLogin])
  const close = useCallback(() => {
    setReturnTo(null)
    dismissWaiterRef.current?.(true)
    dismissWaiterRef.current = null
  }, [])
  const value = useMemo(() => ({ requireLogin }), [requireLogin])

  return (
    <LoginGateContext.Provider value={value}>
      {children}
      {!localAutoLogin && returnTo !== null && <LoginModal returnTo={returnTo} hideMessage={hideMessage} onClose={close} />}
    </LoginGateContext.Provider>
  )
}
