import type { MarketQuery } from '@/types/api'

const MARKET_ROUTE_SEGMENTS: Record<MarketQuery, string> = {
  KOSPI: 'korea/kospi',
  KOSDAQ: 'korea/kosdaq',
  ALL_STOCK: 'korea',
}

const MARKET_BY_ROUTE_SEGMENT: Record<string, MarketQuery> = Object.fromEntries(
  // 주소의 마지막 조각(korea·kospi·kosdaq)으로 시장을 찾는다 — 코스피·코스닥은 korea 아래(korea/kospi)에 있다.
  Object.entries(MARKET_ROUTE_SEGMENTS).map(([market, segment]) => [segment.split('/').pop(), market]),
) as Record<string, MarketQuery>

export function marketToRouteSegment(market: MarketQuery): string {
  return MARKET_ROUTE_SEGMENTS[market]
}

export function marketFromRouteSegment(segment: string | undefined): MarketQuery | null {
  return segment ? MARKET_BY_ROUTE_SEGMENT[segment] ?? null : null
}

export function marketRoute(basePath: '/map' | '/graph' | '/summary', market: MarketQuery): string {
  const segment = marketToRouteSegment(market)
  return segment ? `${basePath}/${segment}` : basePath
}
