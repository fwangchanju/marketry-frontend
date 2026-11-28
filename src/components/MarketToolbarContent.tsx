import type { ReactNode } from 'react'
import { PageRefreshButton } from '@/components/NavBarPageActions'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import { ClockIcon } from '@/components/icons/AppIcons'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import type { MarketScreenData } from '@/markets/marketContract'
import type { marketMenu } from '@/utils/marketMenu'
import { CHART_MARKET_OF } from '@/utils/chartRoute'

// 툴바 내용 — PC와 MOBILE, 화면과 캡처, 모든 시장이 같은 것을 쓴다. 오른쪽(분류 배지)은 있을 때만 그린다.
export default function MarketToolbarContent({ page, market, menu, right }: {
  page: 'SUMMARY' | 'GRAPH' | 'MAP'
  market: Pick<MarketScreenData, 'id' | 'label' | 'period' | 'session' | 'refresh'>
  menu: ReturnType<typeof marketMenu>
  right: ReactNode | null
}) {
  const { id, label, period, session, refresh } = market
  return (
    <>
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
        <ToolbarModeText page={page} label={label} showChevron menu={menu} />
        <ToolbarChip bare tone={period.isPast ? 'text-[var(--brand)]' : 'text-ui-white'}>{period.picker}</ToolbarChip>
        {period.isPast && (
          <ToolbarChip bare>
            <ToolbarPinButton pinned onUnpin={period.clear} />
          </ToolbarChip>
        )}
        {period.rangeStart !== null && (
          <ToolbarChip bare tone="text-ui-muted">
            <RangeExcludedStocks excludedStocks={period.excludedStocks} chartMarket={CHART_MARKET_OF[id]} />
          </ToolbarChip>
        )}
        {!period.isPast && (
          <>
            <ToolbarChip bare tone="text-ui-white">
              <PageRefreshButton onRefresh={refresh.run} isRefreshing={refresh.isRunning} helpText={refresh.help} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}>
                <AnimatedClockLabel snapshotTime={period.snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} />
              </PageRefreshButton>
            </ToolbarChip>
            <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>{session}</span>
          </>
        )}
      </div>
      {right !== null && <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>{right}</div>}
    </>
  )
}
