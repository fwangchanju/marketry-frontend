import MobileMapStockChart from '@/components/MobileMapStockChart'
import type { PathCrumb } from '@/components/PathBar'
import type { ChartStock } from '@/hooks/useStockChart'

const LEVEL_LABELS = ['대분류', '중분류', '소분류', '세분류'] as const

// 폰 업종 지도·그룹 등락률의 종목 단계에서 여는 차트. 종목 지도와 같은 전체 화면 차트를 쓰고,
// 경로 이름을 누르면 차트를 닫은 뒤 이 화면의 경로 줄과 같은 단계로 돌아간다.
export default function PhonePathStockChart({ chartStock, crumbs, market, closeChart }: {
  chartStock: ChartStock | null
  crumbs: PathCrumb[]
  market: 'korea' | 'japan' | 'usa'
  closeChart: (afterClose?: () => void) => void
}) {
  if (!chartStock) return null
  return (
    <MobileMapStockChart
      chartStock={chartStock}
      marketLabel={crumbs[0]?.label ?? ''}
      levelLabels={LEVEL_LABELS}
      market={market}
      closeChart={closeChart}
      onGoToRoot={() => crumbs[0]?.onClick?.()}
      onEnterSector={name => crumbs.slice(1).find(crumb => crumb.label === name)?.onClick?.()}
    />
  )
}
