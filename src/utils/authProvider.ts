export const AUTH_PROVIDER_ISSUERS = {
  google: 'https://accounts.google.com',
  naver: 'https://nid.naver.com',
  kakao: 'https://kauth.kakao.com',
} as const

export function isAuthProviderIssuer(issuer: string | null | undefined): boolean {
  return Object.values(AUTH_PROVIDER_ISSUERS).some(providerIssuer => providerIssuer === issuer)
}
