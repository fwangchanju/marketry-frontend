// 브라우저 탭·검색 결과에 보이는 페이지 제목(2026-11-15 사용자 결정). 규칙은 `{시장} {화면} - MARKETRY`이다.
// 시장 이름은 투자자가 검색에 쓰는 "주식"을 쓴다(한국주식·일본주식·미국주식). 지수 이름을 괄호로 덧붙이는 것은 하지 않기로 했다(사용자 결정).
const SITE_NAME = 'MARKETRY'

// 요약 화면의 시장 이름(증시). 다른 화면은 MARKET_NAMES(주식)를 쓴다.
const SUMMARY_MARKET_NAMES: Record<string, string> = { korea: '한국증시', kospi: '코스피', kosdaq: '코스닥', japan: '일본증시', usa: '미국증시' }
const MARKET_NAMES: Record<string, string> = { korea: '한국주식', kospi: '코스피', kosdaq: '코스닥', japan: '일본주식', usa: '미국주식' }
// 화면 이름 — 지도·그래프는 검색에 등록된 낱말("히트맵"·"등락률 그래프")을 그대로 쓴다. 설명문·가이드의 낱말과도 맞는다("업종 지도"로 정했다가 설명문과 어긋나 "히트맵"으로 되돌렸다).
const SCREEN_NAMES: Record<string, string> = { map: '히트맵', graph: '등락률 그래프', sector: '섹터', stock: '종목' }
const FIXED_TITLES: Record<string, string> = {
  '/info/guide': '히트맵 설정 방법',
  '/info/privacy': '개인정보처리방침',
  '/info/terms': '이용약관',
  '/info/source': '데이터 출처',
  '/info/contact': '문의',
  '/account/profile': '프로필',
  '/admin/member': '회원관리',
  '/admin/stats': '방문자 통계',
  '/admin/message': '메시지',
  '/admin/default': '설정 기본값',
  '/admin/banner': '배너',
}

// 주소의 페이지 제목. 대표 주소와 규칙에 없는 주소는 null(호출하는 쪽이 사이트 기본 제목을 쓴다).
export function pageTitle(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  const fixed = FIXED_TITLES[path]
  if (fixed) return `${fixed} - ${SITE_NAME}`
  const [, screen, market, sub] = path.split('/')
  if (screen === 'summary') {
    // 요약 화면은 시장 이름을 '증시'로 쓴다(2026-11-16 사용자 결정). 대표 주소(/summary/korea)도 같은 규칙을 따른다.
    const name = market === 'korea' && sub !== undefined ? SUMMARY_MARKET_NAMES[sub] : SUMMARY_MARKET_NAMES[market]
    if (!name || (market !== 'korea' && sub !== undefined)) return null
    return `${name} 요약 - ${SITE_NAME}`
  }
  const screenName = SCREEN_NAMES[screen]
  if (!screenName || !MARKET_NAMES[market]) return null
  // 코스피·코스닥은 korea 아래에 있다(/map/korea/kospi). korea 아래 다른 조각은 규칙에 없다.
  const marketName = market === 'korea' && sub !== undefined ? MARKET_NAMES[sub] : MARKET_NAMES[market]
  if (!marketName || (market !== 'korea' && sub !== undefined)) return null
  return `${marketName} ${screenName} - ${SITE_NAME}`
}
