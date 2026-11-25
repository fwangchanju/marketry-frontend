import { useMemo, useRef, type ComponentProps } from 'react'
import { useNavigate } from 'react-router-dom'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { CustomPageBadgeLink, EmptyLogoMessage, EMPTY_DATA_MESSAGE, EMPTY_FILTER_MESSAGE, EMPTY_MINE_MESSAGE } from '@/components/EmptyMessage'
import MainAreaLoading from '@/components/MainAreaLoading'
import MarketToolbarContent from '@/components/MarketToolbarContent'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import RankColumns, { type RankColumnItem, type RankIndexMarket } from '@/components/RankColumns'
import ScreenshotModal from '@/components/ScreenshotModal'
import ScrollArea from '@/components/ScrollArea'
import SettingsPanel, { SettingsAverageModeSection, SettingsBeforeMinutesSection, SettingsColorSection, SettingsExcludeSection, SettingsGraphDepthSection, SettingsMarketValueSection, SettingsPanelGroup, SettingsStrongIndustryColorSection, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import Toolbar from '@/components/Toolbar'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import type { MarketColors, MarketFilters, MarketGraph, MarketIndexBar, MarketScreenData } from '@/markets/marketContract'
import { CAPTURE_ID } from '@/utils/captureIds'
import type { marketMenu } from '@/utils/marketMenu'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'
import type { TaxonomyKey } from '@/utils/taxonomyNames'

const DEPTH_NAMES = ['대분류', '중분류', '소분류']
const SECTION_ORDER: SettingsPanelSectionId[] = ['graph', 'composition', 'colors']
const noop = () => {}

export type GraphPanelProps = Omit<ComponentProps<typeof SettingsPanel>, 'children' | 'pageLabel' | 'taxonomyAtBottom' | 'isOpen' | 'onOpenChange' | 'isOnLeft' | 'onToggleSide' | 'taxonomy' | 'sectionOrder'>

// 모든 시장의 PC GRAPH. 시장 이름을 보고 갈라지지 않고 넘겨받은 값만 그린다.
export default function GraphScreen({ market, graph, menu, taxonomy, filters, colors, mapPath, onSelectIndex, isCaptureReady, panel }: {
  market: MarketScreenData
  graph: MarketGraph
  menu: ReturnType<typeof marketMenu>
  taxonomy: TaxonomyKey
  filters: MarketFilters
  colors: MarketColors
  mapPath: string
  onSelectIndex: (index: RankIndexMarket) => void
  // 스크린샷을 찍어도 되는지(자료가 모두 준비됐는지).
  isCaptureReady: boolean
  panel: GraphPanelProps
}) {
  const navigate = useNavigate()
  const { tree, indexBars, state, period, isMineEmpty, features } = market
  const { valueRange, sectorExclusion } = filters
  const { depth, selectableDepth, useSimpleAverage, showDelta, beforeNodes, deltaIndexBars, deltaLock, beforeMinutes, toggleDelta } = graph
  const { colorScale, strongIndustryColor, legendSwatches } = colors
  const isRange = period.rangeStart !== null
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy, copyLabel, isCopying } = useScreenshotShare()
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const excludedSectorIds = sectorExclusion.excludedIds as Set<number>
  const excludedTiers = valueRange.excluded

  const chart = useMemo(() => {
    // 가장 깊은 단계가 아니면, 하위 분류가 없는 업종도 그 자리에 남긴다.
    const keepShallower = depth < selectableDepth
    const valueOf = (node: Parameters<typeof computeSectorAverage>[0]) => {
      const average = computeSectorAverage(node, excludedTiers)
      return useSimpleAverage ? average.simpleAvg : average.weightedAvg
    }
    const beforeByPath = new Map(showDelta ? collectAtDepth(beforeNodes, depth, new Set<number>(), new Set<string>(), keepShallower).map(({ node, pathKey }) => [pathKey, node]) : [])
    const entries: RankColumnItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, depth, excludedSectorIds, excludedTiers, keepShallower)) {
      const now = valueOf(node)
      // 종목이 하나도 없는 업종은 평균이 null이라 뺀다.
      if (now === null) continue
      if (!showDelta) {
        entries.push({ key: `sector:${pathKey}`, sectorName: node.sectorName, value: now })
        continue
      }
      const beforeNode = beforeByPath.get(pathKey)
      const before = beforeNode ? valueOf(beforeNode) : null
      if (before !== null) entries.push({ key: `sector:${pathKey}`, sectorName: node.sectorName, value: now - before })
    }
    const bars: readonly MarketIndexBar[] = showDelta ? deltaIndexBars : indexBars
    for (const bar of bars) if (bar.value !== null) entries.push({ key: bar.key, sectorName: bar.name, value: bar.value, isReference: true })
    return buildRankChart(entries)
  }, [tree, beforeNodes, showDelta, depth, selectableDepth, useSimpleAverage, excludedSectorIds, excludedTiers, indexBars, deltaIndexBars])

  const mineGuide = <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}><CustomPageBadgeLink to={market.mineSetupPath} /></EmptyLogoMessage>

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={market.refresh.run} isRefreshing={market.refresh.isRunning} showRefresh={false} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} onOpenShare={() => openScreenshot(screenshotRef.current)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} />} />
      <div className="flex min-h-0 flex-1">
        {/* 스크린샷은 메인 영역만 찍어 설정창을 제외한다. */}
        <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 flex-1 overflow-hidden bg-ui-background text-ui-white">
          <div ref={screenshotRef} data-main-area data-captureid={CAPTURE_ID.SECTOR} data-capture-ready={isCaptureReady} className="mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background text-ui-white">
            <Toolbar><MarketToolbarContent page="GRAPH" market={market} menu={menu} right={<TaxonomyBadge taxonomy={taxonomy} strongIndustryColor={strongIndustryColor} />} /></Toolbar>
            <div className="relative flex min-h-0 flex-1">
              {features.timeWindowNotice}
              <div className="flex min-h-0 w-full flex-1 flex-col pt-4 pb-[19.5px]">
                {state.status === 'loading' ? (
                  <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
                ) : state.status === 'error' ? (
                  <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={state.retry} /></MainAreaLoading>
                ) : period.snapshotTime === null ? (
                  <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>
                ) : isMineEmpty ? mineGuide : chart.rankedItems.every(item => item.isReference) ? (
                  // 설정으로 업종이 전부 가려졌다 — 지수 막대만 덩그러니 남지 않게 안내 문구를 보여 준다.
                  <div className="relative flex-1"><EmptyMessage message={tree.length === 0 || (showDelta && beforeNodes.length === 0) ? EMPTY_DATA_MESSAGE : EMPTY_FILTER_MESSAGE} topClass="top-0" /></div>
                ) : (
                  <ScrollArea overlay scrollLabel="그래프 본문" className="-mb-[19.5px] min-h-0 flex-1" contentClassName="flex min-h-full flex-col pb-[19.5px]">
                    <div className="mt-[25px] flex w-full shrink-0 items-center justify-center font-bold whitespace-nowrap" style={{ fontSize: 22, color: 'var(--ui-white)' }}>
                      <span className="inline-flex items-center leading-none font-bold">
                        <span>
                          {showDelta ? `${beforeMinutes}분 전 대비` : useSimpleAverage ? '동일 가중 등락률' : '시총 가중 등락률'}{' '}
                          <span className="font-light">({showDelta ? '%p' : '%'})</span>
                        </span>
                        {/* 지금 보는 업종 분류 단계는 제목 옆 배지로 따로 보여 준다. */}
                        <span className="ml-2.5 rounded bg-[var(--brand-surface)] px-2 py-1 text-sm leading-none font-semibold text-ui-white">{DEPTH_NAMES[depth - 1]}</span>
                      </span>
                    </div>
                    <p className="mt-1.5 mb-[19.5px] flex w-full shrink-0 items-center justify-center gap-1.5 text-[13px] font-medium leading-5 whitespace-nowrap text-ui-muted">
                      <span aria-hidden="true">-</span>
                      그룹에 포함된 종목이 적을수록 왜곡이 커질 수 있습니다.
                    </p>
                    <div className="flex min-h-[260px] min-w-0 w-full flex-1 pl-[1%] pr-[2%]">
                      <RankColumns chart={chart} highlightColor={strongIndustryColor} colorScale={colorScale} onSelectSector={name => navigate(`${mapPath}?sector=${encodeURIComponent(name)}`)} onSelectIndex={onSelectIndex} applyAxisBreak={!isRange} />
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
            <DisclaimerFooter rightContent={<ChangeRateBar swatches={legendSwatches} />} />
          </div>
          <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
            <SettingsPanel {...panel} taxonomy={taxonomy} pageLabel="Graph" sectionOrder={SECTION_ORDER} taxonomyAtBottom isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide}>
              <SettingsPanelGroup section="composition">
                <SettingsMarketValueSection isCustom={false} tiers={valueRange.tiers} tierRangeMinIndex={valueRange.minIndex} tierRangeMaxIndex={valueRange.maxIndex} onChangeTierRange={valueRange.setRange} showDivider={false} currencyUnit={market.currencyUnit} />
                <SettingsExcludeSection sectorFilterEnabled={sectorExclusion.enabled} onToggleSectorFilter={sectorExclusion.toggle} excludedSectors={sectorExclusion.rows} onRemoveExcludedSector={sectorExclusion.remove} suspendedStockCount={sectorExclusion.suspendedStockCount ?? undefined} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="colors">
                <SettingsColorSection {...colors.scaleSection} />
                <SettingsStrongIndustryColorSection {...colors.strongSection} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="graph">
                <SettingsGraphDepthSection depth={graph.depth} onChange={graph.setDepth} selectableDepth={selectableDepth} />
                <SettingsAverageModeSection avgChangeRateUseSimple={useSimpleAverage} onChange={graph.setUseSimpleAverage} enabled={!showDelta} onToggle={deltaLock ? noop : toggleDelta} toggleDisabled={deltaLock !== null || isRange} toggleDisabledHint={deltaLock?.average} />
                <SettingsBeforeMinutesSection beforeMinutes={beforeMinutes} onChange={deltaLock ? noop : graph.setBeforeMinutes} enabled={showDelta} onToggle={deltaLock ? noop : toggleDelta} disabled={isRange} lockedReason={deltaLock?.before} />
              </SettingsPanelGroup>
            </SettingsPanel>
          </div>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={closeScreenshot} onCopy={copy} copyLabel={copyLabel} isCopying={isCopying} screenshotTarget={screenshotTarget} captureReady={isCaptureReady} emptyPreview={isMineEmpty && state.status === 'ready' ? mineGuide : undefined} />}
    </div>
  )
}
