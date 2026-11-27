import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { MarketId } from '@/markets/marketContract'
import { MOBILE_MARKET_OPTIONS, type MobileMapMarket } from '@/utils/mobileMarketRoutes'

// 종목 차트 화면(CHART) 주소 — /chart/korea/005930, /chart/japan/7203, /chart/usa/AAPL(2026-11-27 사용자 결정).
// 지도·제외 종목 팝업 등 어디서 차트를 열든 이 화면으로 이동하고, 닫기·뒤로가기로 원래 화면에 돌아간다.
export const CHART_MARKETS: readonly MobileMapMarket[] = ['korea', 'japan', 'usa']

// 화면 데이터의 시장(KOREA·JAPAN·USA) → 차트 주소의 시장. 공통 화면이 시장 이름으로 갈라지지 않게 여기서 바꾼다.
export const CHART_MARKET_OF: Record<MarketId, MobileMapMarket> = { KOREA: 'korea', JAPAN: 'japan', USA: 'usa' }

export function chartRoute(market: MobileMapMarket, stockCode: string): string {
  return `/chart/${market}/${encodeURIComponent(stockCode)}`
}

// 차트 화면으로 넘기는 값 — 주소에는 시장과 종목 코드만 있고, 이름·업종 경로·돌아갈 지도 주소는 브라우저 기록에 담는다.
// 주소만으로 들어오면(새 창·공유) 이 값이 없으므로 종목 코드를 이름 자리에, 시장 지도를 돌아갈 곳으로 쓴다.
export interface ChartRouteState {
  stockName?: string
  sectorPath?: string[]
  marketLabel?: string
  mapPath?: string
}

export function defaultMapPath(market: MobileMapMarket): string {
  return (MOBILE_MARKET_OPTIONS.find(option => option.key === market) ?? MOBILE_MARKET_OPTIONS[0]).path
}

// 차트 화면을 여는 함수. 돌아갈 지도 주소는 지금 지도 화면이면 그 주소(KOSPI 등 하위 시장 유지), 아니면 그 시장의 지도다.
export function useOpenStockChart() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((market: MobileMapMarket, stock: { code: string; name: string }, options?: { sectorPath?: string[]; marketLabel?: string }) => {
    const mapPath = location.pathname.startsWith('/map/') ? location.pathname : defaultMapPath(market)
    const state: ChartRouteState = { stockName: stock.name, sectorPath: options?.sectorPath ?? [], marketLabel: options?.marketLabel, mapPath }
    navigate(chartRoute(market, stock.code), { state })
  }, [navigate, location.pathname])
}
