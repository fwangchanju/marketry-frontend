import MainAreaLoading from '@/components/MainAreaLoading'
import MobileMapHeatmapFrame from '@/components/MobileMapHeatmapFrame'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import { calculateSectorLayoutWeights, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import { collectAllItems, useFilteredHeatmap, type FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import type { HeatmapSectorNode } from '@/types/api'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { buildExcludedSectorRows } from '@/utils/overseasSectorExclusion'
import ScrollArea from '@/components/ScrollArea'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { MAP_MOBILE_CAPTURE_FRAME_HEIGHT, SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import { captureSwipeArrivalOverlay } from '@/utils/mobileSwipeArrivalOverlay'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import PhoneMapShell from '@/components/PhoneMapShell'
import { PHONE_PATH_CANVAS_ZOOM, phonePathBarLeftShift } from '@/utils/phonePathBar'
import MobileTopBar from '@/components/MobileTopBar'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import type { MobileMapMarket } from '@/components/MobileMapSheet'
import { useEffect, useMemo, useRef, useState } from 'react'
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
import Spinner, { MOBILE_LOADING_SIZE_CLASS } from '@/components/Spinner'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import Toolbar, { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'
import type { OverseasGraphSource } from '@/hooks/overseasGraphSource'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { overseasRoute } from '@/utils/markets'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector } from '@/utils/sectorAverage'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import { mapTileMethod } from '@/utils/mapStretch'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'

const SECTION_ORDER: SettingsPanelSectionId[] = ['graph', 'composition', 'colors']
const PREVIEW_FILTERS = { stockChangeFilter: 'all' as const, sectorChangeFilter: 'all' as const, sectorChangeDepth: 0, sectorUseSimpleAverage: false }
const NO_TOP_PICKS = new Set<string>()

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
  // 종목 지도로 넘어갈 때 덮개로 남길 미리보기 판.
  const mapPreviewRef = useRef<HTMLDivElement>(null)
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
  // 폰의 그룹 등락률도 국내 모바일처럼 같은 화면에서 대분류 → 중분류 → 소분류로 들어간다.
  const [mobileGraphPath, setMobileGraphPath] = useState<string[]>([])
  // 잎 업종을 누르면 국내처럼 같은 화면에서 종목 등락률 그래프로 바뀐다(해외는 종목 지도 페이지로 나가지 않는다).
  const [selectedLeaf, setSelectedLeaf] = useState<HeatmapSectorNode | null>(null)
  // 하위 진입은 국내 모바일처럼 브라우저 기록 한 칸으로 쌓는다. 뒤로가기에서 같은 화면의 이전 단계로 돌아온다.
  const graphDepth = mobileGraphPath.length + (selectedLeaf ? 1 : 0)
  const reduceToDepth = (target: number) => {
    if (target <= mobileGraphPath.length) setMobileGraphPath(previous => previous.slice(0, target))
    setSelectedLeaf(null)
  }
  const historyDepthRef = useRef(0)
  const historyConsumingRef = useRef(false)
  const historyLocationRef = useRef('')
  const historyNormalizedRef = useRef(false)
  useEffect(() => {
    // 다른 페이지에 갔다가 뒤로가기로 돌아오면 쌓인 칸만 남고 경로는 처음 상태라, 칸을 걷어 낸다.
    if (historyNormalizedRef.current) return
    historyNormalizedRef.current = true
    const stacked = window.history.state?.mobileGraphDepth
    if (typeof stacked === 'number' && stacked > 0) {
      historyConsumingRef.current = true
      window.history.go(-stacked)
    }
  }, [])
  useEffect(() => {
    if (graphDepth > historyDepthRef.current) {
      for (let k = historyDepthRef.current + 1; k <= graphDepth; k++) {
        window.history.pushState({ ...(window.history.state ?? {}), mobileGraphDepth: k }, '')
      }
      historyDepthRef.current = graphDepth
      historyLocationRef.current = window.location.pathname + window.location.search
    } else if (graphDepth < historyDepthRef.current) {
      const stale = historyDepthRef.current - graphDepth
      historyDepthRef.current = graphDepth
      if (window.location.pathname + window.location.search === historyLocationRef.current) {
        historyConsumingRef.current = true
        window.history.go(-stale)
      }
    }
  }, [graphDepth])
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        return
      }
      // 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      if (!window.location.pathname.startsWith('/graph/')) return
      const target: number = typeof event.state?.mobileGraphDepth === 'number' ? event.state.mobileGraphDepth : 0
      if (target < graphDepth) {
        // 깊이를 먼저 반영해야 경로 되돌림이 다시 history.go()를 일으키지 않는다(국내 모바일과 같다).
        historyDepthRef.current = target
        reduceToDepth(target)
      } else if (target > graphDepth) {
        // 앞으로가기로 들어갔던 단계는 복원할 수 없어, 지금 화면에 맞는 칸으로 되돌린다.
        historyConsumingRef.current = true
        window.history.go(-(target - graphDepth))
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reduceToDepth는 매 렌더 새 함수이고 graphDepth로 충분히 갱신된다
  }, [graphDepth])
  const mobileGraphNodes = useMemo(() => {
    let nodes = exclusionTree
    for (const name of mobileGraphPath) {
      const found = nodes.find(node => node.sectorName === name)
      if (!found?.children.length) break
      nodes = found.children
    }
    return nodes
  }, [exclusionTree, mobileGraphPath])
  // exclusionTree는 필터 적용 전 원본 트리라 서머리 화면이 쓰는 tree와 같고, 필터는 graph source의 공 저장값을 그대로 쓴다.
  const mobileGraphItems = useMemo<MobileGraphItem[]>(() => {
    const items: MobileGraphItem[] = []
    for (const { node, pathKey } of collectAtDepth(mobileGraphNodes, 1, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, true, '')) {
      const summary = summarizeSector(node, tierRange.excludedMarketValueTiers)
      if (!summary) continue
      items.push({
        key: pathKey,
        name: node.sectorName,
        value: summary.weightedAvg,
        onSelect: () => {
          if (node.children.length && mobileGraphPath.length < 2) { setMobileGraphPath([...mobileGraphPath, node.sectorName]); setSelectedLeaf(null) }
          else setSelectedLeaf(node)
        },
      })
    }
    // 기준 지수는 대분류에서만 보여 준다(국내의 코스피·코스닥과 같은 역할). 하위 단계에는 섹터 값만 남긴다.
    if (mobileGraphPath.length === 0) {
      for (const item of chart.rankedItems) {
        if (!item.isReference || item.hiddenCount !== undefined) continue
        items.push({ key: item.key, name: item.sectorName, value: item.value, reference: true })
      }
    }
    return items
  }, [mobileGraphNodes, mobileGraphPath, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers, chart.rankedItems])
  // 잎 업종에 들어가면 그 업종의 종목을 국내의 종목 등락률 그래프와 같은 방식으로 보여 준다.
  const leafGraphItems = useMemo<MobileGraphItem[]>(() => {
    if (!selectedLeaf) return []
    // collectAllItems는 items·children만 쓰므로 필터 타입으로 좁혀도 안전하다.
    return [...collectAllItems(selectedLeaf as FilteredHeatmapSectorNode)]
      .sort((a, b) => b.totalMarketValue - a.totalMarketValue)
      .map(stock => ({ key: stock.stockCode, name: stock.alias ?? stock.stockName, value: stock.changeRate }))
  }, [selectedLeaf])
  const shownGraphItems = selectedLeaf ? leafGraphItems : mobileGraphItems
  // 그룹 등락률에서 종목 지도로 스와이프·상단 버튼 이동할 때 따라올 미리보기. 종목 지도와 같은 트리·필터로 그린다.
  const { filteredRootNodes: mapPreviewNodes } = useFilteredHeatmap(exclusionTree, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, PREVIEW_FILTERS)
  const mapPreviewGroups = useMemo(() => mapPreviewNodes.map(toDisplayGroup), [mapPreviewNodes])
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
          <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>{sessionChip}</span>
          </>
        )}
      </div>
      {!isPhoneMapFrame && (
        <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy={sheet} /></div>
      )}
    </Toolbar>
  )
  const mapPreview = (
    <div ref={mapPreviewRef} style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <div className="flex h-full min-h-0 flex-col bg-ui-background">
        {mapPreviewGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[14px] text-ui-muted">표시할 종목이 없습니다.</div>
        ) : (
          <MobileMapHeatmapFrame
            path={[]}
            marketLabel={label}
            strongIndustryColor={strongIndustryColor}
            heatmapProps={{
              groups: mapPreviewGroups,
              selfSectorName: null,
              depth: 0,
              onSelectSector: () => {},
              onExcludeSector: () => {},
              heightClassName: 'min-h-0 flex-1',
              marketValueDepthRange: null,
              weightedAvgDepthRange: null,
              simpleAvgDepthRange: null,
              upDownCountDepthRange: null,
              boxSizeMarketCapRatio,
              tile: mapTileMethod(),
              canExclude: false,
              colorScale,
              labelMinAreaPercent: 2,
              stockLabelMode: 'both',
              stockPopupOnHover: false,
              decimalPlaces: 1,
              topPickSectorKeys: NO_TOP_PICKS,
              strongIndustryColor,
              zoomOutRequestDepth: null,
              onZoomOutComplete: () => {},
              currencyUnit,
            }}
          />
        )}
      </div>
    </div>
  )
  // 그룹 등락률에서 업종 지도 쪽(오른쪽 스와이프)으로 갈 때 왼쪽에서 따라올 미리보기. 서머리 화면의 업종 지도와 같은 박스 비율을 쓴다.
  const summaryPreviewItems = useMemo(() => {
    const source: Omit<MobileSectorMapItem, 'layoutValue'>[] = collectAtDepth(exclusionTree, 1, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, true, '')
      .map(entry => {
        const summary = summarizeSector(entry.node, tierRange.excludedMarketValueTiers)
        return summary && summary.marketValue > 0
          ? { key: entry.pathKey, name: entry.node.sectorName, marketValue: summary.marketValue, changeRate: summary.weightedAvg }
          : null
      })
      .filter((item): item is Omit<MobileSectorMapItem, 'layoutValue'> => item !== null)
    const weights = calculateSectorLayoutWeights(source, boxSizeMarketCapRatio)
    return source.map((item, index) => ({ ...item, layoutValue: weights[index] }))
  }, [exclusionTree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers, boxSizeMarketCapRatio])
  const summaryPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <div className="flex h-full min-h-0 flex-col bg-ui-background">
        <MobileSectorMap items={summaryPreviewItems} colorScale={colorScale} onSelect={() => {}} decimalPlaces={1} />
      </div>
    </div>
  )
  if (isPhoneMapFrame) {
    const marketKey: MobileMapMarket = market === 'JAPAN' ? 'japan' : 'usa'
    // 경로 줄도 그래프 글자와 같은 판 기준 값으로 그린다. 810px 판의 16px·32px가 390px 폰에서 화면 16px·32px로 보인다.
    // 셸의 스와이프 대상 밖에 두면 다음 페이지 미리보기에 이 자리가 비어 당겨지는 동안 빈 띠가 보인다.
    // 맨 앞 막대의 가로 위치를 위 툴바 첫 배지 왼쪽 끝에 맞춘다(세로는 그대로).
    const pathBarLeftShift = phonePathBarLeftShift(4)
    const pathNav = (
      <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${pathBarLeftShift}px)` }}>
        <nav aria-label="업종 이동 경로" className="flex h-[32px] items-center overflow-x-auto whitespace-nowrap text-[16px] leading-none font-bold">
          <span aria-hidden="true" className="h-4 w-[4px] shrink-0 bg-ui-white" />
          {mobileGraphPath.length === 0 && !selectedLeaf
            ? <span aria-current="location" className="shrink-0 px-2 text-ui-white">{label}</span>
            : <button type="button" onClick={() => reduceToDepth(0)} style={{ fontFamily: 'inherit', fontWeight: 'inherit' }} className="flex h-full shrink-0 items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-ui-white active:bg-ui-white/15">{label}<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></button>}
          {(selectedLeaf ? [...mobileGraphPath, selectedLeaf.sectorName] : mobileGraphPath).map((name, index, names) => index === names.length - 1
            ? <span key={name} aria-current="location" className="shrink-0 px-2 text-[var(--accent)]" style={strongIndustryColor ? { color: strongIndustryColor } : undefined}>{name}</span>
            : <button key={name} type="button" onClick={() => reduceToDepth(index + 1)} style={{ fontFamily: 'inherit', fontWeight: 'inherit' }} className="flex h-full shrink-0 items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-ui-white active:bg-ui-white/15">{name}<ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" /></button>)}
        </nav>
      </header>
    )
    return (
      <PhoneMapShell
        onSwipe={direction => navigate(direction === 'next' ? mapPath : summaryPath)}
        onBeforeSwipeNavigate={direction => { if (direction === 'next') captureSwipeArrivalOverlay(mapPreviewRef.current) }}
        toolbar={graphToolbarNode}
        topBar={<MobileTopBar title="그룹 등락률" titleTo={mapPath} titleLabel="종목 지도로 이동" />}
        frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * phoneFrameScale}
        nextPreview={mapPreview}
        previousPreview={summaryPreview}
        frame={
          <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
            <section aria-label={selectedLeaf ? '종목 등락률 그래프' : '업종 등락률 그래프'} className="flex h-full flex-col bg-ui-background p-1">
              {!isLoading && !isError && <div style={{ zoom: PHONE_PATH_CANVAS_ZOOM }}>{pathNav}</div>}
              <div className="min-h-0 flex-1">
                {isLoading ? <div className="flex h-full items-center justify-center"><Spinner showElapsed className={MOBILE_LOADING_SIZE_CLASS} /></div>
                  : isError ? <div className="flex h-full items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetchAll() }} /></div>
                    : shownGraphItems.length === 0 ? <div className="flex h-full items-center justify-center"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>
                      : <MobileGraphBars items={shownGraphItems} colorScale={colorScale} highlightColor={strongIndustryColor} />}
              </div>
            </section>
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
