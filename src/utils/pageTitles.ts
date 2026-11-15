// 브라우저 탭·검색 결과에 보이는 페이지 제목(2026-11-15 사용자 결정). 규칙은 `{시장} {화면} - MARKETRY`이다.
// 시장 이름은 투자자가 검색에 쓰는 "주식"을 쓴다(한국주식·일본주식·미국주식). 지수 이름을 괄호로 덧붙이는 것은 하지 않기로 했다(사용자 결정).
// 대표 주소(/summary/korea)는 사이트 이름 제목(MARKETRY - Design Your Market)을 그대로 둔다 — 구글이 사이트 이름을 읽을 때 참고해서다.
// 대표 주소를 따로 소개하는 홈 화면은 나중에 만들면서 다시 정한다.
const SITE_NAME = 'MARKETRY'

const MARKET_NAMES: Record<string, string> = { korea: '한국주식', kospi: '코스피', kosdaq: '코스닥', japan: '일본주식', usa: '미국주식' }
// 화면 이름 — 지도·그래프는 검색에 등록된 낱말("히트맵"·"등락률 그래프")을 그대로 쓴다. 설명문·가이드의 낱말과도 맞는다("업종 지도"로 정했다가 설명문과 어긋나 "히트맵"으로 되돌렸다).
const SCREEN_NAMES: Record<string, string> = { summary: '요약', map: '히트맵', graph: '등락률 그래프', sector: '섹터', stock: '종목' }
const FIXED_TITLES: Record<string, string> = {
  '/info/guide': '증시 히트맵 설정 방법',
  '/info/privacy': '개인정보처리방침',
  '/info/terms': '이용약관',
  '/info/source': '데이터 출처',
  '/info/contact': '문의',
  '/account/profile': '프로필',
  '/admin/member': '관리자 회원',
  '/admin/stats': '관리자 통계',
  '/admin/message': '관리자 메시지',
  '/admin/default': '관리자 기본값',
  '/admin/banner': '관리자 배너',
}

// 주소의 페이지 제목. 대표 주소와 규칙에 없는 주소는 null(호출하는 쪽이 사이트 기본 제목을 쓴다).
export function pageTitle(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === '/summary/korea') return null
  const fixed = FIXED_TITLES[path]
  if (fixed) return `${fixed} - ${SITE_NAME}`
  const [, screen, market, sub] = path.split('/')
  const screenName = SCREEN_NAMES[screen]
  if (!screenName || !MARKET_NAMES[market]) return null
  // 코스피·코스닥은 korea 아래에 있다(/map/korea/kospi). korea 아래 다른 조각은 규칙에 없다.
  const marketName = market === 'korea' && sub !== undefined ? MARKET_NAMES[sub] : MARKET_NAMES[market]
  if (!marketName || (market !== 'korea' && sub !== undefined)) return null
  return `${marketName} ${screenName} - ${SITE_NAME}`
}
