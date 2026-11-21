import MainAreaLoading from '@/components/MainAreaLoading'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { buildExcludedSectorRows } from '@/utils/overseasSectorExclusion'
import ScrollArea from '@/components/ScrollArea'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { MAP_MOBILE_CAPTURE_FRAME_HEIGHT, SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import { normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import PhoneMapShell from '@/components/PhoneMapShell'
import MobileTopBar from '@/components/MobileTopBar'
import type { MobileMapMarket } from '@/components/MobileMapSheet'
import { useRef, useState } from 'react'
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
import Toolbar from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon } from '@/components/icons/AppIcons'
import type { OverseasGraphSource } from '@/hooks/overseasGraphSource'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { overseasRoute } from '@/utils/markets'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'

const SECTION_ORDER: SettingsPanelSectionId[] = ['graph', 'composition', 'colors']

export default function OverseasGraphView({ source }: { source: OverseasGraphSource }) {
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  // 시장마다 다른 부분(막대 데이터 계산·날짜 선택 칩·장 상태 칩·갱신 안내·설정창 그래프 묶음)은 source로 받고, 화면 구성은 모든 해외 시장이 같다.
  const {
    market, label, chart, titleText, titleUnit, depthNames, groupDepth, snapshotTime, liveSnapshotTime, selectedTime, rangeStart, select, selectRange,
    rangeExcludedStocks, isLoading, isError, isFetching, refetchAll, DatePicker, sessionChip, refreshHelp, fixed, draftKeyMap, tabStorageName,
    totalCount, shownCount, graphSettings, tierRange, currencyUnit, sectorExclusion, exclusionTree,
  } = source
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const colorSettings = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: market === 'JAPAN' ? 'japan' : 'usa' })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  const navigate = useNavigate()
  const mapPath = overseasRoute('/map', market)
  const summaryPath = `${overseasRoute('/summary', market)}?map`
  // 폰에서는 그래프 한 장을 5:8 판에 맞춰 보여 준다. 상단 줄·툴바 줄·하단 설정 줄은 세 시장이 같은 틀을 쓴다.
  const isPhoneMapFrame = useIsNarrowScreen()
  const phoneFrameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const [storedMobileBoxSizeRatio, onChangeMobileBoxSizeRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  const boxSizeMarketCapRatio = normalizeMobileBoxSizeRatio(storedMobileBoxSizeRatio)
  useCarriedBoxSize(onChangeMobileBoxSizeRatio)
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime)
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const copy = async (previewSrc?: string | null) => {
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }
  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  // PC 화면과 폰 화면이 같은 툴바 원본을 쓴다(폰에서는 툴바 줄을 판 밖에 둔다).
  const graphToolbarNode = (
    <Toolbar>
      <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
        <ToolbarModeText page="GRAPH" label={label} showChevron menu={marketMenu('/graph', market, true)} />
        <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}><DatePicker snapshotTime={snapshotTime} liveTime={liveSnapshotTime} rangeStart={rangeStart} holidayColor={resolveHeatmapColor(8, colorScale)} onSelect={select} onSelectRange={selectRange} /></ToolbarChip>
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
          {sessionChip}
          </>
        )}
      </div>
      <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy={sheet} /></div>
    </Toolbar>
  )
  if (isPhoneMapFrame) {
    const marketKey: MobileMapMarket = market === 'JAPAN' ? 'japan' : 'usa'
    return (
      <PhoneMapShell
        onSwipe={direction => navigate(direction === 'next' ? mapPath : summaryPath)}
        toolbar={graphToolbarNode}
        topBar={<MobileTopBar title="그룹 등락률" titleTo={mapPath} titleLabel="종목 지도로 이동" />}
        frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * phoneFrameScale}
        frame={
          <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
            <div className="flex h-full flex-col bg-ui-background">
              {isLoading ? <div className="flex flex-1 items-center justify-center"><Spinner showElapsed /></div> : isError ? <div className="flex flex-1 items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetchAll() }} /></div> : chart.rankedItems.length === 0 ? (
                <div className="flex flex-1 items-center justify-center"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>
              ) : (
                <>
                  <div className="mt-[25px] flex w-full shrink-0 items-center justify-center font-bold whitespace-nowrap" style={{ fontSize: 22, color: 'var(--ui-white)' }}>
                    <span className="inline-flex items-center leading-none font-bold">
                      <span>{titleText} <span className="font-light">({titleUnit})</span></span>
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
                </>
              )}
            </div>
          </div>
        }
        current={marketKey}
        boxSize={boxSizeMarketCapRatio}
        onChangeBoxSize={onChangeMobileBoxSizeRatio}
      />
    )
  }
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          {graphToolbarNode}
          <div className="relative flex min-h-0 flex-1">
            <div className={`flex min-h-0 w-full flex-1 flex-col ${isLoading || isError ? '' : 'pt-4 pb-[19.5px]'}`}>
              {isLoading ? (
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
          <SettingsPanel pageLabel="Graph" draftKeyMap={draftKeyMap} tabStorageName={tabStorageName} taxonomyAtBottom taxonomy={sheet} onlyTaxonomy="MARKETRY" snapshotTime={publishedAt} alsoTaxonomies={canUseMine ? ['MINE'] : undefined} withoutMiddle onSelectTaxonomy={next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')} showPreferenceActions={sheet === 'MINE'} stockCountLabel={`${shownCount}/${totalCount}종목`} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
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
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
    </div>
  )
}
