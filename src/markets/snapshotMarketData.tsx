import type { SnapshotSheet } from '@/markets/useSnapshotSheet'
import type { MarketScreenData } from '@/markets/marketContract'
import MarketDatePicker from '@/components/MarketDatePicker'
import { ChangeRateModeSelector } from '@/components/ToolbarControls'

import { collectItems } from '@/utils/sectorAverage'
import { snapshotRoute } from '@/utils/markets'
import type { SnapshotSource } from '@/markets/snapshotSource'

// 스냅샷 시장의 값을 공통 모양으로 바꾼다. PC와 MOBILE이 함께 쓴다.
export function snapshotMarketData(source: SnapshotSource, sheet: SnapshotSheet, holidayColor: string, isLoading: boolean): MarketScreenData {
  const { market, label, currencyUnit, tree, indexBars, isError, isFetching, refetchAll, refreshHelp, sessionChip, snapshotTime, liveSnapshotTime, rangeStart, rangeExcludedStocks, select, selectRange, intradayDelta, basis } = source
  // 종가 기준 화면(애프터마켓 중 종가 줄을 보는 것)은 지난 날짜를 고른 것이 아니라 같은 날 기준만 바꾼 것이다.
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime && basis.isCloseView === false)
  return {
    id: market,
    label,
    currencyUnit,
    tree,
    indexBars,
    state: isLoading ? { status: 'loading' } : isError ? { status: 'error', retry: () => { void refetchAll() } } : { status: 'ready' },
    refresh: { run: () => { void refetchAll() }, isRunning: isFetching, help: refreshHelp },
    session: basis.visible ? <>{sessionChip}<ChangeRateModeSelector basis={basis.choice} selectable onChange={basis.onChange} /></> : sessionChip,
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
    mineSetupPath: snapshotRoute('/sector', market),
    features: { subMarkets: null, afterHours: false, timeWindowNotice: null, exchangeTaxonomy: false, intradayDelta },
  }
}
