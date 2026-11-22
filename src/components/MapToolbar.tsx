import type { ReactNode } from 'react'
import Toolbar, { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import { PageRefreshButton } from '@/components/NavBarPageActions'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { ClockIcon } from '@/components/icons/AppIcons'
import { marketMenu } from '@/utils/marketMenu'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { toSnapshotDateLabel, MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO } from '@/utils/format'
import type { MarketQuery } from '@/types/api'

// 지도 툴바 공통 부품. 종목·업종·그래프 화면이 같은 줄을 쓴다. 각 화면은 자기 데이터 값을 넘긴다.
export type MapToolbarProps = {
  market: MarketQuery
  // 시장 드롭다운이 현재 화면 경로를 유지하도록 쓴다. 종목 지도가 기본값이다.
  menuBasePath?: '/map' | '/graph' | '/summary'
  marketLabel: string
  snapshotTime: string | null
  liveSnapshotTime: string | null
  pinnedSnapshotTime: string | null | undefined
  rangeStartTime: string | null | undefined
  isPastSnapshot: boolean
  colorScale: Parameters<typeof resolveHeatmapColor>[1]
  onChangePinnedSnapshotTime: (value: string | null) => void
  onSelectRange: (start: string, end: string) => void
  rangeExcludedStocks: Parameters<typeof RangeExcludedStocks>[0]['excludedStocks']
  refetchHeatmap: () => void
  isRefetchingHeatmap: boolean
  changeRateChoice: Parameters<typeof ChangeRateModeToggle>[0]['basis']
  onChangeChangeRateMode: Parameters<typeof ChangeRateModeToggle>[0]['onChange']
  isAfterHoursControlsVisible: boolean
  isAfterHoursSelectable: boolean
  modeStatusText: ReactNode
  refreshHelpText: string
  refreshSpinMs: number
}

export default function MapToolbar({ market, menuBasePath = '/map', marketLabel, snapshotTime, liveSnapshotTime, pinnedSnapshotTime, rangeStartTime, isPastSnapshot, colorScale, onChangePinnedSnapshotTime, onSelectRange, rangeExcludedStocks, refetchHeatmap, isRefetchingHeatmap, changeRateChoice, onChangeChangeRateMode, isAfterHoursControlsVisible, isAfterHoursSelectable, modeStatusText, refreshHelpText, refreshSpinMs }: MapToolbarProps) {
  const menu = marketMenu(menuBasePath, market, true)
  return (
    <Toolbar>
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
        <ToolbarModeText page="MAP" label={marketLabel} showChevron menu={menu} />
        {/* 로딩·오류·빈 화면에서도 시계·시간대·합산/별도를 제자리에 둔다. 데이터가 없으면 시각 글자만 비어 있다. */}
        <>
          {/* 데이터가 없어도 날짜·시각 자리는 같은 폭으로 잡아 둬서 뒤의 시장 시간대 표시가 당겨지지 않게 한다. */}
          <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}>
          <SnapshotDatePicker
            market={market}
            holidayColor={resolveHeatmapColor(8, colorScale)}
            viewedSnapshotTime={snapshotTime ?? null}
            liveSnapshotTime={liveSnapshotTime}
            onSelectSnapshotTime={onChangePinnedSnapshotTime}
            onSelectRange={onSelectRange}
            rangeStartTime={rangeStartTime ?? undefined}
            isPast={isPastSnapshot}
          >
            {/* 기간을 보는 중이면 시작일은 고른 날짜로 이미 정해져 있으므로, 지도를 기다리는 동안에도 숨기지 않는다. */}
            <span className={snapshotTime || rangeStartTime ? undefined : 'invisible'}>
              {toSnapshotDateLabel((rangeStartTime ?? snapshotTime) ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}
            </span>
            {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && <span>~ {toSnapshotDateLabel(pinnedSnapshotTime)}</span>}
          </SnapshotDatePicker>
          </ToolbarChip>
          {isPastSnapshot && (
            <ToolbarChip bare>
              <ToolbarPinButton pinned={isPastSnapshot} onUnpin={() => onChangePinnedSnapshotTime(null)} />
            </ToolbarChip>
          )}
          {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && (
              <ToolbarChip bare tone="text-ui-muted">
                <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
              </ToolbarChip>
          )}
          {isPastSnapshot === false && (
            <ToolbarChip bare tone="text-ui-white">
              <PageRefreshButton
                cell
                onRefresh={refetchHeatmap}
                isRefreshing={isRefetchingHeatmap}
                helpText={refreshHelpText}
                minSpinDurationMs={refreshSpinMs}
              >
                <AnimatedClockLabel snapshotTime={snapshotTime ?? null} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} />
              </PageRefreshButton>
            </ToolbarChip>
          )}
        {/* 시장 시간대 말머리와 합산/별도 — 시간과 관련된 표시라 시계 옆에 붙인다. */}
        {isPastSnapshot === false && (
          <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>
            <ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} />
          </span>
        )}
        </>
      </div>
      {/* 맨 오른쪽 — 분류명을 설정창 업종 분류 선택 버튼 모양으로 표시하고, 좁아지면 이름을 줄인다. 로딩·오류·빈 화면에서도 제자리에 둔다. */}
      <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>{modeStatusText}</div>
    </Toolbar>

  )
}
