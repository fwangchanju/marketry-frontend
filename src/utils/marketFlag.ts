import { OVERSEAS_SEGMENT_PATTERN, overseasMarketBySegment, type OverseasMarket } from './markets.ts'

// 좌측 세로 메뉴(NavSubBar) 맨 위에 보이는 국기. 한국 시장(KOREA·KOSPI·KOSDAQ)은 모두 태극기 하나다.
export type MarketFlag = 'KR' | 'JP' | 'US'

export const KOREA_FLAG: MarketFlag = 'KR'

export function flagOfOverseasMarket(market: OverseasMarket): MarketFlag {
  return market === 'JAPAN' ? 'JP' : 'US'
}

const MARKET_PAGE_PATTERN = /^\/(map|graph|summary|sector|stock)(\/|$)/
const OVERSEAS_SEGMENT = new RegExp(`/(${OVERSEAS_SEGMENT_PATTERN})(/|$)`)

// 지금 보는 화면의 시장 국기. 시장 화면(지도·그래프·서머리·섹터·종목)에서만 있고, 어드민·정보·프로필 같은 화면에는 없다(null).
export function flagForPath(pathname: string): MarketFlag | null {
  if (MARKET_PAGE_PATTERN.test(pathname) === false) return null
  const overseas = overseasMarketBySegment(OVERSEAS_SEGMENT.exec(pathname)?.[1] ?? null)
  return overseas ? flagOfOverseasMarket(overseas.id) : KOREA_FLAG
}
