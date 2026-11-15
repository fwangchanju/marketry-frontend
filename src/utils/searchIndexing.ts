// 검색엔진에 노출하지 않을 화면(2026-11-16 사용자 결정) — 관리자·프로필은 본인·관리자만 쓰는 화면이고, 이용약관·개인정보처리방침·데이터 출처·문의는
// 구글 로그인 동의 화면용 공개 페이지라 접근은 막지 않고 검색에서만 뺀다(가이드는 검색에 등록한 주소라 뺀 목록에 없다).
// 일본·미국 화면은 공개 여부를 정할 때까지 지금처럼 둔다.
const NO_INDEX_INFO_PATHS = new Set(['/info/privacy', '/info/terms', '/info/source', '/info/contact'])

export function isNoIndexPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  return path === '/admin' || path.startsWith('/admin/') || path === '/account' || path.startsWith('/account/') || NO_INDEX_INFO_PATHS.has(path)
}
