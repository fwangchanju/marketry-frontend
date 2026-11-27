import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import MapStockChart from '@/components/MapStockChart'
import MobileMapStockChart from '@/components/MobileMapStockChart'
import PcPageFrame from '@/components/PcPageFrame'
import ToolbarModeText from '@/components/ToolbarModeText'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { CHART_MARKETS, defaultMapPath, type ChartRouteState } from '@/utils/chartRoute'
import { MOBILE_MARKET_BADGE, type MobileMapMarket } from '@/utils/mobileMarketRoutes'

const LEVEL_LABELS = ['대분류', '중분류', '소분류', '세분류'] as const

// 종목 차트 화면(CHART, /chart/시장/종목코드) — 지도 안에 띄우던 차트를 독립 화면으로 옮겼다(2026-11-27 사용자 결정).
// PC는 다른 화면과 같은 상단·메뉴·툴바 틀 안에, MOBILE은 CHART 제목의 전체 화면으로 그린다. 차트 그림과 경로 줄은 예전 지도 차트와 같다.
// 닫기·뒤로가기는 들어온 화면으로 돌아가고(지도는 업종 단계·기간 선택을 유지), 경로 이름을 누르면 그 업종의 지도로 간다.
export default function StockChartPage() {
  const { market: marketParam, code } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isNarrow = useIsNarrowScreen()
  const queryClient = useQueryClient()
  const isFetching = useIsFetching({ queryKey: ['stock-daily-candles'] })
  const market = CHART_MARKETS.find(item => item === marketParam) as MobileMapMarket | undefined
  if (!market || !code) return <Navigate to="/summary/korea" replace />

  const state = (location.state ?? {}) as ChartRouteState
  const chartStock = { code, name: state.stockName ?? code, sectorPath: state.sectorPath ?? [] }
  const marketLabel = state.marketLabel ?? MOBILE_MARKET_BADGE[market].label
  const mapPath = state.mapPath ?? defaultMapPath(market)
  // 사이트 안에서 들어왔으면 한 칸 뒤로(들어온 화면 그대로), 주소로 바로 들어왔으면 그 시장의 지도로 간다.
  const close = () => {
    if (location.key !== 'default') navigate(-1)
    else navigate(mapPath, { replace: true })
  }
  const goToRoot = () => navigate(mapPath)
  const goToSector = (name: string) => navigate(`${mapPath}?sector=${encodeURIComponent(name)}`)
  // 차트 부품은 "닫은 뒤 할 일"을 넘기는 방식이라, 할 일이 있으면 그 이동만 하고 없으면 닫는다.
  const closeChart = (afterClose?: () => void) => (afterClose ? afterClose() : close())

  if (isNarrow) {
    return (
      <MobileMapStockChart
        chartStock={chartStock}
        marketLabel={marketLabel}
        levelLabels={LEVEL_LABELS}
        market={market}
        closeChart={closeChart}
        onGoToRoot={goToRoot}
        onEnterSector={goToSector}
      />
    )
  }
  return (
    <PcPageFrame
      toolbar={<ToolbarModeText page="CHART" label={marketLabel} />}
      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['stock-daily-candles'] })}
      isRefreshing={isFetching > 0}
    >
      <MapStockChart
        chartStock={chartStock}
        marketLabel={marketLabel}
        levelLabels={LEVEL_LABELS}
        market={market}
        closeChart={closeChart}
        onGoToRoot={goToRoot}
        onEnterSector={goToSector}
      />
    </PcPageFrame>
  )
}
