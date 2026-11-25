import MapStockChart from '@/components/MapStockChart'
import MobileTopBar from '@/components/MobileTopBar'
import { CloseIcon } from '@/components/icons/AppIcons'
import type { ChartStock } from '@/hooks/useStockChart'

// MOBILE 종목 지도에서 종목을 누르면 여는 차트 화면. 810px 판을 축소한 지도 자리에 그리면 글자가 너무 작아지므로
// 화면 전체를 덮는다. PC 차트와 같은 MapStockChart(경로 줄·일봉 차트)를 쓰고, 닫기·뒤로가기·경로 이름으로
// 지도로 돌아간다. 이 덮개는 실제 MOBILE 화면에서만 렌더하고 캡처·스와이프 미리보기에는 붙이지 않는다.
export default function MobileMapStockChart({
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
  closeChart: (afterClose?: () => void) => void
  onGoToRoot: () => void
  onEnterSector: (sectorName: string) => void
}) {
  return (
    <div role="dialog" aria-modal="true" aria-label="종목 차트" data-mobile-stock-chart className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-ui-background">
      <MobileTopBar
        title="종목 차트"
        right={
          <button
            type="button"
            aria-label="차트 닫기"
            onClick={() => closeChart()}
            className="flex h-11 w-11 items-center justify-center border-0 bg-transparent text-ui-white"
          >
            <CloseIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        }
      />
      <MapStockChart
        chartStock={chartStock}
        marketLabel={marketLabel}
        levelLabels={levelLabels}
        market={market}
        closeChart={closeChart}
        onGoToRoot={onGoToRoot}
        onEnterSector={onEnterSector}
      />
    </div>
  )
}
