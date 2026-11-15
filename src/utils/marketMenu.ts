import type { MarketQuery } from '@/types/api'
import { MARKET_OPTIONS } from '@/utils/marketOptions'
import { marketRoute } from '@/utils/marketRoute'
import { OVERSEAS_MARKETS, overseasRoute, type OverseasMarket } from '@/utils/markets'

// 시장 배지를 누르면 열리는 목록. 한국 시장(KOREA·KOSPI·KOSDAQ)을 기본으로 하고,
// 특별 회원·관리자(includeOverseas)에게만 일본·미국을 더한다. 상단 메뉴의 해외 항목과 같은 조건이다.
export function marketMenu(basePath: '/map' | '/graph' | '/summary', current: MarketQuery | OverseasMarket, includeOverseas = false) {
  // KOSPI·KOSDAQ은 KOREA 아래 단계라 들여쓰기로 보여 준다.
  const korea = MARKET_OPTIONS.map(option => ({ label: option.label, to: marketRoute(basePath, option.market), active: option.market === current, indent: option.market !== 'ALL_STOCK' }))
  if (!includeOverseas) return korea
  return [
    ...korea,
    // 특별 회원 전용 항목은 보라 글자로 구분한다.
    ...OVERSEAS_MARKETS.map(market => ({ label: market.menuLabel, to: overseasRoute(basePath, market.id), active: current === market.id, special: false })),
  ]
}

// 섹터·종목 화면의 목록. KOREA는 /sector/korea·/stock/korea이고, 일본·미국은 같은 종류의 주소를 쓴다.
// 상단 메뉴와 같이 특별 회원·관리자에게만 일본·미국을 더한다(일본·미국 화면에서는 항상 보인다).
export function customMenu(kind: 'sector' | 'stock', current: 'KOREA' | OverseasMarket, includeOverseas: boolean) {
  const items = [{ label: 'KOREA', to: `/${kind}/korea`, active: current === 'KOREA', indent: false, special: false }]
  if (!includeOverseas) return items
  return [
    ...items,
    ...OVERSEAS_MARKETS.map(market => ({ label: market.menuLabel, to: overseasRoute(`/${kind}`, market.id), active: current === market.id, special: false })),
  ]
}

// 글 페이지(INFO)의 목록. 화면 아래 줄의 안내 링크(이용약관·개인정보처리방침·데이터·가이드·문의)와 같은 순서이고 글자는 각 화면의 배지 제목이다.
export const INFO_MENU_ITEMS = [
  { label: 'TERMS', to: '/info/terms' },
  { label: 'PRIVACY', to: '/info/privacy' },
  { label: 'SOURCE', to: '/info/source' },
  { label: 'GUIDE', to: '/info/guide' },
  { label: 'CONTACT', to: '/info/contact' },
] as const

export function infoMenu(current: string) {
  return INFO_MENU_ITEMS.map(item => ({ ...item, active: item.label === current }))
}

// 어드민 화면의 목록. 상단 메뉴의 Admin 항목과 같은 다섯 개다.
export function adminMenu(current: 'MEMBER' | 'STATS' | 'MESSAGE' | 'DEFAULT' | 'BANNER') {
  const items: { label: 'MEMBER' | 'STATS' | 'MESSAGE' | 'DEFAULT' | 'BANNER'; to: string }[] = [
    { label: 'MEMBER', to: '/admin/member' },
    { label: 'STATS', to: '/admin/stats' },
    { label: 'MESSAGE', to: '/admin/message' },
    { label: 'DEFAULT', to: '/admin/default' },
    { label: 'BANNER', to: '/admin/banner' },
  ]
  return items.map(item => ({ ...item, active: item.label === current }))
}
