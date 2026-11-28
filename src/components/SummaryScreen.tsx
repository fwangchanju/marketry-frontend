import { useMemo, useRef, type ComponentProps } from 'react'
import { useNavigate } from 'react-router-dom'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { CustomPageBadgeLink, EmptyLogoMessage, EMPTY_DATA_MESSAGE, EMPTY_FILTER_MESSAGE, EMPTY_MINE_MESSAGE } from '@/components/EmptyMessage'
import MainAreaLoading from '@/components/MainAreaLoading'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsColorSection, SettingsExcludeSection, SettingsMarketValueSection, SettingsPanelGroup, SettingsStrongIndustryColorSection } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import { HiddenSummaryCaptureFrames, SortableSummaryScreenFrames } from '@/components/SummaryFrame'
import MarketToolbarContent from '@/components/MarketToolbarContent'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import Toolbar from '@/components/Toolbar'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useSummaryFrameOrder } from '@/hooks/useSummaryFrameOrder'
import type { MarketColors, MarketFilters, MarketScreenData } from '@/markets/marketContract'
import { frameBadgeStyle } from '@/utils/frameBadge'
import type { marketMenu } from '@/utils/marketMenu'
import { buildRankChart } from '@/utils/rankChart'
import { SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector } from '@/utils/sectorAverage'
import { GROUP_CHANGE_FRAME, MARKET_MAP_FRAME, frameCaptureOptionsFor } from '@/utils/summaryFrames'
import type { TaxonomyKey } from '@/utils/taxonomyNames'

type SettingsPanelProps = ComponentProps<typeof SettingsPanel>
// 설정창에서 시장·모드마다 다른 값. 배치와 항목은 이 화면이 정한다.
export type SummaryPanelProps = Omit<SettingsPanelProps, 'children' | 'pageLabel' | 'taxonomyAtBottom' | 'isOpen' | 'onOpenChange' | 'isOnLeft' | 'onToggleSide' | 'taxonomy'>

// 모든 시장의 PC SUMMARY. 시장 이름을 보고 갈라지지 않고 넘겨받은 값만 그린다.
export default function SummaryScreen({ market, menu, taxonomy, filters, colors, mapPath, onSelectIndex, panel }: {
  market: MarketScreenData
  menu: ReturnType<typeof marketMenu>
  taxonomy: TaxonomyKey
  filters: MarketFilters
  colors: MarketColors
  mapPath: string
  // 지수 막대를 누르면 여는 화면이 있는 시장만 준다.
  onSelectIndex: ((market: 'KOSPI' | 'KOSDAQ') => void) | null
  panel: SummaryPanelProps
}) {
  const navigate = useNavigate()
  const { tree, indexBars, state, period, isMineEmpty, features } = market
  const { colorScale, strongIndustryColor, legendSwatches } = colors
  const { valueRange, sectorExclusion } = filters
  const excludedSectorIds = sectorExclusion.excludedIds
  const excludedMarketValueTiers = valueRange.excluded
  const mainRef = useRef<HTMLDivElement>(null)
  const fixedCaptureRef = useRef<HTMLDivElement>(null)
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy, copyLabel, isCopying } = useScreenshotShare()
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const { frameSensors, safeSummaryFrameOrder, handleFrameDragEnd, orderFrames } = useSummaryFrameOrder()
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const badgeStyleProps = frameBadgeStyle(taxonomy, strongIndustryColor)
  const isExchange = features.exchangeTaxonomy && (taxonomy === 'KRX' || taxonomy === 'NXT')

  // 서머리는 업종 분류 단계를 대분류로 잠가 둔다 — 단계를 내리면 상위 업종에 직접 붙은 종목이 막대에서 빠져 종목 수·평균이 달라지기 때문이다(docs/history.md).
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, 1, excludedSectorIds as Set<number>, excludedMarketValueTiers)) {
      const summary = summarizeSector(node, excludedMarketValueTiers)
      if (!summary) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: summary.marketValue, changeRate: summary.weightedAvg, simpleAvg: summary.simpleAvg, advancers: summary.advancers, decliners: summary.decliners, unchanged: summary.unchanged })
    }
    const entries = items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false }))
    // 지수 등락률을 강조 색 참조 막대로 값 순서 자리에 끼운다.
    for (const bar of indexBars) if (bar.value !== null) entries.push({ key: bar.key, sectorName: bar.name, value: bar.value, isReference: true })
    return { items, chart: buildRankChart(entries) }
  }, [tree, excludedSectorIds, excludedMarketValueTiers, indexBars])
  const handleSelectSector = (sectorName: string) => navigate(`${mapPath}?sector=${encodeURIComponent(sectorName)}`)

  const frames = orderFrames([
    { ...MARKET_MAP_FRAME, children: <OverviewMap items={overview.items} colorScale={colorScale} onSelect={handleSelectSector} large decimalPlaces={1} /> },
    { ...GROUP_CHANGE_FRAME, children: <RankBars chart={overview.chart} highlightColor={isExchange ? 'var(--exchange-accent)' : strongIndustryColor} referenceValueColor={isExchange ? 'var(--exchange-accent)' : taxonomy === 'MINE' ? strongIndustryColor : undefined} colorScale={colorScale} onSelectSector={handleSelectSector} onSelectIndex={onSelectIndex ?? undefined} applyAxisBreak={period.rangeStart === null} decimalPlaces={1} /> },
  ])
  const mineGuide = <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}><CustomPageBadgeLink to={market.mineSetupPath} /></EmptyLogoMessage>
  const captureFrames = frames.map(frame => ({ ...frame, children: isMineEmpty ? mineGuide : frame.children }))
  const toolbar = <MarketToolbarContent page="SUMMARY" market={market} menu={menu} right={<TaxonomyBadge taxonomy={taxonomy} strongIndustryColor={strongIndustryColor} />} />

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onOpenShare={() => openScreenshot(mainRef.current)} isScreenshotOpen={isShareOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
        {/* 스크린샷 대상 — 메인 영역 전체(툴바부터 맨 아래 줄까지)다. */}
        <div ref={mainRef} data-main-area className="mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          <Toolbar>{toolbar}</Toolbar>
          {/* 로딩·오류 원은 모든 페이지 공통 자리(MainAreaLoading)에 하나만 두고 틀은 모두 감춘다. */}
          <div className="relative flex min-h-0 flex-1">
            {features.timeWindowNotice}
            {state.status === 'loading' ? (
              <MainAreaLoading><Spinner delayReveal showElapsed /></MainAreaLoading>
            ) : state.status === 'error' ? (
              <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={state.retry} /></MainAreaLoading>
            ) : isMineEmpty ? mineGuide : overview.items.length === 0 ? (
              <div className="relative flex-1"><EmptyMessage message={tree.length === 0 ? EMPTY_DATA_MESSAGE : EMPTY_FILTER_MESSAGE} topClass="top-0" /></div>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1">
                {/* 캡처 복제본에서는 가로 스크롤 래퍼가 스크롤바 자리만큼 아래·오른쪽을 잘라 내서, 캡처 중에는 스크롤을 풀어 둔다. */}
                <div className={`flex min-h-0 min-w-0 flex-1 bg-ui-background ${isShareOpen ? 'overflow-visible' : 'overflow-x-auto'}`}>
                  <SortableSummaryScreenFrames frames={frames} order={safeSummaryFrameOrder} sensors={frameSensors} onDragEnd={handleFrameDragEnd} {...badgeStyleProps} />
                </div>
              </div>
            )}
          </div>
          <DisclaimerFooter captureFullWidthAlign rightContent={<ChangeRateBar swatches={legendSwatches} />} />
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel {...panel} taxonomy={taxonomy} pageLabel="Summary" taxonomyAtBottom isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide}>
            <SettingsPanelGroup section="composition">
              <SettingsMarketValueSection isCustom={false} tiers={valueRange.tiers} tierRangeMinIndex={valueRange.minIndex} tierRangeMaxIndex={valueRange.maxIndex} onChangeTierRange={valueRange.setRange} showDivider={false} currencyUnit={market.currencyUnit} />
              <SettingsExcludeSection sectorFilterEnabled={sectorExclusion.enabled} onToggleSectorFilter={sectorExclusion.toggle} excludedSectors={sectorExclusion.rows} onRemoveExcludedSector={sectorExclusion.remove} suspendedStockCount={sectorExclusion.suspendedStockCount ?? undefined} />
            </SettingsPanelGroup>
            <SettingsPanelGroup section="colors">
              <SettingsColorSection {...colors.scaleSection} />
              <SettingsStrongIndustryColorSection {...colors.strongSection} />
            </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && (
        <HiddenSummaryCaptureFrames captureRef={fixedCaptureRef} frameCount={frames.length} frames={captureFrames} toolbar={<Toolbar className="summary-capture-toolbar">{toolbar}</Toolbar>} frameWidth={SUMMARY_CAPTURE_FRAME_WIDTH} {...badgeStyleProps} />
      )}
      {screenshotTarget && (
        <ScreenshotModal onClose={closeScreenshot} onCopy={copy} copyLabel={copyLabel} isCopying={isCopying} screenshotTarget={screenshotTarget} captureReady={state.status !== 'loading'} emptyPreview={isMineEmpty && state.status === 'ready' ? mineGuide : undefined} fixedSummaryCaptureRef={fixedCaptureRef} frameCaptureOptions={frameCaptureOptionsFor(safeSummaryFrameOrder)} />
      )}
    </div>
  )
}
