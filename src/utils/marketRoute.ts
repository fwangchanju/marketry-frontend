import type { MarketQuery } from '@/types/api'

const MARKET_ROUTE_SEGMENTS: Record<MarketQuery, string> = {
  KOSPI: 'kospi',
  KOSDAQ: 'kosdaq',
  ALL_STOCK: 'allstock',
}

const MARKET_BY_ROUTE_SEGMENT: Record<string, MarketQuery> = Object.fromEntries(
  Object.entries(MARKET_ROUTE_SEGMENTS).map(([market, segment]) => [segment, market]),
) as Record<string, MarketQuery>

export function marketToRouteSegment(market: MarketQuery): string {
  return MARKET_ROUTE_SEGMENTS[market]
}

export function marketFromRouteSegment(segment: string | undefined): MarketQuery | null {
  return segment ? MARKET_BY_ROUTE_SEGMENT[segment] ?? null : null
}

export function marketRoute(basePath: '/map' | '/graph', market: MarketQuery): string {
  return `${basePath}/${marketToRouteSegment(market)}`
}
