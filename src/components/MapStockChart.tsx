import StockCandleChart from '@/components/StockCandleChart'
import StockChartView from '@/components/StockChartView'
import type { ChartStock } from '@/hooks/useStockChart'

// 지도 페이지(한국·일본·미국)가 지도 자리에 띄우는 종목 차트 — 경로 줄(이름을 누르면 그 분류의 지도로)과 일봉 차트.

export default function MapStockChart({
  chartStock,
  marketLabel,
  levelLabels,
  market,
  closeChart,
  onGoToRoot,
  onEnterSector,
}: {
  chartStock: ChartStock
  marketLabel: string
  levelLabels: readonly string[]
  market: 'korea' | 'japan' | 'usa'
  // 차트를 닫는다. 닫은 뒤에 할 일(지도 이동)을 넘기면 지도가 다시 그려진 뒤에 실행한다.
  closeChart: (afterClose?: () => void) => void
  // 전체 지도로 이동 / 분류 이름의 지도로 이동 — 페이지마다 줌아웃·분류 진입 방식이 달라 받는다.
  onGoToRoot: () => void
  onEnterSector: (sectorName: string) => void
}) {
  return (
    <StockChartView
      marketLabel={marketLabel}
      sectors={chartStock.sectorPath}
      levelLabels={levelLabels}
      onClose={() => closeChart()}
      onGoToSector={name => closeChart(name === null ? onGoToRoot : () => { onEnterSector(name) })}
    >
      <StockCandleChart stockCode={chartStock.code} stockName={chartStock.name} market={market} />
    </StockChartView>
  )
}
