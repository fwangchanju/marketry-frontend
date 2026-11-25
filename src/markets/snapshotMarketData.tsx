import type { OverseasSheet } from '@/hooks/useOverseasSheet'
import type { MarketScreenData } from '@/markets/marketContract'
import MarketDatePicker from '@/components/MarketDatePicker'

import { collectItems } from '@/utils/sectorAverage'
import { overseasRoute } from '@/utils/markets'
import type { OverseasSummarySource } from '@/hooks/overseasSummarySource'

// 스냅샷 시장의 값을 공통 모양으로 바꾼다. PC와 MOBILE이 함께 쓴다.
export function snapshotMarketData(source: OverseasSummarySource, sheet: OverseasSheet, holidayColor: string, isLoading: boolean): MarketScreenData {
  const { market, label, currencyUnit, tree, indexBars, isError, isFetching, refetchAll, refreshHelp, sessionChip, snapshotTime, liveSnapshotTime, rangeStart, rangeExcludedStocks, select, selectRange, intradayDelta } = source
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime)
  return {
    id: market,
    label,
    currencyUnit,
    tree,
    indexBars,
    state: isLoading ? { status: 'loading' } : isError ? { status: 'error', retry: () => { void refetchAll() } } : { status: 'ready' },
    refresh: { run: () => { void refetchAll() }, isRunning: isFetching, help: refreshHelp },
    session: sessionChip,
    period: {
      snapshotTime,
      liveSnapshotTime,
      isPast: isPastSnapshot,
      rangeStart,
      excludedStocks: rangeExcludedStocks,
      clear: () => select(null),
      picker: <MarketDatePicker market={market} snapshotTime={snapshotTime} liveTime={liveSnapshotTime} rangeStart={rangeStart} holidayColor={holidayColor} onSelect={select} onSelectRange={selectRange} />,
    },
    isMineEmpty: sheet === 'MINE' && tree.every(node => collectItems(node).length === 0),
    mineSetupPath: overseasRoute('/sector', market),
    features: { subMarkets: null, afterHours: false, timeWindowNotice: null, exchangeTaxonomy: false, intradayDelta },
  }
}
