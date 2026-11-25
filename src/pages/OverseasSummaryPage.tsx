import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import SnapshotMobile from '@/markets/SnapshotMobile'
import SnapshotSummary from '@/markets/SnapshotSummary'
import type { OverseasMarket } from '@/utils/markets'

export default function OverseasSummaryPage({ market }: { market: OverseasMarket }) {
  return useIsNarrowScreen() ? <SnapshotMobile key={market} market={market} mode="sector" /> : <SnapshotSummary key={market} market={market} />
}
