import type { HeatmapSectorNode } from '@/types/api'
import { findStockSectorPath } from '@/utils/stockSectorPath'
import { useOpenStockChart } from '@/utils/chartRoute'
import type { MobileMapMarket } from '@/utils/mobileMarketRoutes'
import { useLocalPersistedState } from './useLocalPersistedState'

// 종목 차트를 여는 방식 — 우클릭(팝업의 차트 아이콘), 클릭, 더블 클릭. 설정창 공통 설정 탭의 "종목 차트"에서 고른다.
export type StockChartTrigger = 'rightClick' | 'click' | 'doubleClick'

export interface ChartStock {
  code: string
  name: string
  // 종목이 속한 분류(대분류부터) — 차트 위 경로 줄에 지도 경로 줄처럼 보여 준다.
  sectorPath: string[]
}

// 지도 페이지(한국·일본·미국)가 같이 쓰는 차트 열기 — 여는 방식(우클릭·원 클릭·더블 클릭)과 종목이 속한 분류 찾기.
// 차트는 지도 안이 아니라 종목 차트 화면(CHART)으로 이동해서 연다(2026-11-27 사용자 결정). 돌아오면 지도는 업종 단계·기간 선택을 유지한다.
// 여는 방식은 로그인한 사용자만 이 브라우저에 저장하고(비로그인은 저장하지 않는다), 모드·시장(한국·일본·미국)과 상관없이 하나로 쓴다.
export function useMapStockChart({
  stockPopupOnHover,
  sectorNodes,
  market,
  marketLabel,
}: {
  stockPopupOnHover: boolean
  // 종목이 속한 분류를 찾을 트리.
  sectorNodes: readonly HeatmapSectorNode[]
  market: MobileMapMarket
  marketLabel: string
}) {
  const openChartPage = useOpenStockChart()
  const [chosenTrigger, setStockChartTrigger] = useLocalPersistedState<StockChartTrigger>('marketry:stock-chart-trigger', 'rightClick')
  // 종목 정보가 마우스 올리기이면 우클릭 팝업이 없어서, 우클릭을 골라 둔 상태여도 원 클릭으로 연다.
  const stockChartTrigger: StockChartTrigger = stockPopupOnHover && chosenTrigger === 'rightClick' ? 'click' : chosenTrigger
  const openStockChart = (stock: { code: string; name: string }) => openChartPage(market, stock, { sectorPath: findStockSectorPath(sectorNodes, stock.code) ?? [], marketLabel })
  return { stockChartTrigger, setStockChartTrigger, openStockChart }
}

// 종목 정보를 여는 방식(우클릭·마우스 올리기). 종목 차트와 같이 모드·시장과 상관없이 하나이고, 로그인한 사용자만 이 브라우저에 저장한다.
export function useStockPopupOnHover(defaultValue: boolean) {
  return useLocalPersistedState('marketry:stock-popup-on-hover', defaultValue)
}
