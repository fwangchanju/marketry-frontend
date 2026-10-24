import client from './client'
import { AuthSessionResponseSchema } from '@/types/api'

// 전체 페이지 이동(팝업/XHR 아님)으로 열어야 하는 로그인 시작 URL. returnTo는 로그인 성공 후
// 돌아올 프론트엔드 경로("/"로 시작하는 절대 경로)만 허용된다(백엔드가 그 외 값은 400으로 거절).
export const googleLoginUrl = (returnTo: string) =>
  `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`

// 로그인하지 않은 방문자가 어디서 들어왔는지 서버가 구분할 수 있게 세션을 물을 때 같이 실어 보낸다 — 이전 페이지는 주소가 아니라 도메인(origin)까지만,
// 주소의 utm_source는 짧은 글자만 보낸다. 서버가 받는 Referer는 우리 사이트 자신이라 쓸 수 없다.
const MAX_SOURCE_LENGTH = 40

function visitHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}
  try {
    if (document.referrer) headers['X-Visit-Referrer'] = new URL(document.referrer).origin
  } catch {
    // 읽을 수 없는 이전 페이지 주소는 보내지 않는다(서버는 없는 것으로 본다).
  }
  const utmSource = new URLSearchParams(window.location.search).get('utm_source')
  if (utmSource && /^[\w.-]+$/.test(utmSource) && utmSource.length <= MAX_SOURCE_LENGTH) headers['X-Visit-Source'] = utmSource
  return headers
}

export const getSession = () =>
  client.get('/auth/session', { headers: visitHeaders() }).then(r => AuthSessionResponseSchema.parse(r.data))

export const logout = () => client.post('/auth/logout')

// 로컬 개발 전용 — VITE_LOCAL_AUTO_LOGIN=1일 때만 useLocalDevLogin이 호출한다. 백엔드가
// prod 프로필이 아닐 때만 열어주는 엔드포인트로, 구글 로그인과 동일한 인증 쿠키를 심어주고
// /auth/refresh와 같은 형식의 세션 응답을 돌려준다.
export const devLogin = () =>
  client.post('/auth/dev-login').then(r => AuthSessionResponseSchema.parse(r.data))

// 백엔드 local 프로필에서만 새 테스트 회원을 만들고 실제 가입 초기화·세션 발급을 수행한다.
export const devSignup = () =>
  client.post('/auth/dev-signup').then(r => AuthSessionResponseSchema.parse(r.data))
