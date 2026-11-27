import type { MarketScreenData } from '@/markets/marketContract'
import { SECTOR_KOREA } from '@/utils/customRoutes'
import { SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import NxtOnlyNotice from '@/components/NxtOnlyNotice'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import { MarketSessionGroup, TradingSessionChip } from '@/components/ToolbarControls'
import { useKoreaSettings } from '@/markets/useKoreaSettings'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel } from '@/utils/format'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { collectItems } from '@/utils/sectorAverage'
import type { MarketQuery } from '@/types/api'

// 서머리 배치
const KOREA_LABELS: Record<MarketQuery, string> = { ALL_STOCK: 'K-STOCK', KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ' }
type KoreaSettings = ReturnType<typeof useKoreaSettings>

// 한국의 값을 공통 모양으로 바꾼다. PC와 MOBILE이 함께 쓴다.
export function koreaMarketData(settings: KoreaSettings, indexBars: MarketScreenData['indexBars'], isLoading: boolean): MarketScreenData {
  const { market, settingsModalProps, data, rootNodes, isError, refetchHeatmap, isRefetchingHeatmap, pinnedSnapshotTime, rangeStartTime, rangeExcludedStocks, changeRateChoice, colorScale, nxtOnly, nxtOnlyWindow, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange, isAfterHoursControlsVisible, isAfterHoursSelectable, onChangeChangeRateMode } = settings
  const isPastSnapshot = pinnedSnapshotTime !== undefined
  return {
    id: 'KOREA',
    label: KOREA_LABELS[market],
    currencyUnit: '원',
    tree: rootNodes,
    indexBars,
    state: isLoading ? { status: 'loading' } : isError ? { status: 'error', retry: refetchHeatmap } : { status: 'ready' },
    refresh: { run: refetchHeatmap, isRunning: isRefetchingHeatmap, help: SNAPSHOT_REFRESH_HELP },
    // 종가 지도는 정규장이 끝난 시점의 지도라서, 지금이 애프터 마켓이어도 시간대 글자는 "마켓 종료"로 둔다.
    session: <MarketSessionGroup session={<TradingSessionChip session={changeRateChoice === 'close' ? '마켓 종료' : undefined} />} basis={{ visible: isAfterHoursControlsVisible, choice: changeRateChoice, selectable: isAfterHoursSelectable, onChange: onChangeChangeRateMode }} />,
    period: {
      snapshotTime: data?.snapshotTime ?? null,
      liveSnapshotTime,
      isPast: isPastSnapshot,
      rangeStart: isPastSnapshot && pinnedSnapshotTime ? rangeStartTime ?? null : null,
      excludedStocks: rangeExcludedStocks,
      clear: () => onChangePinnedSnapshotTime(null),
      picker: (
        <SnapshotDatePicker
                  market={market}
                  holidayColor={resolveHeatmapColor(8, colorScale)}
                  viewedSnapshotTime={data?.snapshotTime ?? null}
                  liveSnapshotTime={liveSnapshotTime}
                  onSelectSnapshotTime={onChangePinnedSnapshotTime}
                  onSelectRange={onSelectRange}
                  rangeStartTime={rangeStartTime}
                  isPast={isPastSnapshot}
                >
                  <span className={data?.snapshotTime || rangeStartTime ? undefined : 'invisible'}>
                    {toSnapshotDateLabel(rangeStartTime ?? data?.snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}
                  </span>
                  {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && <span>~ {toSnapshotDateLabel(pinnedSnapshotTime)}</span>}
                </SnapshotDatePicker>
      ),
    },
    isMineEmpty: settingsModalProps.taxonomy === 'MINE' && rootNodes.every(node => collectItems(node).length === 0),
    mineSetupPath: SECTOR_KOREA,
    features: {
      subMarkets: [{ id: 'KOSPI', label: '코스피' }, { id: 'KOSDAQ', label: '코스닥' }],
      afterHours: true,
      timeWindowNotice: <NxtOnlyNotice active={nxtOnly && nxtOnlyWindow !== null && !isPastSnapshot && rangeStartTime === undefined} window={nxtOnlyWindow} ready={!isLoading && !isError && Boolean(data?.snapshotTime)} nodes={rootNodes} />,
      exchangeTaxonomy: true,
      intradayDelta: true,
    },
  }
}
