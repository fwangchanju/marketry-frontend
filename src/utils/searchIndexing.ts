// 검색엔진에 노출하지 않을 화면(2026-11-16 사용자 결정) — 관리자와 프로필은 본인·관리자만 쓰는 화면이라 검색에 나오면 안 된다.
// 일본·미국 화면은 공개 여부를 정할 때까지 지금처럼 둔다.
export function isNoIndexPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/account' || pathname.startsWith('/account/')
}
