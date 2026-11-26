// MOBILE 지도 세 페이지(종목 지도·업종 지도·그룹 등락률)의 나라 순서와 주소. 하단 설정 줄의 마켓 선택과
// 위아래 밀기 나라 이동이 같은 목록을 쓴다. 순서는 한국 → 일본 → 미국이고 끝에서는 처음으로 돌아간다.
import type { MarketFlag } from '@/utils/marketFlag'
import { MARKET_LABEL } from '@/utils/marketOptions'
import { snapshotMarketInfo } from '@/utils/markets'

export type MobileMapMarket = 'korea' | 'japan' | 'usa'

export const MOBILE_MARKET_OPTIONS: { key: MobileMapMarket; label: string; path: string; graphPath: string; summaryPath: string }[] = [
  { key: 'korea', label: '한국', path: '/map/korea', graphPath: '/graph/korea', summaryPath: '/summary/korea' },
  { key: 'japan', label: '일본', path: '/map/japan', graphPath: '/graph/japan', summaryPath: '/summary/japan' },
  { key: 'usa', label: '미국', path: '/map/usa', graphPath: '/graph/usa', summaryPath: '/summary/usa' },
]

// 지금 보던 페이지 종류를 그대로 두고 나라만 바꾼 주소(종목 지도는 종목 지도로, 그룹 등락률은 그룹 등락률로).
export function mobileMarketPath(market: MobileMapMarket, pathname: string): string {
  const option = MOBILE_MARKET_OPTIONS.find(item => item.key === market) ?? MOBILE_MARKET_OPTIONS[0]
  if (pathname.startsWith('/summary/')) return option.summaryPath
  if (pathname.startsWith('/graph/')) return option.graphPath
  return option.path
}

export function adjacentMobileMarket(current: MobileMapMarket, direction: 'next' | 'previous'): MobileMapMarket {
  const count = MOBILE_MARKET_OPTIONS.length
  const index = Math.max(0, MOBILE_MARKET_OPTIONS.findIndex(item => item.key === current))
  return MOBILE_MARKET_OPTIONS[(index + (direction === 'next' ? 1 : count - 1)) % count].key
}

// 위아래로 밀 때 따라오는 다음 판에 보이는 국기와 시장 이름(툴바 시장 배지와 같은 글자).
export const MOBILE_MARKET_BADGE: Record<MobileMapMarket, { flag: MarketFlag; label: string }> = {
  korea: { flag: 'KR', label: MARKET_LABEL.ALL_STOCK },
  japan: { flag: 'JP', label: snapshotMarketInfo('JAPAN').badgeLabel },
  usa: { flag: 'US', label: snapshotMarketInfo('USA').badgeLabel },
}
