import MainAreaLoading from '@/components/MainAreaLoading'
import MobileTopBar from '@/components/MobileTopBar'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import { PHONE_PATH_CANVAS_ZOOM, phonePathBarLeftShift } from '@/utils/phonePathBar'
import PhoneMapShell from '@/components/PhoneMapShell'
import type { MobileMapMarket } from '@/components/MobileMapSheet'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import { overseasRoute } from '@/utils/markets'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { buildExcludedSectorRows } from '@/utils/overseasSectorExclusion'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { revealMobileCapture } from '@/utils/revealMobileCapture'
import { marketMenu } from '@/utils/marketMenu'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { SUMMARY_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT, screenshotElementToDataUrl } from '@/utils/screenshotToPreview'
import { useSettled } from '@/hooks/useSettled'
import { useEffect, useMemo, useRef, useState } from 'react'
import { applyStockMoves, type StockMoves } from '@/utils/stockMoves'
import type { StockDrop } from '@/hooks/useStockDrag'
import type { OverseasMapSource } from '@/hooks/overseasMapSource'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import Heatmap from '@/components/Heatmap'
import MapStockChart from '@/components/MapStockChart'
import MobileMapStockChart from '@/components/MobileMapStockChart'
import { MapChangeFilterSections, MapExperimentSections } from '@/components/MapSettingsSections'
import { useMapStockChart, useStockPopupOnHover } from '@/hooks/useStockChart'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsExcludeSection, SettingsMarketValueSection, SettingsColorSection, SettingsPanelGroup, SettingsSectorLevelSection, SettingsStockSizeSelector, SettingsStrongIndustryColorSection, SettingsTopPickSection, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import { pickTopSectorKeys } from '@/utils/topPickSectors'
import Spinner from '@/components/Spinner'
import Toolbar, { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon } from '@/components/icons/AppIcons'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import ToolbarChip from '@/components/ToolbarChip'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import { collectSectorsAtDepth, flattenAllItems, useFilteredHeatmap, limitDepth, type FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { useHeatmapDrilldown } from '@/hooks/useHeatmapDrilldown'
import { useMapDrilldownHistory, useMapSectorEntry } from '@/hooks/useMapDrilldownHistory'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { mapTileMethod } from '@/utils/mapStretch'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import { calculateSectorLayoutWeights } from '@/utils/sectorLayoutWeights'
import { toDisplayGroup } from '@/utils/mobileMapHeatmap'
import PathBar, { type PathCrumb } from '@/components/PathBar'

declare global {
  interface Window {
    marketryCaptureMap?: () => Promise<string>
  }
}

const NO_TOP_PICKS = new Set<string>()
const NO_STOCK_MOVES: StockMoves = {}
const STOCK_LABEL_MODES = ['off', 'nameOnly', 'rateOnly', 'both'] as const
const FLAT_GROUP_NAME = '__flat__'
const SECTION_ORDER: SettingsPanelSectionId[] = ['stockDisplay', 'composition', 'industry', 'colors']

export default function OverseasMapView({ source }: { source: OverseasMapSource }) {
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  // 시장마다 다른 부분(데이터를 받는 방법·날짜 선택·장 상태 칩·설정 값)은 source로 받고, 화면 구성은 모든 해외 시장이 같다.
  const {
    market, label, tree, snapshotTime, liveSnapshotTime, selectedTime, rangeStart, select, selectRange, rangeExcludedStocks,
    isLoading, isError, isFetching, refetchAll, graphIndexItems, preferences, update, DatePicker, sessionChip, refreshHelp, currencyUnit, chart,
    levelLabels, defaultMaxDepth, fixed, draftKeyMap, settingPrefix, tabStorageName, totalCount, countShown,
  } = source
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const tierRange = useOverseasTierRange(settingPrefix, currencyUnit)
  const sectorExclusion = useOverseasSectorExclusion(settingPrefix)
  const colorSettings = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: market === 'JAPAN' ? 'japan' : 'usa' })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  // 공통 설정 탭의 값은 저장하지 않고 이 화면 메모리에만 둔다(한국 지도와 같다).
  // 시장(일본·미국)과 모드(MARKETRY·내 기준)마다 따로 기억한다. 한국 지도와 같은 방식이다. 종목 정보·종목 차트는 모드·시장과 상관없이 하나로 쓰고, 로그인한 사용자만 이 브라우저에 저장한다.
  const experimentKey = (name: string) => `overseas.experiment.${market}.${sheet}.${name}`
  const [stockChangeFilter, setStockChangeFilter] = useTransientSetting<'all' | 'rising' | 'falling'>(experimentKey('stockChangeFilter'), 'all')
  const [sectorChangeFilter, setSectorChangeFilter] = useTransientSetting<'all' | 'rising' | 'falling'>(experimentKey('sectorChangeFilter'), 'all')
  const [sectorChangeDepth, setSectorChangeDepth] = useTransientSetting(experimentKey('sectorChangeDepth'), 0)
  const [stockPopupOnHover, setStockPopupOnHover] = useStockPopupOnHover(fixed.stockPopupOnHover)
  // 텍스트 표시 기준은 설정창에서 바꾸지 않고 기본값으로 고정한다.
  const boxLabelMinAreaPercent = fixed.boxLabelMinAreaPercent
  const [stockMoveEnabled, setStockMoveEnabled] = useState(false)
  const [stockMoveState, setStockMoveState] = useState<{ scope: string; moves: StockMoves }>({ scope: '', moves: {} })
  const directionFilters = useMemo(() => ({ stockChangeFilter, sectorChangeFilter, sectorChangeDepth, sectorUseSimpleAverage: false }), [stockChangeFilter, sectorChangeFilter, sectorChangeDepth])
  const { filteredRootNodes, availableMaxDepth } = useFilteredHeatmap(tree, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, directionFilters)
  const { path, setPath, currentNode, currentSiblings, enterSector, goToDepth } = useHeatmapDrilldown(filteredRootNodes)
  // 상위 업종 강조 — 국내 지도와 같은 규칙으로 고른 단계의 업종 중 등락률이 높은 순서로 뽑는다. 필터가 적용된 전체 트리 기준이라 드릴다운해도 바뀌지 않는다.
  const topPickMaxSelectableDepth = preferences.maxDepth === null ? Math.max(defaultMaxDepth, availableMaxDepth) : preferences.maxDepth
  const topPickSectorKeys = useMemo(() => {
    if (!preferences.topPickEnabled || preferences.topPickDepth < 0 || preferences.topPickDepth >= topPickMaxSelectableDepth) return NO_TOP_PICKS
    return pickTopSectorKeys(collectSectorsAtDepth(filteredRootNodes, preferences.topPickDepth), preferences.topPickCount, preferences.activeDepthMetric)
  }, [filteredRootNodes, preferences.topPickEnabled, preferences.topPickDepth, preferences.topPickCount, preferences.activeDepthMetric, topPickMaxSelectableDepth])
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  // 종목 박스의 차트 아이콘·클릭·더블 클릭으로 지도 자리에 그 종목의 차트를 보여 준다(툴바·면책 줄은 그대로). 뒤로가기도 차트에서 지도로 돌아온다.
  const { chartStock, closeChart, stockChartTrigger, setStockChartTrigger, openStockChart } = useMapStockChart({ stockPopupOnHover, sectorNodes: filteredRootNodes })
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobileCaptureMode = searchParams.get('capture') === 'mobile'
  // 폰(좁은 화면)에서는 PC 화면 대신 모바일 판(캡처 모드와 같은 프레임)만 화면 폭에 맞춰 보여 준다. 위 상단 줄은 모바일 양식을 쓴다.
  const isPhoneMapFrame = useIsNarrowScreen() && !isMobileCaptureMode
  useCarriedBoxSize(value => update({ boxSizeMarketCapRatio: value }))
  const isMobileFrameVisible = isMobileCaptureMode || isPhoneMapFrame
  const phoneFrameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const [isMobileCaptureReady, setIsMobileCaptureReady] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const [isMobileScreenshotSelected, setIsMobileScreenshotSelected] = useState(false)
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy, copyLabel, isCopying } = useScreenshotShare()
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  // 업종 단계를 끄면 박스를 묶지 않고 종목만 그린다. 켜면 고른 단계까지 보여 주고, 더 깊이 들어가면 최소 바로 아래 단계는 보여 준다.
  const isFullyFlattened = !preferences.sectorLevelEnabled
  const visibleDepth = preferences.maxDepth === null ? null : Math.max(1, preferences.maxDepth - path.length)
  const limit = (nodes: FilteredHeatmapSectorNode[]) => (visibleDepth === null ? nodes : limitDepth(nodes, visibleDepth))
  let baseGroups: DisplayGroup[]
  if (isFullyFlattened) {
    const items = flattenAllItems(currentNode ? [currentNode] : currentSiblings)
    baseGroups = [{ sectorId: -1, sectorName: FLAT_GROUP_NAME, totalMarketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0), weightedAvgChangeRate: null, simpleAvgChangeRate: null, items, children: [] }]
  } else {
    baseGroups = currentNode ? [toDisplayGroup({ ...currentNode, children: limit(currentNode.children) })] : limit(currentSiblings).map(toDisplayGroup)
  }
  const stockMoves = stockMoveEnabled && stockMoveState.scope === market ? stockMoveState.moves : NO_STOCK_MOVES
  const groups = applyStockMoves(baseGroups, stockMoves)
  // 종목 지도에서 업종 지도로 스와이프·상단 버튼 이동할 때 따라올 미리보기. 업종 지도 화면과 같은 박스 비율로 그린다.
  const sectorPreviewItems = useMemo(() => {
    const source: MobileSectorMapItem[] = groups.map(group => ({
      key: String(group.sectorId),
      name: group.sectorName,
      marketValue: group.totalMarketValue,
      changeRate: group.weightedAvgChangeRate ?? group.simpleAvgChangeRate ?? 0,
    }))
    const weights = calculateSectorLayoutWeights(source, preferences.boxSizeMarketCapRatio)
    return source.map((item, index) => ({ ...item, layoutValue: weights[index] }))
  }, [groups, preferences.boxSizeMarketCapRatio])
  const handleMoveStock = (drop: StockDrop) => {
    setStockMoveState(previous => ({ scope: market, moves: { ...(previous.scope === market ? previous.moves : {}), [drop.stockCode]: drop.targetSectorId } }))
  }
  const depthRange: [number, number] | null = preferences.depthMetricEnabled ? [preferences.depthMetricMinIndex, preferences.depthMetricMaxIndex] : null
  const metricRange = (metric: typeof preferences.activeDepthMetric) => (preferences.activeDepthMetric === metric ? depthRange : null)
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime)
  const shownCount = countShown(filteredRootNodes)
  const canShowMobileCapture = isMobileFrameVisible && !isLoading && !isError && shownCount > 0
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
  const handleGoToDepth = (depth: number) => { if (depth < path.length) setZoomOutRequestDepth(depth) }
  // 분류를 한 단계씩 들어가고 나오는 것의 브라우저 기록(뒤로가기·앞으로가기)·백스페이스와, 그래프에서 업종을 눌러 온 주소(?sector=) 처리는
  // 한국 지도와 같은 부품(useMapDrilldownHistory)이 한다.
  const { markEntryFromOtherPage } = useMapDrilldownHistory({ path, setPath, zoomOutRequestDepth, handleGoToDepth, isShareOpen })
  useMapSectorEntry({ filteredRootNodes, enterSector, pathLength: path.length, markEntryFromOtherPage })
  const overseasToolbarNode = (
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="MAP" label={label} showChevron menu={marketMenu('/map', market, true)} />
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
                <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>{sessionChip}</span>
                </>
              )}
            </div>
            {!isPhoneMapFrame && (
              <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy={sheet} /></div>
            )}
          </Toolbar>
  )
  const overseasFrameNode = ((isShareOpen && isMobileScreenshotSelected) || isMobileFrameVisible) && !isLoading && !isError && shownCount > 0 && (
            <div
              aria-hidden={isPhoneMapFrame ? undefined : true}
              data-map-mobile-capture-frame
              data-captureid={isMobileCaptureMode ? 'map-mobile-capture' : undefined}
              data-capture-ready={isMobileCaptureMode ? isMobileCaptureReady : undefined}
              style={{ opacity: isPhoneMapFrame ? 1 : 0, transform: isPhoneMapFrame ? `scale(${phoneFrameScale})` : undefined, transformOrigin: 'top left', width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box' }}
              className={isPhoneMapFrame ? "relative z-[60] bg-ui-background" : "pointer-events-none absolute z-[60] left-0 top-0 bg-ui-background"}
            >
              <div
                aria-hidden="true"
                data-map-mobile-capture
                style={{ opacity: isPhoneMapFrame ? 1 : 0, width: '100%', height: '100%' }}
                className="flex flex-col bg-ui-background"
              >
                {isPhoneMapFrame ? null : <div data-map-mobile-toolbar-placeholder className="main-toolbar relative mt-[3px] mb-0 h-7 w-full shrink-0 bg-ui-background/70" />}
                <div aria-hidden="true" className="h-2 shrink-0" />
                {path.length > 0 && <PathBar
                  accentColor={strongIndustryColor}
                  crumbs={[
                    { key: 'market', label },
                    ...path.map((name, index): PathCrumb => ({ key: `${name}-${index}`, label: name, current: index === path.length - 1 })),
                  ]}
                />}
                <div className="flex min-h-0 flex-1 flex-col">
                  <Heatmap groups={groups} selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)} depth={path.length} onSelectSector={() => {}} onExcludeSector={() => {}} heightClassName="min-h-0 flex-1" marketValueDepthRange={metricRange('marketValue')} weightedAvgDepthRange={metricRange('weightedAvgChangeRate')} simpleAvgDepthRange={metricRange('simpleAvgChangeRate')} upDownCountDepthRange={metricRange('upDownCount')} boxSizeMarketCapRatio={preferences.boxSizeMarketCapRatio} tile={mapTileMethod()} canExclude={false} colorScale={colorScale} labelMinAreaPercent={boxLabelMinAreaPercent} stockLabelMode={preferences.stockLabelEnabled ? STOCK_LABEL_MODES[preferences.stockLabelModeIndex] ?? 'both' : 'off'} stockPopupOnHover={false} stockChartTrigger="rightClick" onOpenStockChart={isPhoneMapFrame && chart ? openStockChart : undefined} phonePopupEnlarged={isPhoneMapFrame} decimalPlaces={preferences.decimalPlaces} topPickSectorKeys={topPickSectorKeys} strongIndustryColor={strongIndustryColor} zoomOutRequestDepth={null} onZoomOutComplete={() => {}} currencyUnit={currencyUnit} captureRowMetric={preferences.activeDepthMetric === 'simpleAvgChangeRate' ? 'simpleAvgChangeRate' : 'weightedAvgChangeRate'} />
                </div>
              </div>
            </div>
          );
  const phoneEmptyFrame = (
    <div className="flex h-full items-center justify-center text-[14px] text-ui-muted">{isLoading ? '불러오는 중입니다.' : isError ? '데이터를 불러오지 못했습니다.' : '이 날짜에는 표시할 데이터가 없습니다.'}</div>
  )
  const sectorPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <div className="flex h-full min-h-0 flex-col bg-ui-background">
        <MobileSectorMap items={sectorPreviewItems} colorScale={colorScale} onSelect={() => {}} decimalPlaces={preferences.decimalPlaces} />
      </div>
    </div>
  )
  // 종목 지도에서 그룹 등락률 쪽(오른쪽 스와이프)으로 갈 때 왼쪽에서 따라올 미리보기. 한국 종목 지도와 같은 판·경로 줄을 쓴다.
  const graphPreviewItems: MobileGraphItem[] = sectorPreviewItems.map(item => ({ key: item.key, name: item.name, value: item.changeRate }))
  for (const index of graphIndexItems) graphPreviewItems.push({ ...index, reference: true })
  const graphPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <section aria-label="업종 등락률 그래프" className="flex h-full flex-col bg-ui-background p-1">
        <div style={{ zoom: PHONE_PATH_CANVAS_ZOOM }}>
          <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${phonePathBarLeftShift(8)}px)` }}>
            <PathBar variant="phone" currentAria="location" crumbs={[{ key: 'market', label, current: true }]} />
          </header>
        </div>
        {isLoading || isFetching ? <div className="flex h-full items-center justify-center"><Spinner /></div>
          : <MobileGraphBars items={graphPreviewItems} colorScale={colorScale} highlightColor={strongIndustryColor} />}
      </section>
    </div>
  )

  if (isPhoneMapFrame) {
    const marketKey: MobileMapMarket = market === 'JAPAN' ? 'japan' : 'usa'
    const summaryPath = overseasRoute('/summary', market)
    const graphPath = overseasRoute('/graph', market)
    return (
      <>
        <PhoneMapShell
          zoomMode="pinch"
          onSwipe={direction => navigate(direction === 'next' ? summaryPath : graphPath)}
          toolbar={overseasToolbarNode}
          topBar={<MobileTopBar title="종목 지도" titleTo={summaryPath} titleLabel="업종 지도로 이동" />}
          frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * phoneFrameScale}
          frame={overseasFrameNode || phoneEmptyFrame}
          nextPreview={sectorPreview}
          previousPreview={graphPreview}
          current={marketKey}
          boxSize={preferences.boxSizeMarketCapRatio}
          onChangeBoxSize={value => update({ boxSizeMarketCapRatio: value })}
        />
        {chartStock !== null && chart && (
          <MobileMapStockChart
            chartStock={chartStock}
            marketLabel={label}
            levelLabels={levelLabels}
            market={chart.market}
            closeChart={closeChart}
            onGoToRoot={() => goToDepth(0)}
            onEnterSector={enterSector}
          />
        )}
      </>
    )
  }

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar onReselectCurrent={() => handleGoToDepth(0)} actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => openScreenshot(screenshotRef.current)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          {overseasToolbarNode}
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
            {chartStock !== null && chart ? (
              <MapStockChart chartStock={chartStock} marketLabel={label} levelLabels={levelLabels} market={chart.market} closeChart={closeChart} onGoToRoot={() => handleGoToDepth(0)} onEnterSector={enterSector} />
            ) : (
            <>
            {path.length > 0 && <PathBar
              currentAria="page"
              accentColor={strongIndustryColor}
              crumbs={[
                { key: 'market', label, onClick: () => handleGoToDepth(0), hint: '전체로 돌아가기' },
                ...path.map((name, index): PathCrumb => index === path.length - 1
                  ? { key: `path-${index}`, label: name, current: true }
                  : { key: `path-${index}`, label: name, onClick: () => handleGoToDepth(index + 1), hint: `${levelLabels[index]}로 돌아가기` }),
              ]}
            />}
            {isLoading ? (
              <MainAreaLoading><Spinner showElapsed /></MainAreaLoading>
            ) : isError ? (
              <MainAreaLoading><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetchAll() }} /></MainAreaLoading>
            ) : shownCount === 0 ? (
              <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="-top-1" /></div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <Heatmap
                  groups={groups}
                  stockMoveEnabled={stockMoveEnabled}
                  onMoveStock={handleMoveStock}
                  selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)}
                  depth={path.length}
                  onSelectSector={name => { enterSector(name) }}
                  onExcludeSector={sectorId => sectorExclusion.exclude(sectorId)}
                  heightClassName="min-h-0 flex-1"
                  marketValueDepthRange={metricRange('marketValue')}
                  weightedAvgDepthRange={metricRange('weightedAvgChangeRate')}
                  simpleAvgDepthRange={metricRange('simpleAvgChangeRate')}
                  upDownCountDepthRange={metricRange('upDownCount')}
                  boxSizeMarketCapRatio={preferences.boxSizeMarketCapRatio}
                  tile={mapTileMethod()}
                  canExclude
                  colorScale={colorScale}
                  labelMinAreaPercent={boxLabelMinAreaPercent}
                  stockLabelMode={preferences.stockLabelEnabled ? STOCK_LABEL_MODES[preferences.stockLabelModeIndex] ?? 'both' : 'off'}
                  stockPopupOnHover={stockPopupOnHover}
                  decimalPlaces={preferences.decimalPlaces}
                  topPickSectorKeys={topPickSectorKeys}
                  strongIndustryColor={strongIndustryColor}
                  zoomOutRequestDepth={zoomOutRequestDepth}
                  onZoomOutComplete={depth => { goToDepth(depth); setZoomOutRequestDepth(null) }}
                  currencyUnit={currencyUnit}
                  stockChartTrigger={stockChartTrigger}
                  onOpenStockChart={chart ? openStockChart : undefined}
                />
              </div>
            )}
            </>
            )}
            <DisclaimerFooter rightContent={<ChangeRateBar swatches={legendSwatches} />} />
          </div>
          {overseasFrameNode}
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel sectionOrder={[...SECTION_ORDER, 'special']} pageLabel="Map" draftKeyMap={draftKeyMap} tabStorageName={tabStorageName} taxonomyAtBottom taxonomy={sheet} onlyTaxonomy="MARKETRY" snapshotTime={publishedAt} alsoTaxonomies={canUseMine ? ['MINE'] : undefined} withoutMiddle onSelectTaxonomy={next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')} showPreferenceActions={sheet === 'MINE'} stockCountLabel={formatStockCountLabel(shownCount, totalCount)} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide}>
            <SettingsPanelGroup section="composition">
              {/* 한국 지도의 종목 구성 탭과 같은 자리. 일본·미국은 구간 이름 없이 금액 눈금만 쓴다. */}
              <SettingsMarketValueSection
                isCustom={false}
                tiers={tierRange.tiers}
                tierRangeMinIndex={tierRange.minIndex}
                tierRangeMaxIndex={tierRange.maxIndex}
                onChangeTierRange={tierRange.setRange}
                showDivider={false}
                currencyUnit={currencyUnit}
              />
              <SettingsExcludeSection
                sectorFilterEnabled={sectorExclusion.enabled}
                onToggleSectorFilter={sectorExclusion.toggle}
                excludedSectors={buildExcludedSectorRows(tree, sectorExclusion.ids, tierRange.excludedMarketValueTiers)}
                onRemoveExcludedSector={sectorExclusion.remove}
              />
              <MapChangeFilterSections stockChangeFilter={stockChangeFilter} onChangeStockChangeFilter={setStockChangeFilter} sectorChangeFilter={sectorChangeFilter} onChangeSectorChangeFilter={setSectorChangeFilter} sectorChangeDepth={sectorChangeDepth} onChangeSectorChangeDepth={setSectorChangeDepth} maxSelectableDepth={availableMaxDepth} noDataLimited={false} />
            </SettingsPanelGroup>
            <SettingsPanelGroup section="industry"><SettingsSectorLevelSection {...sectorLevelProps} showStockDisplay={false} /></SettingsPanelGroup>
            <SettingsPanelGroup section="stockDisplay">
              <SettingsStockSizeSelector marketCapRatio={preferences.boxSizeMarketCapRatio} onChangeMarketCapRatio={value => update({ boxSizeMarketCapRatio: value })} />
              <SettingsSectorLevelSection {...sectorLevelProps} showTaxonomy={false} showDecimalPlaces />
            </SettingsPanelGroup>
            <SettingsPanelGroup section="colors">
              {/* 한국과 같은 구성이다. 등락률 색상·강조 색상은 내 기준 모드에서만 고칠 수 있고(한국 내 기준과 같은 값을 공유), MARKETRY 모드에서는 잠근다. */}
              <SettingsColorSection {...colorSettings.colorSectionProps} />
              <SettingsStrongIndustryColorSection {...colorSettings.strongSectionProps} />
              <SettingsTopPickSection {...topPickProps} />
            </SettingsPanelGroup>
            <SettingsPanelGroup section="special">
              <MapExperimentSections stockPopupOnHover={stockPopupOnHover} onChangeStockPopupOnHover={setStockPopupOnHover} stockChartTrigger={stockChartTrigger} onChangeStockChartTrigger={setStockChartTrigger} stockMoveEnabled={stockMoveEnabled} onChangeStockMoveEnabled={setStockMoveEnabled} />
            </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => { closeScreenshot(); setIsMobileScreenshotSelected(false) }} onCopy={copy} copyLabel={copyLabel} isCopying={isCopying} screenshotTarget={screenshotTarget} captureReady={!isLoading} mobileRegionOption={{ label: '모바일', selector: '[data-map-mobile-capture-frame]', mode: 'element', onCloneNode: revealMobileCapture, monitorHorizontalPadding: 4 }} onMobileSelectionChange={setIsMobileScreenshotSelected} />}
    </div>
  )
}
