import { revealMobileCapture } from '@/utils/revealMobileCapture'
import { HOME_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT, screenshotElementToDataUrl } from '@/utils/screenshotToPreview'
import { useSettled } from '@/hooks/useSettled'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import client from '@/api/client'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import Heatmap from '@/components/Heatmap'
import NavBar from '@/components/NavBar'
import JapanDatePicker from '@/components/JapanDatePicker'
import JapanSessionChip from '@/components/JapanSessionChip'
import NavBarPageActions, { PageRefreshButton } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsColorSection, SettingsPanelGroup, SettingsSectorLevelSection, SettingsStockSizeSelector, SettingsStrongIndustryColorSection, SettingsTopPickSection, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import { buildFixedColorEditorProps } from '@/utils/fixedColorEditor'
import { pickTopSectorKeys } from '@/utils/topPickSectors'
import Spinner from '@/components/Spinner'
import Toolbar from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import ToolbarChip from '@/components/ToolbarChip'
import stocks from '@/data/japanStocks.json'
import { useJapanPeriodQuotes, useJapanPreviousTradingDay, useJapanQuotes, useJapanSnapshotTimes } from '@/hooks/useJapanQuotes'
import { collectSectorsAtDepth, flattenAllItems, useFilteredHeatmap, limitDepth, type FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { useJapanMapPreferences } from '@/hooks/useJapanMapPreferences'
import { useHeatmapDrilldown } from '@/hooks/useHeatmapDrilldown'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { resolveHeatmapColor, resolveLegendSwatches } from '@/utils/heatmapColorScale'
import { JAPAN_MAP_FIXED, JAPAN_REFRESH_HELP, JAPAN_SETTINGS_TAB_STORAGE, NO_TAXONOMY_CHANGE } from '@/utils/japanMapSettings'
import { buildJapanTree, excludePreviousCloseQuotes, findJapanCloseSnapshotTime, japanFilterQueryState, shouldFilterJapanQuotes, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { mapTileMethod } from '@/utils/mapStretch'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'

declare global {
  interface Window {
    marketryCaptureMap?: () => Promise<string>
  }
}

const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'
const LEVEL_LABELS = ['대분류', '중분류', '소분류']
const NO_EXCLUDED_SECTORS = new Set<number>()
const NO_EXCLUDED_TIERS = new Set<string>()
const NO_TOP_PICKS = new Set<string>()
const NO_DIRECTION_FILTERS = { stockChangeFilter: 'all', sectorChangeFilter: 'all', sectorChangeDepth: 0, sectorUseSimpleAverage: false } as const
const { colorScale } = JAPAN_MAP_FIXED
const STOCK_LABEL_MODES = ['off', 'nameOnly', 'rateOnly', 'both'] as const
const FLAT_GROUP_NAME = '__flat__'
const SECTION_ORDER: SettingsPanelSectionId[] = ['industry', 'stockDisplay', 'colors']

function toDisplayGroup(node: FilteredHeatmapSectorNode): DisplayGroup {
  return {
    sectorId: node.sectorId,
    sectorName: node.sectorName,
    totalMarketValue: node.totalMarketValue,
    weightedAvgChangeRate: node.weightedAvgChangeRate,
    simpleAvgChangeRate: node.simpleAvgChangeRate,
    items: node.items,
    children: node.children.map(toDisplayGroup),
  }
}

export default function JapanMapPage() {
  const categories = useQuery({ queryKey: ['japan', 'categories'], queryFn: async () => (await client.get<JapanCategory[]>('/japan/categories')).data })
  const classifications = useQuery({ queryKey: ['japan', 'classifications'], queryFn: async () => (await client.get<Record<string, JapanClassification>>('/japan/classifications')).data })
  const names = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data })
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const quotes = useJapanQuotes(selectedTime)
  const snapshotTimes = useJapanSnapshotTimes()
  const liveQuotes = useJapanQuotes()
  const periodQuotes = useJapanPeriodQuotes(rangeStart, selectedTime)
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const applyQuoteFilter = shouldFilterJapanQuotes(snapshotTime, new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' }), rangeStart)
  const previousTradingDay = useJapanPreviousTradingDay(snapshotTime?.slice(0, 10) ?? null, applyQuoteFilter)
  const previousTime = applyQuoteFilter && previousTradingDay.data
    ? findJapanCloseSnapshotTime(snapshotTimes.data ?? [], previousTradingDay.data)
    : null
  const previousQuotes = useJapanQuotes(previousTime, previousTime !== null)
  const mapQuotes = useMemo(() => {
    if (!applyQuoteFilter || !shownQuotes || !quotes.data || !previousQuotes.data) return shownQuotes?.quotes ?? []
    const valid = new Set(excludePreviousCloseQuotes(quotes.data.quotes, previousQuotes.data.quotes).map(quote => quote.stockCode))
    return shownQuotes.quotes.filter(quote => valid.has(quote.stockCode))
  }, [applyQuoteFilter, shownQuotes, quotes.data, previousQuotes.data])
  const tree = useMemo(() => (categories.data && classifications.data && names.data && shownQuotes && shownQuotes.snapshotTime ? buildJapanTree(stocks, categories.data, classifications.data, names.data, mapQuotes, shownQuotes.snapshotTime) : []), [categories.data, classifications.data, names.data, shownQuotes, mapQuotes])
  const { preferences, update, isLoadingDefaults } = useJapanMapPreferences()
  const { filteredRootNodes, availableMaxDepth } = useFilteredHeatmap(tree, NO_EXCLUDED_SECTORS, NO_EXCLUDED_TIERS, NO_DIRECTION_FILTERS)
  const { path, currentNode, currentSiblings, enterSector, goToDepth } = useHeatmapDrilldown(filteredRootNodes)
  // 상위 업종 강조 — 국내 지도와 같은 규칙으로 고른 단계의 업종 중 등락률이 높은 순서로 뽑는다. 필터가 적용된 전체 트리 기준이라 드릴다운해도 바뀌지 않는다.
  const topPickMaxSelectableDepth = preferences.maxDepth === null ? Math.max(3, availableMaxDepth) : preferences.maxDepth
  const topPickSectorKeys = useMemo(() => {
    if (!preferences.topPickEnabled || preferences.topPickDepth < 0 || preferences.topPickDepth >= topPickMaxSelectableDepth) return NO_TOP_PICKS
    return pickTopSectorKeys(collectSectorsAtDepth(filteredRootNodes, preferences.topPickDepth), preferences.topPickCount, preferences.activeDepthMetric)
  }, [filteredRootNodes, preferences.topPickEnabled, preferences.topPickDepth, preferences.topPickCount, preferences.activeDepthMetric, topPickMaxSelectableDepth])
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  // 일본 그래프에서 막대를 누르면 그 업종을 연 상태로 들어온다. 주소 값은 한 번만 쓰고 지운다.
  const [searchParams, setSearchParams] = useSearchParams()
  const isMobileCaptureMode = searchParams.get('capture') === 'mobile'
  const [isMobileCaptureReady, setIsMobileCaptureReady] = useState(false)
  const sectorParam = searchParams.get('sector')
  useEffect(() => {
    if (!sectorParam || filteredRootNodes.length === 0) return
    enterSector(sectorParam)
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.delete('sector'); return next }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 주소 값이 있고 트리가 준비됐을 때만 반응하면 된다(enterSector는 매 렌더 새 함수)
  }, [sectorParam, filteredRootNodes])
  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), names.refetch(), ...(previousTime ? [previousQuotes.refetch()] : []), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isMobileScreenshotSelected, setIsMobileScreenshotSelected] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  // 업종 단계를 끄면 박스를 묶지 않고 종목만 그린다. 켜면 고른 단계까지 보여 주고, 더 깊이 들어가면 최소 바로 아래 단계는 보여 준다.
  const isFullyFlattened = !preferences.sectorLevelEnabled
  const visibleDepth = preferences.maxDepth === null ? null : Math.max(1, preferences.maxDepth - path.length)
  const limit = (nodes: FilteredHeatmapSectorNode[]) => (visibleDepth === null ? nodes : limitDepth(nodes, visibleDepth))
  let groups: DisplayGroup[]
  if (isFullyFlattened) {
    const items = flattenAllItems(currentNode ? [currentNode] : currentSiblings)
    groups = [{ sectorId: -1, sectorName: FLAT_GROUP_NAME, totalMarketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0), weightedAvgChangeRate: null, simpleAvgChangeRate: null, items, children: [] }]
  } else {
    groups = currentNode ? [toDisplayGroup({ ...currentNode, children: limit(currentNode.children) })] : limit(currentSiblings).map(toDisplayGroup)
  }
  const depthRange: [number, number] | null = preferences.depthMetricEnabled ? [preferences.depthMetricMinIndex, preferences.depthMetricMaxIndex] : null
  const metricRange = (metric: typeof preferences.activeDepthMetric) => (preferences.activeDepthMetric === metric ? depthRange : null)
  const filterState = japanFilterQueryState(applyQuoteFilter, snapshotTimes.isLoading || previousTradingDay.isLoading, snapshotTimes.isError, previousTime, previousQuotes.isLoading, previousQuotes.isError)
  const isLoading = isLoadingDefaults || categories.isLoading || classifications.isLoading || names.isLoading || quotes.isLoading || periodQuotes.isLoading || filterState.isLoading
  const isError = categories.isError || classifications.isError || names.isError || quotes.isError || periodQuotes.isError || filterState.isError
  // 국내 지도처럼 데이터가 없으면 지금 시각의 세션을 보여 준다.
  const session = japanSessionAt(snapshotTime ?? new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T'))
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveQuotes.data?.snapshotTime != null && snapshotTime !== liveQuotes.data.snapshotTime)
  const shownCount = mapQuotes.length
  const canShowMobileCapture = isMobileCaptureMode && !isLoading && !isError && shownCount > 0
  const isMobileCaptureSettled = useSettled(canShowMobileCapture, snapshotTime ?? '', 1300)
  useEffect(() => {
    if (!isMobileCaptureSettled || isMobileCaptureReady) return
    let rafId = 0
    const revealWhenLaidOut = () => {
      if (!document.querySelector('[data-map-mobile-capture] [data-heatmap-layout-ready="true"]')) {
        rafId = requestAnimationFrame(revealWhenLaidOut)
        return
      }
      revealMobileCapture(document.body, true)
      setIsMobileCaptureReady(true)
    }
    rafId = requestAnimationFrame(revealWhenLaidOut)
    return () => cancelAnimationFrame(rafId)
  }, [isMobileCaptureSettled, isMobileCaptureReady])
  useEffect(() => {
    if (!isMobileCaptureMode || !isMobileCaptureReady) return
    const capture = () => {
      const root = screenshotRef.current
      if (!root) throw new Error('캡처할 지도 영역이 없습니다.')
      return screenshotElementToDataUrl(root, '[data-map-mobile-capture-frame]', 'element', revealMobileCapture)
    }
    window.marketryCaptureMap = capture
    return () => { delete window.marketryCaptureMap }
  }, [isMobileCaptureMode, isMobileCaptureReady])
  const topPickProps = {
    taxonomy: 'MARKETRY' as const,
    availableMaxDepth,
    sectorLevelEnabled: preferences.sectorLevelEnabled,
    topPickDepth: preferences.topPickDepth,
    topPickCount: preferences.topPickCount,
    topPickEnabled: preferences.topPickEnabled,
    onToggleTopPick: () => update({ topPickEnabled: !preferences.topPickEnabled }),
    topPickMaxSelectableDepth,
    onChangeTopPickDepth: (depth: number) => update({ topPickDepth: depth }),
    onChangeTopPickCount: (count: number) => update({ topPickCount: count }),
  }
  const sectorLevelProps = {
    taxonomy: 'MARKETRY' as const,
    availableMaxDepth,
    maxDepth: preferences.maxDepth,
    sectorLevelEnabled: preferences.sectorLevelEnabled,
    onToggleSectorLevel: () => update({ sectorLevelEnabled: !preferences.sectorLevelEnabled }),
    onChangeMaxDepth: (value: number) => update({ maxDepth: value }),
    activeDepthMetric: preferences.activeDepthMetric,
    onChangeActiveDepthMetric: (metric: typeof preferences.activeDepthMetric) => update({ activeDepthMetric: metric }),
    depthMetricEnabled: preferences.depthMetricEnabled,
    onToggleDepthMetric: () => update({ depthMetricEnabled: !preferences.depthMetricEnabled }),
    depthMetricMinIndex: preferences.depthMetricMinIndex,
    depthMetricMaxIndex: preferences.depthMetricMaxIndex,
    onChangeDepthMetricRange: (minIndex: number, maxIndex: number) => update({ depthMetricMinIndex: minIndex, depthMetricMaxIndex: maxIndex }),
    stockLabelModeIndex: preferences.stockLabelModeIndex,
    stockLabelEnabled: preferences.stockLabelEnabled,
    onToggleStockLabel: () => update({ stockLabelEnabled: !preferences.stockLabelEnabled }),
    onChangeStockLabelModeIndex: (index: number) => update({ stockLabelModeIndex: index }),
    decimalPlacesIndex: preferences.decimalPlaces,
    onChangeDecimalPlacesIndex: (index: number) => update({ decimalPlaces: index }),
  }
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
  const handleGoToDepth = (depth: number) => { if (depth < path.length) setZoomOutRequestDepth(depth) }
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar onReselectCurrent={() => handleGoToDepth(0)} actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="MAP" label="NIKKEI 225" />
              <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}><JapanDatePicker snapshotTime={snapshotTime} liveTime={liveQuotes.data?.snapshotTime ?? null} rangeStart={rangeStart} holidayColor={resolveHeatmapColor(8, colorScale)} onSelect={time => { setRangeStart(null); setSelectedTime(time) }} onSelectRange={(start, end) => { setRangeStart(start); setSelectedTime(end) }} /></ToolbarChip>
              {!rangeStart && (selectedTime === null || selectedTime.slice(0, 10) === liveQuotes.data?.snapshotTime?.slice(0, 10)) && (
                <>
                <ToolbarChip bare><PageRefreshButton cell onRefresh={refetchAll} isRefreshing={quotes.isFetching || categories.isFetching || classifications.isFetching || names.isFetching} helpText={JAPAN_REFRESH_HELP} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}><AnimatedClockLabel snapshotTime={snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} /></PageRefreshButton></ToolbarChip>
                <JapanSessionChip session={session} />
                </>
              )}
            </div>
            <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy="MARKETRY" /></div>
          </Toolbar>
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
            {path.length > 0 && (
              <nav aria-label="업종 이동 경로" className="flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold">
                <button type="button" data-hint="전체로 돌아가기" onClick={() => handleGoToDepth(0)} style={{ fontFamily: 'inherit' }} className={BREADCRUMB_LINK_CLASS}>JAPAN<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></button>
                {path.map((name, index) => index === path.length - 1
                  ? <span key={name} aria-current="page" className="px-2 text-[var(--accent)]">{name}</span>
                  : <button key={name} type="button" data-hint={`${LEVEL_LABELS[index]}로 돌아가기`} onClick={() => handleGoToDepth(index + 1)} style={{ fontFamily: 'inherit' }} className={BREADCRUMB_LINK_CLASS}>{name}<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></button>)}
              </nav>
            )}
            {isLoading ? (
              <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]"><Spinner showElapsed /></div>
            ) : isError ? (
              <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetchAll() }} /></div>
            ) : shownCount === 0 ? (
              <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="-top-1" /></div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <Heatmap
                  groups={groups}
                  selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)}
                  depth={path.length}
                  onSelectSector={name => { enterSector(name) }}
                  onExcludeSector={() => {}}
                  heightClassName="min-h-0 flex-1"
                  marketValueDepthRange={metricRange('marketValue')}
                  weightedAvgDepthRange={metricRange('weightedAvgChangeRate')}
                  simpleAvgDepthRange={metricRange('simpleAvgChangeRate')}
                  upDownCountDepthRange={metricRange('upDownCount')}
                  boxSizeMarketCapRatio={preferences.boxSizeMarketCapRatio}
                  tile={mapTileMethod()}
                  canExclude={false}
                  colorScale={colorScale}
                  labelMinAreaPercent={JAPAN_MAP_FIXED.boxLabelMinAreaPercent}
                  stockLabelMode={preferences.stockLabelEnabled ? STOCK_LABEL_MODES[preferences.stockLabelModeIndex] ?? 'both' : 'off'}
                  stockPopupOnHover={JAPAN_MAP_FIXED.stockPopupOnHover}
                  decimalPlaces={preferences.decimalPlaces}
                  topPickSectorKeys={topPickSectorKeys}
                  strongIndustryColor={JAPAN_MAP_FIXED.strongIndustryColor}
                  zoomOutRequestDepth={zoomOutRequestDepth}
                  onZoomOutComplete={depth => { goToDepth(depth); setZoomOutRequestDepth(null) }}
                  currencyUnit="엔"
                />
              </div>
            )}
            <DisclaimerFooter rightContent={<ChangeRateBar swatches={resolveLegendSwatches(colorScale)} />} />
          </div>
          {((isShareOpen && isMobileScreenshotSelected) || isMobileCaptureMode) && !isLoading && !isError && shownCount > 0 && (
            <div aria-hidden="true" data-map-mobile-capture-frame data-captureid={isMobileCaptureMode ? 'map-mobile-capture' : undefined} data-capture-ready={isMobileCaptureMode ? isMobileCaptureReady : undefined} style={{ opacity: 0, width: `${HOME_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box' }} className="pointer-events-none absolute z-[60] left-0 top-0 bg-ui-background">
              <div data-map-mobile-capture style={{ opacity: 0, width: '100%', height: '100%' }} className="flex flex-col bg-ui-background">
                <div data-map-mobile-toolbar-placeholder className="main-toolbar relative mt-[3px] mb-0 h-7 w-full shrink-0 bg-ui-background/70" />
                <div aria-hidden="true" className="h-2 shrink-0" />
                {path.length > 0 && <nav aria-label="업종 이동 경로" className="flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold"><span className={BREADCRUMB_LINK_CLASS}>JAPAN<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></span>{path.map((name, index) => <span key={`${name}-${index}`} className={index === path.length - 1 ? 'px-2 text-[var(--accent)]' : BREADCRUMB_LINK_CLASS}>{name}{index < path.length - 1 && <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />}</span>)}</nav>}
                <div className="flex min-h-0 flex-1 flex-col">
                  <Heatmap groups={groups} selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)} depth={path.length} onSelectSector={() => {}} onExcludeSector={() => {}} heightClassName="min-h-0 flex-1" marketValueDepthRange={metricRange('marketValue')} weightedAvgDepthRange={metricRange('weightedAvgChangeRate')} simpleAvgDepthRange={metricRange('simpleAvgChangeRate')} upDownCountDepthRange={metricRange('upDownCount')} boxSizeMarketCapRatio={preferences.boxSizeMarketCapRatio} tile={mapTileMethod()} canExclude={false} colorScale={colorScale} labelMinAreaPercent={JAPAN_MAP_FIXED.boxLabelMinAreaPercent} stockLabelMode={preferences.stockLabelEnabled ? STOCK_LABEL_MODES[preferences.stockLabelModeIndex] ?? 'both' : 'off'} stockPopupOnHover={false} decimalPlaces={preferences.decimalPlaces} topPickSectorKeys={isMobileCaptureMode ? NO_TOP_PICKS : topPickSectorKeys} strongIndustryColor={JAPAN_MAP_FIXED.strongIndustryColor} zoomOutRequestDepth={null} onZoomOutComplete={() => {}} currencyUnit="엔" captureRowMetric={preferences.activeDepthMetric === 'simpleAvgChangeRate' ? 'simpleAvgChangeRate' : 'weightedAvgChangeRate'} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Map" tabStorageName={JAPAN_SETTINGS_TAB_STORAGE.map} taxonomyAtBottom taxonomy="MARKETRY" onlyTaxonomy="MARKETRY" onSelectTaxonomy={NO_TAXONOMY_CHANGE} stockCountLabel={`${shownCount}/${stocks.length}종목`} showPreferenceActions={false} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
            <SettingsPanelGroup section="industry"><SettingsSectorLevelSection {...sectorLevelProps} showStockDisplay={false} /></SettingsPanelGroup>
            <SettingsPanelGroup section="stockDisplay">
              <SettingsStockSizeSelector marketCapRatio={preferences.boxSizeMarketCapRatio} onChangeMarketCapRatio={value => update({ boxSizeMarketCapRatio: value })} />
              <SettingsSectorLevelSection {...sectorLevelProps} showTaxonomy={false} showDecimalPlaces />
            </SettingsPanelGroup>
            <SettingsPanelGroup section="colors">
              {/* 국내 MARKETRY 모드와 같은 구성이다. 등락률 색상·강조 색상은 잠가 두고(나중에 일본에도 내 기준 모드를 만들 자리) 상위 업종 강조만 쓴다. */}
              <SettingsColorSection
                isCustom={false}
                colorScaleDraft={JAPAN_MAP_FIXED.colorScale}
                colorCustomOn
                onChangeColorCustomOn={() => {}}
                onResetColorScale={() => {}}
                isResettingColorScale={false}
                colorEditorProps={buildFixedColorEditorProps()}
                fixed
              />
              <SettingsStrongIndustryColorSection color={JAPAN_MAP_FIXED.strongIndustryColor} onChange={() => {}} fixed />
              <SettingsTopPickSection {...topPickProps} />
            </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => { setIsShareOpen(false); setIsMobileScreenshotSelected(false) }} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} captureReady={!isLoading} mobileRegionOption={{ label: '모바일', selector: '[data-map-mobile-capture-frame]', mode: 'element', onCloneNode: revealMobileCapture, monitorHorizontalPadding: 4 }} onMobileSelectionChange={setIsMobileScreenshotSelected} />}
    </div>
  )
}
