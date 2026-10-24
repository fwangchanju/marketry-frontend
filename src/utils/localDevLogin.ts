// 로컬 개발 서버의 자동 로그인(VITE_LOCAL_AUTO_LOGIN=1) 사용 여부. 개발 중 비로그인 화면을 확인할 수 있도록
// 주소에 ?guest=1을 붙여 열면 자동 로그인을 건너뛰고(이미 로그인된 상태면 한 번 로그아웃하고) 비로그인으로 시작한다.
// 그 상태는 브라우저에 저장돼 새 탭에서도 유지되고(로그아웃해도 같다), ADMIN·TEST 전환이나 ?guest=0으로 열면 다시 자동 로그인으로 돌아간다. 운영 빌드에는 영향이 없다.
const GUEST_MODE_STORAGE_KEY = 'dev.guestMode'

// 백엔드 AuthService의 로컬 테스트 회원 고정 ID와 맞춘다.
export const LOCAL_TEST_MEMBER_USER_ID = 800001

export function isLocalSignupEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.MODE !== 'mock' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
}

function isLocalAutoLoginConfigured(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_LOCAL_AUTO_LOGIN === '1'
}

// 로컬에서 비로그인 확인용(?guest=1)으로 열린 탭인지.
export function isLocalGuestMode(): boolean {
  if (!isLocalAutoLoginConfigured()) return false
  try {
    const param = new URLSearchParams(window.location.search).get('guest')
    if (param === '1') setLocalGuestMode(true)
    else if (param === '0') setLocalGuestMode(false)
    if (param === '1' || param === '0') {
      const url = new URL(window.location.href)
      url.searchParams.delete('guest')
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
    return localStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setLocalGuestMode(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(GUEST_MODE_STORAGE_KEY, '1')
    else localStorage.removeItem(GUEST_MODE_STORAGE_KEY)
  } catch {
    // 저장소 접근이 막혀도 개발 메뉴에서 계정 전환은 계속 시도한다.
  }
}

// 자동 로그인을 실제로 쓰는지 — 설정이 켜져 있고 비로그인 확인 모드가 아닐 때만 true.
export function isLocalAutoLoginEnabled(): boolean {
  return isLocalAutoLoginConfigured() && !isLocalGuestMode()
}

// 로컬 개발 전용 — 지금 접속한 계정이 상단바 "테스트 회원" 버튼으로 바꾼 테스트 회원인지. 이 브라우저에만 남기고,
// 자동 로그인(원래 계정)이 일어나면 꺼진다. 버튼이 "테스트 회원으로 바꾸기"와 "원래 계정으로 돌아가기" 중 무엇을 할지 정하는 데 쓴다.
const TEST_MEMBER_STORAGE_KEY = 'dev.testMemberActive'

export function isTestMemberActive(): boolean {
  try {
    return localStorage.getItem(TEST_MEMBER_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setTestMemberActive(active: boolean): void {
  try {
    if (active) localStorage.setItem(TEST_MEMBER_STORAGE_KEY, '1')
    else localStorage.removeItem(TEST_MEMBER_STORAGE_KEY)
  } catch {
    // 저장이 막혀도 화면 동작은 계속되게 조용히 무시
  }
}
