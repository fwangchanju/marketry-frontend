import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import SnapshotMobile from '@/markets/SnapshotMobile'
import SnapshotSummary from '@/markets/SnapshotSummary'
import type { SnapshotMarket } from '@/utils/markets'

export default function ResponsiveSnapshotSummary({ market }: { market: SnapshotMarket }) {
  return useIsNarrowScreen() ? <SnapshotMobile key={market} market={market} mode="sector" /> : <SnapshotSummary key={market} market={market} />
}
