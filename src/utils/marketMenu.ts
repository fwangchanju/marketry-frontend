import type { MarketQuery } from '@/types/api'
import { MARKET_OPTIONS } from '@/utils/marketOptions'
import { marketRoute } from '@/utils/marketRoute'

// 시장 배지를 누르면 열리는 목록. 한국 시장(KOREA·KOSPI·KOSDAQ)을 기본으로 하고,
// 특별 회원·관리자(includeOverseas)에게만 일본·미국을 더한다. 상단 메뉴의 해외 항목과 같은 조건이다.
export function marketMenu(basePath: '/map' | '/graph', current: MarketQuery | 'JAPAN' | 'USA', includeOverseas = false) {
  // KOSPI·KOSDAQ은 KOREA 아래 단계라 들여쓰기로 보여 준다.
  const korea = MARKET_OPTIONS.map(option => ({ label: option.label, to: marketRoute(basePath, option.market), active: option.market === current, indent: option.market !== 'ALL_STOCK' }))
  if (!includeOverseas) return korea
  return [
    ...korea,
    // 특별 회원 전용 항목은 보라 글자로 구분한다.
    { label: 'JAPAN', to: `${basePath}/japan`, active: current === 'JAPAN', special: true },
    { label: 'USA', to: `${basePath}/usa`, active: current === 'USA', special: true },
  ]
}

// 섹터·종목 화면의 목록. KOREA는 /sector/korea·/stock/korea이고, 일본·미국은 같은 종류의 주소를 쓴다.
// 상단 메뉴와 같이 특별 회원·관리자에게만 일본·미국을 더한다(일본·미국 화면에서는 항상 보인다).
export function customMenu(kind: 'sector' | 'stock', current: 'KOREA' | 'JAPAN' | 'USA', includeOverseas: boolean) {
  const items = [{ label: 'KOREA', to: `/${kind}/korea`, active: current === 'KOREA', indent: false, special: false }]
  if (!includeOverseas) return items
  return [
    ...items,
    { label: 'JAPAN', to: `/${kind}/japan`, active: current === 'JAPAN', special: true },
    { label: 'USA', to: `/${kind}/usa`, active: current === 'USA', special: true },
  ]
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
