import OverseasSummaryView from '@/pages/OverseasSummaryView'
import { useSnapshotMarketSummary } from '@/markets/useSnapshotMarketSummary'
import type { OverseasMarket } from '@/utils/markets'

export default function OverseasSummaryPage({ market }: { market: OverseasMarket }) {
  return <OverseasSummaryView source={useSnapshotMarketSummary(market)} />
}
