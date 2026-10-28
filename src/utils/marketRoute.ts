import type { MarketQuery } from '@/types/api'

const MARKET_ROUTE_SEGMENTS: Record<MarketQuery, string> = {
  KOSPI: 'kospi',
  KOSDAQ: 'kosdaq',
  ALL_STOCK: 'korea',
}

const MARKET_BY_ROUTE_SEGMENT: Record<string, MarketQuery> = Object.fromEntries(
  Object.entries(MARKET_ROUTE_SEGMENTS).map(([market, segment]) => [segment, market]),
) as Record<string, MarketQuery>

// 기존 검색 결과·북마크와의 호환을 위해 옛 주소 조각도 읽는다.
MARKET_BY_ROUTE_SEGMENT.allstock = 'ALL_STOCK'

export function marketToRouteSegment(market: MarketQuery): string {
  return MARKET_ROUTE_SEGMENTS[market]
}

export function marketFromRouteSegment(segment: string | undefined): MarketQuery | null {
  return segment ? MARKET_BY_ROUTE_SEGMENT[segment] ?? null : null
}

export function marketRoute(basePath: '/map' | '/graph', market: MarketQuery): string {
  const segment = marketToRouteSegment(market)
  return segment ? `${basePath}/${segment}` : basePath
}
