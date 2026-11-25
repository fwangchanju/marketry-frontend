import MarketDatePicker from '@/components/MarketDatePicker'
import MainAreaLoading from '@/components/MainAreaLoading'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { buildExcludedSectorRows } from '@/utils/overseasSectorExclusion'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import ScrollArea from '@/components/ScrollArea'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { marketMenu } from '@/utils/marketMenu'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import RankColumns from '@/components/RankColumns'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsColorSection, SettingsExcludeSection, SettingsMarketValueSection, SettingsPanelGroup, SettingsStrongIndustryColorSection, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import Toolbar, { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon } from '@/components/icons/AppIcons'
import type { OverseasGraphSource } from '@/hooks/overseasGraphSource'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { overseasRoute } from '@/utils/markets'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'

const SECTION_ORDER: SettingsPanelSectionId[] = ['graph', 'composition', 'colors']

export default function OverseasGraphView({ source }: { source: OverseasGraphSource }) {
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  // 시장마다 다른 부분(막대 데이터 계산·날짜 선택 칩·장 상태 칩·갱신 안내·설정창 그래프 묶음)은 source로 받고, 화면 구성은 모든 해외 시장이 같다.
  const {
    market, label, chart, titleText, titleUnit, depthNames, groupDepth, snapshotTime, liveSnapshotTime, selectedTime, rangeStart, select, selectRange,
    rangeExcludedStocks, isLoading, isError, isFetching, refetchAll, sessionChip, refreshHelp, fixed, draftKeyMap, tabStorageName,
    totalCount, shownCount, graphSettings, tierRange, currencyUnit, sectorExclusion, exclusionTree,
  } = source
  const publishedAt = useOverseasPublishedAt(market, sheet)
  // 캐시가 있어도 백그라운드 refetch 중이면 지수 값이 바뀌며 업종 줄이 밀린다. 값이 확정될 때까지 기다렸다가 막대와 함께 그린다(2026-11-22 사용자 정정).
  const isWaiting = isLoading || isFetching
  const colorSettings = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: market === 'JAPAN' ? 'japan' : 'usa' })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  const navigate = useNavigate()
  const mapPath = overseasRoute('/map', market)
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime)
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy, copyLabel, isCopying } = useScreenshotShare()
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const graphToolbarNode = (
    <Toolbar>
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
        <ToolbarModeText page="GRAPH" label={label} showChevron menu={marketMenu('/graph', market, true)} />
        <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}><MarketDatePicker market={market} snapshotTime={snapshotTime} liveTime={liveSnapshotTime} rangeStart={rangeStart} holidayColor={resolveHeatmapColor(8, colorScale)} onSelect={select} onSelectRange={selectRange} /></ToolbarChip>
        {isPastSnapshot && (
          <ToolbarChip bare>
            <ToolbarPinButton pinned={isPastSnapshot} onUnpin={() => select(null)} />
          </ToolbarChip>
        )}
        {rangeStart !== null && (
          <ToolbarChip bare tone="text-ui-muted">
            <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
          </ToolbarChip>
        )}
        {!rangeStart && (selectedTime === null || selectedTime.slice(0, 10) === liveSnapshotTime?.slice(0, 10)) && (
          <>
          <ToolbarChip bare><PageRefreshButton cell onRefresh={refetchAll} isRefreshing={isFetching} helpText={refreshHelp} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}><AnimatedClockLabel snapshotTime={snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} /></PageRefreshButton></ToolbarChip>
          <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>{sessionChip}</span>
          </>
        )}
      </div>
      <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy={sheet} /></div>
    </Toolbar>
  )
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => openScreenshot(screenshotRef.current)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          {graphToolbarNode}
          <div className="relative flex min-h-0 flex-1">
            <div className={`flex min-h-0 w-full flex-1 flex-col ${isWaiting || isError ? '' : 'pt-4 pb-[19.5px]'}`}>
              {isWaiting ? (
                <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
              ) : isError ? (
                <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetchAll() }} /></MainAreaLoading>
              ) : chart.rankedItems.length === 0 ? (
                <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>
              ) : (
                <ScrollArea overlay scrollLabel="그래프 본문" className="-mb-[19.5px] min-h-0 flex-1" contentClassName="flex min-h-full flex-col pb-[19.5px]">
                  <div className="mt-[25px] flex w-full shrink-0 items-center justify-center font-bold whitespace-nowrap" style={{ fontSize: 22, color: 'var(--ui-white)' }}>
                    <span className="inline-flex items-center leading-none font-bold">
                      <span>
                        {titleText}{' '}
                        <span className="font-light">({titleUnit})</span>
                      </span>
                      <span className="ml-2.5 rounded bg-[var(--brand-surface)] px-2 py-1 text-sm leading-none font-semibold text-ui-white">{depthNames[groupDepth - 1]}</span>
                    </span>
                  </div>
                  <p className="mt-1.5 mb-[19.5px] flex w-full shrink-0 items-center justify-center gap-1.5 text-[13px] font-medium leading-5 whitespace-nowrap text-ui-muted">
                    <span aria-hidden="true">-</span>
                    그룹에 포함된 종목이 적을수록 왜곡이 커질 수 있습니다.
                  </p>
                  <div className="flex min-h-[260px] min-w-0 w-full flex-1 pl-[1%] pr-[2%]">
                    <RankColumns chart={chart} highlightColor={strongIndustryColor} colorScale={colorScale} onSelectSector={name => navigate(`${mapPath}?sector=${encodeURIComponent(name)}`)} onSelectIndex={() => navigate(mapPath)} applyAxisBreak />
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>
          <DisclaimerFooter rightContent={<ChangeRateBar swatches={legendSwatches} />} />
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Graph" draftKeyMap={draftKeyMap} tabStorageName={tabStorageName} taxonomyAtBottom taxonomy={sheet} onlyTaxonomy="MARKETRY" snapshotTime={publishedAt} alsoTaxonomies={canUseMine ? ['MINE'] : undefined} withoutMiddle onSelectTaxonomy={next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')} showPreferenceActions={sheet === 'MINE'} stockCountLabel={formatStockCountLabel(shownCount, totalCount)} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
            <SettingsPanelGroup section="graph">
              {graphSettings}
            </SettingsPanelGroup>
            <SettingsPanelGroup section="composition">
              <SettingsMarketValueSection isCustom={false} tiers={tierRange.tiers} tierRangeMinIndex={tierRange.minIndex} tierRangeMaxIndex={tierRange.maxIndex} onChangeTierRange={tierRange.setRange} showDivider={false} currencyUnit={currencyUnit} />
              <SettingsExcludeSection sectorFilterEnabled={sectorExclusion.enabled} onToggleSectorFilter={sectorExclusion.toggle} excludedSectors={buildExcludedSectorRows(exclusionTree, sectorExclusion.ids, tierRange.excludedMarketValueTiers)} onRemoveExcludedSector={sectorExclusion.remove} />
            </SettingsPanelGroup>
            <SettingsPanelGroup section="colors">
              {/* 요약·지도 화면과 같은 구성이다. 등락률 색상·강조 색상은 내 기준 모드에서만 고칠 수 있고(한국 내 기준과 같은 값을 공유), MARKETRY 모드에서는 잠근다. */}
              <SettingsColorSection {...colorSettings.colorSectionProps} />
              <SettingsStrongIndustryColorSection {...colorSettings.strongSectionProps} />
            </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={closeScreenshot} onCopy={copy} copyLabel={copyLabel} isCopying={isCopying} screenshotTarget={screenshotTarget} />}
    </div>
  )
}
