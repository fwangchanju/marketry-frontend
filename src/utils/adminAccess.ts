// 관리자 화면·메뉴·탭을 보여 줄지 정하는 조건은 이 함수 하나만 쓴다. 화면에서 숨기는 것은 편의일 뿐이고 실제 보호는 서버의
// /api/admin/** ADMIN 권한이지만, 조건이 곳곳에서 조금씩 달라지면 한 곳만 느슨해져 관리자 전용이 일반 회원에게 보이게 된다.
// 로그인 상태가 아니거나(role이 남아 있어도) 특별 회원일 뿐이면 관리자가 아니다.
export function isAdminSession(session: { authenticated?: boolean; role?: string | null } | null | undefined): boolean {
  return session?.authenticated === true && session.role === 'ADMIN'
}

// 특별 회원 화면(일본 지도·J-SECTOR·J-STOCK, 설정창 실험 탭)을 볼 수 있는지 정한다. 관리자도 포함한다. 실제 보호는 서버의 /api/japan/** 검사다.
export function isSpecialSession(session: { authenticated?: boolean; role?: string | null; special?: boolean | null } | null | undefined): boolean {
  return isAdminSession(session) || (session?.authenticated === true && session.special === true)
}
