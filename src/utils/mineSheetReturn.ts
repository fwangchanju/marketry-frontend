// 비로그인이 내 기준을 고르면 로그인 뒤 내 기준으로 돌아오도록, 돌아올 주소에 커스텀 화면과 같은 sheet=MINE을 붙인다.
export function mineSheetReturnPath(pathname: string, search = '', hash = ''): string {
  const params = new URLSearchParams(search)
  params.set('sheet', 'MINE')
  return `${pathname}?${params.toString()}${hash}`
}

export function hasMineSheetRequest(search: string): boolean {
  const sheet = new URLSearchParams(search).get('sheet')?.toUpperCase()
  return sheet === 'MINE' || sheet === 'MYMAP'
}

export function withoutSheetParam(search: string): string {
  const params = new URLSearchParams(search)
  params.delete('sheet')
  const rest = params.toString()
  return rest ? `?${rest}` : ''
}
