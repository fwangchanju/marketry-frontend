import { useMemo, useRef, useState } from 'react'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { buildExcludedSectorRows, countVisibleItems } from '@/utils/overseasSectorExclusion'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import { marketMenu } from '@/utils/marketMenu'
import { useLocation, useNavigate } from 'react-router-dom'

import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { frameBadgeStyle } from '@/utils/frameBadge'
import { HiddenSummaryCaptureFrames, SortableSummaryScreenFrames } from '@/components/SummaryFrame'
import { useSummaryFrameOrder } from '@/hooks/useSummaryFrameOrder'
import { useScreenshotShare } from '@/hooks/useScreenshotShare'
import { GROUP_CHANGE_FRAME, MARKET_MAP_FRAME, frameCaptureOptionsFor } from '@/utils/summaryFrames'
import { SUMMARY_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT } from '@/utils/screenshotToPreview'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsColorSection, SettingsExcludeSection, SettingsMarketValueSection, SettingsPanelGroup, SettingsStrongIndustryColorSection, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import ScreenshotModal from '@/components/ScreenshotModal'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import RankBars from '@/components/RankBars'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon } from '@/components/icons/AppIcons'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import Toolbar, { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import ChangeRateBar from '@/components/ChangeRateBar'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { PageRefreshButton } from '@/components/NavBarPageActions'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import { buildRankChart } from '@/utils/rankChart'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector } from '@/utils/sectorAverage'
import { overseasRoute } from '@/utils/markets'
import type { OverseasSummarySource } from '@/hooks/overseasSummarySource'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { usePhoneMapInfoPopup } from '@/hooks/usePhoneMapInfoPopup'
import PhoneMapShell from '@/components/PhoneMapShell'
import { PHONE_PATH_CANVAS_ZOOM, phonePathBarLeftShift } from '@/utils/phonePathBar'
import PathBar from '@/components/PathBar'
import MobileTopBar from '@/components/MobileTopBar'
import type { MobileMapMarket } from '@/components/MobileMapSheet'
import Spinner, { MOBILE_LOADING_SIZE_CLASS } from '@/components/Spinner'
import { calculateSectorLayoutWeights, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'
import { useCarriedBoxSize } from '@/hooks/useCarriedBoxSize'
import { captureSwipeArrivalOverlay } from '@/utils/mobileSwipeArrivalOverlay'
import MobileSectorMap, { type MobileSectorMapItem } from '@/components/MobileSectorMap'
import MobileMapHeatmapFrame from '@/components/MobileMapHeatmapFrame'
import { useFilteredHeatmap } from '@/hooks/useFilteredHeatmap'
import { toDisplayGroup } from '@/utils/mobileMapHeatmap'
import { mapTileMethod } from '@/utils/mapStretch'
import { isMarketValueExcluded } from '@/utils/marketValueTier'

// 종목 지도로 스와이프할 때 따라올 미리보기도 그래프 화면의 종목 지도 미리보기와 같은 필터·강조 목록을 쓴다.
const PHONE_MAP_PREVIEW_FILTERS = { stockChangeFilter: 'all' as const, sectorChangeFilter: 'all' as const, sectorChangeDepth: 0, sectorUseSimpleAverage: false }
const PHONE_MAP_PREVIEW_NO_TOP_PICKS = new Set<string>()

// 폰 업종 지도 칸 — 한국과 같은 PC용 팝업에 넣을 집계값과 종목 가격을 함께 든다.
type PhoneDrillItem = MobileSectorMapItem & {
  isStock?: boolean
  currentPrice?: number
  simpleAvg?: number | null
  advancers?: number
  decliners?: number
  unchanged?: number
}

const SECTION_ORDER: SettingsPanelSectionId[] = ['composition', 'colors']

// 서머리의 일본·미국 구성. 업종 지도와 그룹 등락률을 지도 화면과 같은 트리·계산으로 만든다(최신 시세 기준).
// 날짜 달력·시계 새로고침·설정 패널은 지도 화면과 같은 부품을 쓴다. 설정 패널은 색상 탭만 있다(편집할 설정이 없고 지도 화면과 같은 고정값을 보여 준다).
export default function OverseasSummaryView({ source }: { source: OverseasSummarySource }) {
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  // 시장마다 다른 부분(데이터 받기·날짜 선택 칩·장 상태 칩·갱신 안내·고정 색상·종목 수)은 source로 받고, 화면 구성은 모든 해외 시장이 같다.
  const {
    market, label, tree, snapshotTime, liveSnapshotTime, selectedTime, rangeStart, select, selectRange, rangeExcludedStocks,
    isLoading, isFetching, refetchAll, graphIndexItems, DatePicker, sessionChip, refreshHelp, fixed, tabStorageName, settingPrefix, currencyUnit, totalCount,
  } = source
  const publishedAt = useOverseasPublishedAt(market, sheet)
  // 시가총액 범위 — 지도·그래프와 같은 저장 값. 업종 요약과 막대, 설정창의 종목 수에 함께 반영한다.
  const tierRange = useOverseasTierRange(settingPrefix, currencyUnit)
  const sectorExclusion = useOverseasSectorExclusion(settingPrefix)
  const colorSettings = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: 'mine' })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  const badgeStyleProps = frameBadgeStyle(sheet, strongIndustryColor)
  const navigate = useNavigate()
  // 폰에서는 업종 지도 한 장을 5:8 판에 맞춰 보여 준다. 상단 줄·툴바 줄·하단 설정 줄은 세 시장이 같은 틀을 쓴다.
  const isPhoneMapFrame = useIsNarrowScreen()
  // 화면 확대 차단은 공통 셸(PhoneMapShell)이 zoomMode로 관리한다.
  const phoneFrameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const [storedMobileBoxSizeRatio, onChangeMobileBoxSizeRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  const boxSizeMarketCapRatio = normalizeMobileBoxSizeRatio(storedMobileBoxSizeRatio)
  useCarriedBoxSize(onChangeMobileBoxSizeRatio)
  // 업종을 누르면 같은 시장의 지도 화면에서 그 업종을 연다(PC 서머리의 기존 동작).
  const handleSelectSector = (sectorName: string) => navigate(`${overseasRoute('/map', market)}?sector=${encodeURIComponent(sectorName)}`)

  // 폰에서는 한국처럼 주소를 그대로 두고 업종을 한 단계씩 연다. 단계는 기록에만 남겨 뒤로가기가 된다.
  const location = useLocation()
  const readPhoneSectorPath = (state: unknown): string[] => {
    const value = state && typeof state === 'object' ? (state as { phoneSectorPath?: unknown }).phoneSectorPath : null
    return Array.isArray(value) && value.every(name => typeof name === 'string') ? value as string[] : []
  }
  const [phoneSectorPath, setPhoneSectorPath] = useState<string[]>(() => readPhoneSectorPath(location.state))
  const [phoneSectorKey, setPhoneSectorKey] = useState(location.key)
  if (phoneSectorKey !== location.key) {
    setPhoneSectorKey(location.key)
    setPhoneSectorPath(readPhoneSectorPath(location.state))
  }
  const phoneSectorNode = useMemo(() => {
    let node: (typeof tree)[number] | null = null
    let siblings = tree
    for (const name of phoneSectorPath) {
      const found = siblings.find(item => item.sectorName === name)
      if (!found) break
      node = found
      siblings = found.children
    }
    return node
  }, [tree, phoneSectorPath])
  const phoneShowingStocks = phoneSectorNode !== null && phoneSectorNode.children.length === 0
  const phoneDrillItems = useMemo<PhoneDrillItem[]>(() => {
    const excludedTiers = tierRange.excludedMarketValueTiers
    if (phoneShowingStocks && phoneSectorNode) {
      return phoneSectorNode.items
        .filter(stock => !isMarketValueExcluded(stock, excludedTiers))
        .map(stock => ({ key: stock.stockCode, name: stock.stockName, marketValue: stock.totalMarketValue, changeRate: stock.changeRate, isStock: true, currentPrice: stock.currentPrice }))
        .filter(item => item.marketValue > 0)
    }
    const prefix = phoneSectorPath.length ? `${phoneSectorPath.join('>')}>` : ''
    return collectAtDepth(tree, phoneSectorPath.length + 1, sectorExclusion.excludedSectorIds as Set<number>, excludedTiers, true)
      .filter(entry => !prefix || entry.pathKey.startsWith(prefix))
      .flatMap(entry => {
        const summary = summarizeSector(entry.node, excludedTiers)
        if (!summary || summary.marketValue <= 0) return []
        return [{
          key: entry.pathKey,
          name: entry.node.sectorName,
          marketValue: summary.marketValue,
          changeRate: summary.weightedAvg,
          isStock: false,
          simpleAvg: summary.simpleAvg,
          advancers: summary.advancers,
          decliners: summary.decliners,
          unchanged: summary.unchanged,
        }]
      })
  }, [tree, phoneSectorPath, phoneShowingStocks, phoneSectorNode, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers])
  const phoneDrillMapItems = useMemo(() => {
    const weights = calculateSectorLayoutWeights(phoneDrillItems, boxSizeMarketCapRatio)
    return phoneDrillItems.map((item, index) => ({ ...item, layoutValue: weights[index] }))
  }, [phoneDrillItems, boxSizeMarketCapRatio])
  // 업종·종목 칸 팝업도 한국과 같은 공통 훅을 쓴다. 화면 이동으로 닫기는 공통 셸이 navigationKey로 맡는다.
  const { popup: infoPopup, close: closeInfoPopup, openStockPopup, openSectorPopup } = usePhoneMapInfoPopup({ currencyUnit })
  const openPhoneDrillPopup = (item: PhoneDrillItem, target: HTMLElement) => item.isStock
    ? openStockPopup({ key: item.key, name: item.name, changeRate: item.changeRate, currentPrice: item.currentPrice ?? 0, marketValue: item.marketValue }, target)
    : openSectorPopup(item, target)
  const handlePhoneSectorSelect = (name: string) => {
    closeInfoPopup()
    if (phoneShowingStocks) return
    const next = [...phoneSectorPath, name]
    setPhoneSectorPath(next)
    navigate(location.pathname + location.search, { state: { phoneSectorPath: next } })
  }

  // 업종 지도 항목과 그룹 등락률 막대 — 지도 화면과 같이 한 단계(대분류)만 쓴다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, 1, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, true, '')) {
      const summary = summarizeSector(node, tierRange.excludedMarketValueTiers)
      if (!summary) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: summary.marketValue, changeRate: summary.weightedAvg, simpleAvg: summary.simpleAvg, advancers: summary.advancers, decliners: summary.decliners, unchanged: summary.unchanged })
    }
    const chart = buildRankChart(items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false })))
    return { items, chart }
  }, [tree, tierRange.excludedMarketValueTiers, sectorExclusion.excludedSectorIds])
  // 업종 지도에서 그룹 등락률로 스와이프·상단 버튼 이동할 때 따라올 미리보기.
  const graphPreviewItems: MobileGraphItem[] = overview.items.map(item => ({ key: item.key, name: item.name, value: item.changeRate }))
  for (const index of graphIndexItems) graphPreviewItems.push({ ...index, reference: true })
  const shownCount = useMemo(() => countVisibleItems(tree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers), [tree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers])
  // 지도·그래프와 같은 목록(KOREA 아래 KOSPI·KOSDAQ, JAPAN, USA) — 일본·미국 서머리는 특별 회원·관리자만 열 수 있다.
  const menu = marketMenu('/summary', market, true)
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime)
  const holidayColor = resolveHeatmapColor(8, colorScale)

  // 화면 캡처·전체화면 — 지도 화면과 같은 방식이다.
  const screenshotRef = useRef<HTMLDivElement>(null)
  // 종목 지도로 넘어갈 때 덮개로 남길 미리보기 판.
  const mapPreviewRef = useRef<HTMLDivElement>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { target: screenshotTarget, isOpen: isShareOpen, open: openScreenshot, close: closeScreenshot, copy, copyLabel, isCopying } = useScreenshotShare()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const hasData = tree.length > 0

  const toolbarContent = (
    <>
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      <ToolbarModeText page="SUMMARY" label={label} showChevron menu={menu} />
      <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}>
        <DatePicker snapshotTime={snapshotTime} liveTime={liveSnapshotTime} rangeStart={rangeStart} holidayColor={holidayColor} onSelect={select} onSelectRange={selectRange} />
      </ToolbarChip>
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
          <ToolbarChip bare>
            <PageRefreshButton cell onRefresh={refetchAll} isRefreshing={isFetching} helpText={refreshHelp} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}>
              <AnimatedClockLabel snapshotTime={snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} />
            </PageRefreshButton>
          </ToolbarChip>
          <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>{sessionChip}</span>
        </>
      )}
    </div>
    {!isPhoneMapFrame && (
      <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>
        <TaxonomyBadge taxonomy={sheet} strongIndustryColor={strongIndustryColor} />
      </div>
    )}
    </>
  )
  // PC 화면과 폰 화면이 같은 툴바 원본을 쓴다(폰에서는 툴바 줄을 판 밖에 둔다).
  const summaryToolbarNode = <Toolbar>{toolbarContent}</Toolbar>
  // 서머리의 두 틀(제목·캡처 이름·내용) — 화면과 틀별 캡처판이 같은 내용을 쓴다.
  const summaryFrames = [
              { ...MARKET_MAP_FRAME, children: (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {hasData ? <OverviewMap items={overview.items} colorScale={colorScale} large decimalPlaces={1} onSelect={handleSelectSector} /> : isLoading ? <p className="text-ui-muted">불러오는 중</p> : <EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" />}
                </div>
              ) },
              { ...GROUP_CHANGE_FRAME, children: (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {hasData ? <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} decimalPlaces={1} onSelectSector={handleSelectSector} /> : null}
                </div>
              ) },
  ]
  const { frameSensors, safeSummaryFrameOrder, handleFrameDragEnd, orderFrames } = useSummaryFrameOrder()
  const orderedSummaryFrames = orderFrames(summaryFrames)
  const fixedCaptureRef = useRef<HTMLDivElement>(null)
  // 미리보기 판은 실제 그래프 판보다 여백이 4px 더 넓다. 같은 막대가 전환 후에도 툴바 첫 배지 왼쪽에 오도록 가로만 맞춘다.
  const graphPreviewPathBarLeftShift = phonePathBarLeftShift(8)
  const graphPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '8px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
      <section aria-label="업종 등락률 그래프" className="flex h-full flex-col bg-ui-background p-1">
        {hasData && <div style={{ zoom: PHONE_PATH_CANVAS_ZOOM }}>
          <header className="shrink-0 bg-ui-background px-3 py-0" style={{ transform: `translateX(-${graphPreviewPathBarLeftShift}px)` }}>
            <PathBar variant="phone" currentAria="location" crumbs={[{ key: 'market', label, current: true }]} />
          </header>
        </div>}
        {isLoading || isFetching ? <div className="flex h-full items-center justify-center"><Spinner /></div>
          : <MobileGraphBars items={graphPreviewItems} colorScale={colorScale} highlightColor={strongIndustryColor} />}
      </section>
    </div>
  )
  // 업종 지도에서 종목 지도 쪽(오른쪽 스와이프)으로 갈 때 왼쪽에서 따라올 미리보기. 그룹 등락률 화면의 미리보기와 같은 판을 쓴다.
  const { filteredRootNodes: mapPreviewNodes } = useFilteredHeatmap(tree, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, PHONE_MAP_PREVIEW_FILTERS)
  const mapPreviewGroups = useMemo(() => mapPreviewNodes.map(toDisplayGroup), [mapPreviewNodes])
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
              topPickSectorKeys: PHONE_MAP_PREVIEW_NO_TOP_PICKS,
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
  if (isPhoneMapFrame) {
    const marketKey: MobileMapMarket = market === 'JAPAN' ? 'japan' : 'usa'
    const mapPath = overseasRoute('/map', market)
    const graphPath = overseasRoute('/graph', market)
    return (
      <PhoneMapShell
        zoomMode="blocked"
        infoPopup={infoPopup}
        onCloseInfoPopup={closeInfoPopup}
        navigationKey={`${location.key}|${phoneSectorPath.join('>')}`}
        onSwipe={direction => navigate(direction === 'next' ? graphPath : mapPath)}
        onBeforeSwipeNavigate={direction => { if (direction === 'previous') captureSwipeArrivalOverlay(mapPreviewRef.current) }}
        toolbar={summaryToolbarNode}
        topBar={<MobileTopBar title="업종 지도" titleTo={graphPath} titleLabel="그룹 등락률로 이동" />}
        frameHeight={MAP_MOBILE_CAPTURE_FRAME_HEIGHT * phoneFrameScale}
        nextPreview={graphPreview}
        previousPreview={mapPreview}
        frame={
          <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
            <div className="flex h-full flex-col bg-ui-background">
              {isLoading ? <div className="flex flex-1 items-center justify-center"><Spinner showElapsed className={MOBILE_LOADING_SIZE_CLASS} /></div> : hasData ? (
                <div className="flex min-h-0 flex-1 flex-col p-1">
                  {phoneDrillMapItems.length ? <MobileSectorMap items={phoneDrillMapItems} colorScale={colorScale} decimalPlaces={1} onSelect={handlePhoneSectorSelect} onLongPress={(item, target) => openPhoneDrillPopup(phoneDrillMapItems.find(drill => drill.key === item.key) ?? item, target)} /> : <div className="flex h-full items-center justify-center text-[14px] text-ui-muted">이 날짜에는 표시할 데이터가 없습니다.</div>}
                </div>
              ) : <div className="flex flex-1 items-center justify-center text-[14px] text-ui-muted">이 날짜에는 표시할 데이터가 없습니다.</div>}
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
    <div className="flex h-screen min-h-0 select-none flex-col bg-ui-background">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => openScreenshot(screenshotRef.current)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          {summaryToolbarNode}
          <div className="flex min-h-0 flex-1">
            {/* 캡처 복제본에서는 가로 스크롤 래퍼가 스크롤바 자리만큼 아래·오른쪽을 잘라 내서, 캡처 중에는 스크롤을 풀어 둔다. */}
            <div className={`flex min-h-0 min-w-0 flex-1 bg-ui-background ${isShareOpen ? 'overflow-visible' : 'overflow-x-auto'}`}>
              <SortableSummaryScreenFrames frames={orderedSummaryFrames} order={safeSummaryFrameOrder} sensors={frameSensors} onDragEnd={handleFrameDragEnd} {...badgeStyleProps} />
            </div>
          </div>
          <DisclaimerFooter rightContent={<ChangeRateBar swatches={legendSwatches} />} />
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
        <SettingsPanel pageLabel="Summary" tabStorageName={tabStorageName} taxonomyAtBottom taxonomy={sheet} onlyTaxonomy="MARKETRY" snapshotTime={publishedAt} alsoTaxonomies={canUseMine ? ['MINE'] : undefined} withoutMiddle onSelectTaxonomy={next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY')} showPreferenceActions={sheet === 'MINE'} stockCountLabel={formatStockCountLabel(shownCount, totalCount)} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
          <SettingsPanelGroup section="composition">
            <SettingsMarketValueSection isCustom={false} tiers={tierRange.tiers} tierRangeMinIndex={tierRange.minIndex} tierRangeMaxIndex={tierRange.maxIndex} onChangeTierRange={tierRange.setRange} showDivider={false} currencyUnit={currencyUnit} />
            <SettingsExcludeSection sectorFilterEnabled={sectorExclusion.enabled} onToggleSectorFilter={sectorExclusion.toggle} excludedSectors={buildExcludedSectorRows(tree, sectorExclusion.ids, tierRange.excludedMarketValueTiers)} onRemoveExcludedSector={sectorExclusion.remove} />
          </SettingsPanelGroup>
          <SettingsPanelGroup section="colors">
            {/* 지도 화면과 같은 구성이다. 등락률 색상·강조 색상은 내 기준 모드에서만 고칠 수 있고(한국 내 기준과 같은 값을 공유), MARKETRY 모드에서는 잠근다. */}
            <SettingsColorSection {...colorSettings.colorSectionProps} />
            <SettingsStrongIndustryColorSection {...colorSettings.strongSectionProps} />
          </SettingsPanelGroup>
        </SettingsPanel>
        </div>
      </div>
      {isShareOpen && (
        <HiddenSummaryCaptureFrames captureRef={fixedCaptureRef} frameCount={summaryFrames.length} frames={orderedSummaryFrames} toolbar={<Toolbar className="summary-capture-toolbar">{toolbarContent}</Toolbar>} frameWidth={SUMMARY_CAPTURE_FRAME_WIDTH} {...badgeStyleProps} />
      )}
      {isShareOpen && <ScreenshotModal onClose={closeScreenshot} onCopy={copy} copyLabel={copyLabel} isCopying={isCopying} screenshotTarget={screenshotTarget} captureReady={!isLoading}
          fixedSummaryCaptureRef={fixedCaptureRef}
          frameCaptureOptions={frameCaptureOptionsFor(safeSummaryFrameOrder)}
        />}
    </div>
  )
}
