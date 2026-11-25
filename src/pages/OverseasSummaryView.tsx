import SummaryScreen from '@/components/SummaryScreen'
import SummaryToolbar from '@/components/SummaryToolbar'
import type { MarketScreenData } from '@/markets/marketContract'
import MarketDatePicker from '@/components/MarketDatePicker'
import { useMemo, useRef, useState } from 'react'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { buildExcludedSectorRows, countVisibleItems } from '@/utils/overseasSectorExclusion'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import MobileGraphBars, { type MobileGraphItem } from '@/components/MobileGraphBars'
import { marketMenu } from '@/utils/marketMenu'
import { useLocation, useNavigate } from 'react-router-dom'

import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { SUMMARY_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT } from '@/utils/screenshotToPreview'
import type { SettingsPanelSectionId } from '@/components/SettingsPanel'
import Toolbar, { TOOLBAR_SESSION_SLOT_WIDTH } from '@/components/Toolbar'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { collectAtDepth } from '@/utils/sectorDepth'
import { collectItems, summarizeSector } from '@/utils/sectorAverage'
import { overseasRoute } from '@/utils/markets'
import type { OverseasSummarySource } from '@/hooks/overseasSummarySource'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { usePhoneMapInfoPopup } from '@/hooks/usePhoneMapInfoPopup'
import PhonePathStockChart from '@/components/PhonePathStockChart'
import { chartSectorPath } from '@/utils/chartSectorPath'
import { useStockChart } from '@/hooks/useStockChart'
import PhoneSectorMapFrame from '@/components/PhoneSectorMapFrame'
import PhoneMapShell from '@/components/PhoneMapShell'
import { PHONE_PATH_CANVAS_ZOOM, phonePathBarLeftShift } from '@/utils/phonePathBar'
import PathBar, { type PathCrumb } from '@/components/PathBar'
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
    market, label, tree, snapshotTime, liveSnapshotTime, rangeStart, select, selectRange, rangeExcludedStocks,
    isLoading, isFetching, refetchAll, graphIndexItems, sessionChip, refreshHelp, fixed, tabStorageName, settingPrefix, currencyUnit, totalCount,
  } = source
  const publishedAt = useOverseasPublishedAt(market, sheet)
  // 시가총액 범위 — 지도·그래프와 같은 저장 값. 업종 요약과 막대, 설정창의 종목 수에 함께 반영한다.
  const tierRange = useOverseasTierRange(settingPrefix, currencyUnit)
  const sectorExclusion = useOverseasSectorExclusion(settingPrefix)
  const colorSettings = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: 'mine' })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  const navigate = useNavigate()
  // 폰에서는 업종 지도 한 장을 5:8 판에 맞춰 보여 준다. 상단 줄·툴바 줄·하단 설정 줄은 세 시장이 같은 틀을 쓴다.
  const isPhoneMapFrame = useIsNarrowScreen()
  // 화면 확대 차단은 공통 셸(PhoneMapShell)이 zoomMode로 관리한다.
  const phoneFrameScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const [storedMobileBoxSizeRatio, onChangeMobileBoxSizeRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  const boxSizeMarketCapRatio = normalizeMobileBoxSizeRatio(storedMobileBoxSizeRatio)
  useCarriedBoxSize(onChangeMobileBoxSizeRatio)

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
  const { chartStock, openChart, closeChart } = useStockChart()
  // 업종을 한 단계 열 때마다 기록이 한 칸 쌓이므로, 앞 단계로 돌아갈 때는 그만큼 되돌아간다.
  const phonePathCrumbs: PathCrumb[] = [label, ...phoneSectorPath].map((name, index) => {
    const back = phoneSectorPath.length - index
    return back === 0 ? { key: `${name}-${index}`, label: name, current: true } : { key: `${name}-${index}`, label: name, onClick: () => navigate(-back) }
  })
  const handlePhoneSectorSelect = (name: string, item: MobileSectorMapItem) => {
    closeInfoPopup()
    // 마지막 단계의 칸은 종목이다. 누르면 종목 지도와 같은 차트를 연다.
    if (phoneShowingStocks) {
      openChart({ code: item.key, name, sectorPath: chartSectorPath(phonePathCrumbs) })
      return
    }
    const next = [...phoneSectorPath, name]
    setPhoneSectorPath(next)
    navigate(location.pathname + location.search, { state: { phoneSectorPath: next } })
  }

  // 그룹 등락률 미리보기의 막대 — 한 단계(대분류)만 쓴다.
  const majorSectors = useMemo(() => collectAtDepth(tree, 1, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers).flatMap(({ node, pathKey }) => {
    const summary = summarizeSector(node, tierRange.excludedMarketValueTiers)
    return summary ? [{ key: pathKey, name: node.sectorName, value: summary.weightedAvg }] : []
  }), [tree, tierRange.excludedMarketValueTiers, sectorExclusion.excludedSectorIds])
  // 업종 지도에서 그룹 등락률로 스와이프·상단 버튼 이동할 때 따라올 미리보기.
  const graphPreviewItems: MobileGraphItem[] = [...majorSectors]
  for (const index of graphIndexItems) graphPreviewItems.push({ ...index, reference: true })
  const shownCount = useMemo(() => countVisibleItems(tree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers), [tree, sectorExclusion.excludedSectorIds, tierRange.excludedMarketValueTiers])
  // 지도·그래프와 같은 목록(KOREA 아래 KOSPI·KOSDAQ, JAPAN, USA) — 일본·미국 서머리는 특별 회원·관리자만 열 수 있다.
  const menu = marketMenu('/summary', market, true)
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveSnapshotTime !== null && snapshotTime !== liveSnapshotTime)
  const holidayColor = resolveHeatmapColor(8, colorScale)

  // 종목 지도로 넘어갈 때 덮개로 남길 미리보기 판.
  const mapPreviewRef = useRef<HTMLDivElement>(null)
  const hasData = tree.length > 0

  const { isLoading: isBaseLoading, isError, isIndexLoading, indexBars, intradayDelta } = source
  const marketData: MarketScreenData = {
    id: market,
    label,
    currencyUnit,
    tree,
    indexBars,
    state: isBaseLoading || isIndexLoading ? { status: 'loading' } : isError ? { status: 'error', retry: () => { void refetchAll() } } : { status: 'ready' },
    refresh: { run: () => { void refetchAll() }, isRunning: isFetching, help: refreshHelp },
    session: <span className="flex shrink-0" style={{ width: TOOLBAR_SESSION_SLOT_WIDTH }}>{sessionChip}</span>,
    period: {
      snapshotTime,
      liveSnapshotTime,
      isPast: isPastSnapshot,
      rangeStart,
      excludedStocks: rangeExcludedStocks,
      clear: () => select(null),
      picker: <MarketDatePicker market={market} snapshotTime={snapshotTime} liveTime={liveSnapshotTime} rangeStart={rangeStart} holidayColor={holidayColor} onSelect={select} onSelectRange={selectRange} />,
    },
    isMineEmpty: sheet === 'MINE' && tree.every(node => collectItems(node).length === 0),
    mineSetupPath: overseasRoute('/sector', market),
    features: { subMarkets: null, afterHours: false, timeWindowNotice: null, exchangeTaxonomy: false, intradayDelta },
  }
  const summaryToolbarNode = <Toolbar><SummaryToolbar market={marketData} menu={menu} right={null} /></Toolbar>
  // 실제 그래프 판과 같은 4px 여백을 써서, 미는 동안 업종 지도와 그래프의 경로 줄이 같은 높이에 놓인다.
  const graphPreviewPathBarLeftShift = phonePathBarLeftShift(4)
  const graphPreview = (
    <div style={{ width: `${SUMMARY_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box', transform: `scale(${phoneFrameScale})`, transformOrigin: 'top left' }} className="relative bg-ui-background">
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
      <>
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
          <PhoneSectorMapFrame scale={phoneFrameScale} crumbs={!isLoading && hasData ? phonePathCrumbs : null} accentColor={strongIndustryColor}>
            {isLoading ? <div className="flex flex-1 items-center justify-center"><Spinner showElapsed className={MOBILE_LOADING_SIZE_CLASS} /></div>
              : hasData && phoneDrillMapItems.length ? <MobileSectorMap items={phoneDrillMapItems} colorScale={colorScale} decimalPlaces={1} onSelect={handlePhoneSectorSelect} onLongPress={(item, target) => openPhoneDrillPopup(phoneDrillMapItems.find(drill => drill.key === item.key) ?? item, target)} />
                : <div className="flex h-full items-center justify-center text-[14px] text-ui-muted">이 날짜에는 표시할 데이터가 없습니다.</div>}
          </PhoneSectorMapFrame>
        }
        current={marketKey}
        boxSize={boxSizeMarketCapRatio}
        onChangeBoxSize={onChangeMobileBoxSizeRatio}
      />
        <PhonePathStockChart chartStock={chartStock} crumbs={phonePathCrumbs} market={marketKey} closeChart={closeChart} />
      </>
    )
  }
  return (
    <SummaryScreen
      market={marketData}
      menu={menu}
      taxonomy={sheet}
      filters={{
        valueRange: { ...tierRange, excluded: tierRange.excludedMarketValueTiers },
        sectorExclusion: { enabled: sectorExclusion.enabled, toggle: sectorExclusion.toggle, excludedIds: sectorExclusion.excludedSectorIds, rows: buildExcludedSectorRows(tree, sectorExclusion.ids, tierRange.excludedMarketValueTiers), remove: sectorExclusion.remove, suspendedStockCount: null },
      }}
      colors={{ colorScale, strongIndustryColor, legendSwatches, scaleSection: colorSettings.colorSectionProps, strongSection: colorSettings.strongSectionProps }}
      mapPath={overseasRoute('/map', market)}
      onSelectIndex={null}
      panel={{ tabStorageName: tabStorageName, onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY'), showPreferenceActions: sheet === 'MINE', stockCountLabel: formatStockCountLabel(shownCount, totalCount), sectionOrder: SECTION_ORDER }}
    />
  )
}
