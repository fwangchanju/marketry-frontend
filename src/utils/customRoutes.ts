// 섹터·스톡 화면의 주소. 예전에는 Custom 하나였고 주소가 /custom 아래에 있었다(2026-11-14 메뉴를 Sector·Stock으로 나누면서 주소도 바꿨다).
// 서버 API 주소(/api/custom/**)와는 다르다. 그쪽은 그대로다.
export const SECTOR_KOREA = '/sector/korea'
export const SECTOR_JAPAN = '/sector/japan'
export const STOCK_KOREA = '/stock/korea'
export const STOCK_JAPAN = '/stock/japan'

// 옛 주소 → 새 주소. 즐겨찾기·가이드 링크·로그인 뒤 돌아오는 주소가 끊기지 않게 새 주소로 이동시킨다.
const LEGACY_TARGETS: Readonly<Record<string, string>> = {
  '/custom': SECTOR_KOREA,
  '/custom/sector': SECTOR_KOREA,
  '/custom/stock': STOCK_KOREA,
  '/custom/sector/japan': SECTOR_JAPAN,
  '/custom/stock/japan': STOCK_JAPAN,
}

export function legacyCustomTarget(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return LEGACY_TARGETS[clean] ?? null
}

// 섹터·스톡 화면(새 주소와 옛 주소)인지. 방문 집계 분류와 숫자 모양 규칙이 쓴다.
export function isCustomPagePath(pathname: string): boolean {
  return pathname === '/custom' || pathname.startsWith('/custom/') || pathname.startsWith('/sector/') || pathname.startsWith('/stock/')
}
