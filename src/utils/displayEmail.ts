const PLACEHOLDER_EMAIL_DOMAIN = '@example.invalid'
const LOCAL_TEST_EMAIL = `local-test-member${PLACEHOLDER_EMAIL_DOMAIN}`

// 개발·예시용 가짜 주소는 화면에서만 MARKETRY 계정 표시로 바꾼다. 인증·저장 데이터는 수정하지 않는다.
// 로컬 테스트 회원은 프로필 메뉴 폭에 맞게 `-member`를 뺀 `local-test@marketry.co.kr`로 보여준다.
export function displayEmail(email: string | null | undefined): string | null {
  if (!email) return null
  if (email.toLowerCase() === LOCAL_TEST_EMAIL) return 'local-test@marketry.co.kr'
  if (!email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN)) return email
  return `${email.slice(0, -PLACEHOLDER_EMAIL_DOMAIN.length)}@marketry.co.kr`
}
