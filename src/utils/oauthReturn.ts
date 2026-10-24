export type OAuthLoginError = 'cancelled' | 'oauth_failed' | 'email_required'

export function parseOAuthReturnLocation(
  pathname: string,
  search: string,
  hash: string,
): { error: OAuthLoginError; returnTo: string } | null {
  const params = new URLSearchParams(search)
  const error = params.get('loginError')
  if (error !== 'cancelled' && error !== 'oauth_failed' && error !== 'email_required') return null

  params.delete('loginError')
  const remainingSearch = params.toString()
  return {
    error,
    returnTo: `${pathname}${remainingSearch ? `?${remainingSearch}` : ''}${hash}`,
  }
}
