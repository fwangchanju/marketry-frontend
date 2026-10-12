import { createContext, useContext } from 'react'

export interface LoginGateContextValue {
  // 로그인 팝업을 연다. path는 로그인 성공 후 돌아올 프론트 경로 — 메뉴 클릭이면 그 메뉴의 목적지,
  // 커스텀 페이지 직접 진입/새로고침이면 지금 있는 경로를 그대로 넘긴다.
  // options.hideMessage가 true면 팝업의 안내 문구("로그인 후 이용 가능합니다.")를 숨긴다 — 오른쪽 위 로그인 버튼처럼
  // 그냥 로그인하려는 경우용이다.
  // 반환값은 팝업이 닫힐 때 정해진다 — 사용자가 로그인 없이 닫으면 true, 팝업을 열지 않았거나 다시 열렸으면 false.
  requireLogin: (path: string, options?: { hideMessage?: boolean }) => Promise<boolean>
}

// Provider 구현(LoginGateProvider)은 JSX가 필요해 components/LoginGateProvider.tsx에 둔다 — 이
// 파일은 컴포넌트가 아닌 값(context, 훅)만 내보내야 컴포넌트 전용 fast-refresh 규칙과 충돌하지 않는다.
export const LoginGateContext = createContext<LoginGateContextValue | null>(null)

export function useLoginGate(): LoginGateContextValue {
  const context = useContext(LoginGateContext)
  if (!context) throw new Error('useLoginGate는 LoginGateProvider 내부에서만 사용할 수 있습니다.')
  return context
}
