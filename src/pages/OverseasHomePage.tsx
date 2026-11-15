import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import { marketMenu } from '@/utils/marketMenu'
import { useNavigate } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { HOME_CAPTURE_FRAME_HEIGHT, HOME_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'
import NavBarPageActions from '@/components/NavBarPageActions'
import SettingsPanel, { SettingsColorSection, SettingsPanelGroup, SettingsStrongIndustryColorSection, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import { buildFixedColorEditorProps } from '@/utils/fixedColorEditor'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import ScreenshotModal from '@/components/ScreenshotModal'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import OverviewMap, { type OverviewMapItem } from '@/components/OverviewMap'
import RankBars from '@/components/RankBars'
import ToolbarModeText from '@/components/ToolbarModeText'
import JapanSessionChip from '@/components/JapanSessionChip'
import UsaSessionChip from '@/components/UsaSessionChip'
import { ClockIcon } from '@/components/icons/AppIcons'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import { japanSessionAt, type JapanSession } from '@/utils/japanMarketSession'
import { USA_SESSION, usaRefreshHelp } from '@/utils/usaMarketSession'
import Toolbar from '@/components/Toolbar'
import ChangeRateBar from '@/components/ChangeRateBar'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { FRAME_BADGE_CLASS } from '@/components/FrameBadge'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { resolveHeatmapColor, resolveLegendSwatches } from '@/utils/heatmapColorScale'
import { useJapanPeriodQuotes, useJapanQuotes, useJapanSnapshotTimes } from '@/hooks/useJapanQuotes'
import { useUsaPeriodQuotes, useUsaQuotes, useUsaSnapshotTimes, useUsaStocks } from '@/hooks/useUsaQuotes'
import { useCrossMarketPeriod } from '@/hooks/useCrossMarketPeriod'
import JapanDatePicker from '@/components/JapanDatePicker'
import UsaDatePicker from '@/components/UsaDatePicker'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarPinButton from '@/components/ToolbarPinButton'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import { PageRefreshButton } from '@/components/NavBarPageActions'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import { buildRankChart } from '@/utils/rankChart'
import { buildJapanTree, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { JAPAN_MAP_FIXED, JAPAN_REFRESH_HELP, NO_TAXONOMY_CHANGE } from '@/utils/japanMapSettings'
import { USA_MAP_FIXED } from '@/utils/usaMapSettings'
import { collectAtDepth } from '@/utils/sectorDepth'
import { summarizeSector } from '@/utils/sectorAverage'
import japanStocks from '@/data/japanStocks.json'

// 국내 홈과 같은 키를 쓴다 — 한 번 바꾼 좌우 순서가 세 홈에 똑같이 적용된다.
const HOME_FRAME_ORDER_KEY = 'marketry-home-frame-order'
const DEFAULT_HOME_FRAME_ORDER = ['업종 지도', '그룹 등락률 (%)']

// 홈의 틀 — 제목 배지를 끌어서 순서를 바꾼다(국내 홈의 SortableHomeFrame과 같은 모양).
function SortableHomeFrame({ title, captureId, index, children, captureUntil }: { title: string; captureId: string; index: number; children: ReactNode; captureUntil?: string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: title })
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      data-capture-until={captureUntil}
      style={{ order: index, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.7 : undefined }}
      className="home-summary-frame relative flex h-full min-w-[320px] flex-1 basis-0 flex-col bg-ui-background"
    >
      <div data-capture-frame={captureId} className={`flex min-h-0 flex-1 flex-col bg-ui-background ${index === 0 ? 'pl-0 pr-1' : 'pl-1 pr-0'}`}>
        <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-ui-border bg-ui-background px-[7px] py-[7px]">
          <div className="relative z-[6] flex h-6 min-h-6 shrink-0 items-center">
            <span ref={setActivatorNodeRef} {...attributes} {...listeners} data-hint="끌어서 항목 순서 변경" className={`${FRAME_BADGE_CLASS} cursor-grab active:cursor-grabbing`}>{title}</span>
          </div>
          <div className="mt-0.5 flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </section>
  )
}

// 틀 하나만 찍는 3:4 캡처판의 틀 — SortableHomeFrame의 안쪽 틀과 같은 모양(끌기·정렬 없이 고정).
function CaptureFrame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-transparent bg-ui-background pb-1.5 pl-[7px] pr-[7px] pt-[7px]">
      <div className="relative z-[6] flex h-6 min-h-6 shrink-0 items-center">
        <span className={FRAME_BADGE_CLASS}>{title}</span>
      </div>
      <div className="mt-0.5 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

const SECTION_ORDER: SettingsPanelSectionId[] = ['colors']

// 홈의 일본·미국 구성. 업종 지도와 그룹 등락률을 지도 화면과 같은 트리·계산으로 만든다(최신 시세 기준).
// 날짜 달력·시계 새로고침·설정 패널은 지도 화면과 같은 부품을 쓴다. 설정 패널은 색상 탭만 있다(편집할 설정이 없고 지도 화면과 같은 고정값을 보여 준다).
export default function OverseasHomePage({ market }: { market: 'JAPAN' | 'USA' }) {
  const isJapan = market === 'JAPAN'
  const navigate = useNavigate()
  // 업종을 누르면 같은 시장의 지도 화면에서 그 업종을 연다(국내 홈과 같은 동작).
  const handleSelectSector = (sectorName: string) => navigate(`/map/${isJapan ? 'japan' : 'usa'}?sector=${encodeURIComponent(sectorName)}`)
  const base = isJapan ? 'japan' : 'usa'
  const categories = useQuery({ queryKey: [base, 'categories'], queryFn: async () => (await client.get<JapanCategory[]>(`/${base}/categories`)).data })
  const classifications = useQuery({ queryKey: [base, 'classifications'], queryFn: async () => (await client.get<Record<string, JapanClassification>>(`/${base}/classifications`)).data })
  const japanNames = useQuery({ queryKey: ['japan', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/japan/stock-names')).data, enabled: isJapan })
  const usaNames = useQuery({ queryKey: ['usa', 'names'], queryFn: async () => (await client.get<Record<string, string>>('/usa/stock-names')).data, enabled: !isJapan })
  const usaStocks = useUsaStocks()
  // 날짜·기간은 지도·그래프와 같은 저장소를 쓴다(다른 화면에서 고른 기간이 이어진다).
  const japanTimes = useJapanSnapshotTimes(isJapan)
  const usaTimes = useUsaSnapshotTimes(!isJapan)
  const { selectedTime, rangeStart, isResolving: isPeriodResolving, select, selectRange } = useCrossMarketPeriod(market, (isJapan ? japanTimes : usaTimes).data)
  const japanQuotes = useJapanQuotes(selectedTime, isJapan)
  const usaQuotes = useUsaQuotes(selectedTime, !isJapan)
  const japanLive = useJapanQuotes(null, isJapan)
  const usaLive = useUsaQuotes(null, !isJapan)
  const japanPeriod = useJapanPeriodQuotes(isJapan ? rangeStart : null, selectedTime)
  const usaPeriod = useUsaPeriodQuotes(isJapan ? null : rangeStart, selectedTime)
  const quotes = isJapan ? japanQuotes : usaQuotes
  const liveQuotes = isJapan ? japanLive : usaLive
  const periodQuotes = isJapan ? japanPeriod : usaPeriod
  // 기간이면 기간 등락률 시세를, 아니면 고른 날짜(없으면 최신)의 시세를 쓴다.
  const shownQuotes = rangeStart ? periodQuotes.data : quotes.data
  const colorScale = isJapan ? JAPAN_MAP_FIXED.colorScale : USA_MAP_FIXED.colorScale
  const strongIndustryColor = isJapan ? JAPAN_MAP_FIXED.strongIndustryColor : USA_MAP_FIXED.strongIndustryColor

  const snapshotTime = quotes.data?.snapshotTime ?? null
  const tree = useMemo(() => {
    const snap = shownQuotes?.snapshotTime ?? null
    if (!categories.data || !classifications.data || !shownQuotes || !snap) return []
    if (isJapan) {
      if (!japanNames.data) return []
      return buildJapanTree(japanStocks, categories.data, classifications.data, japanNames.data, shownQuotes.quotes, snap)
    }
    if (!usaStocks.data || !usaNames.data) return []
    const names = Object.fromEntries(usaStocks.data.map(stock => [stock.symbol, usaNames.data?.[stock.symbol] ?? stock.symbol]))
    const treeStocks = usaStocks.data.map(stock => ({ code: stock.symbol, name: stock.name }))
    return buildJapanTree(treeStocks, categories.data, classifications.data, names, shownQuotes.quotes, snap)
  }, [categories.data, classifications.data, shownQuotes, isJapan, japanNames.data, usaNames.data, usaStocks.data])

  // 업종 지도 항목과 그룹 등락률 막대 — 지도 화면과 같이 한 단계(대분류)만 쓴다.
  const overview = useMemo(() => {
    const items: OverviewMapItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, 1, new Set<number>(), new Set<string>(), true, '')) {
      const summary = summarizeSector(node, new Set<string>())
      if (!summary) continue
      items.push({ key: pathKey, name: node.sectorName, marketValue: summary.marketValue, changeRate: summary.weightedAvg, simpleAvg: summary.simpleAvg, advancers: summary.advancers, decliners: summary.decliners, unchanged: summary.unchanged })
    }
    const chart = buildRankChart(items.map(item => ({ key: item.key, sectorName: item.name, value: item.changeRate, isReference: false })))
    return { items, chart }
  }, [tree])

  const label = isJapan ? 'NIKKEI225' : 'S&P500'
  // 지도·그래프와 같은 목록(KOREA 아래 KOSPI·KOSDAQ, JAPAN, USA) — 일본·미국 홈은 특별 회원·관리자만 열 수 있다.
  const menu = marketMenu('/summary', market, true)
  const isLoading = isPeriodResolving || categories.isLoading || classifications.isLoading || quotes.isLoading || periodQuotes.isLoading
  const isPastSnapshot = rangeStart !== null || (snapshotTime !== null && liveQuotes.data?.snapshotTime != null && snapshotTime !== liveQuotes.data.snapshotTime)
  const nameOf = (code: string) => (isJapan ? japanNames.data?.[code] : usaNames.data?.[code]) ?? code
  const rangeExcludedStocks = periodQuotes.excluded.map(stock => ({ stockCode: stock.stockCode, stockName: nameOf(stock.stockCode) }))
  const refetchAll = () => Promise.all([quotes.refetch(), categories.refetch(), classifications.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const holidayColor = resolveHeatmapColor(8, colorScale)

  // 화면 캡처·전체화면 — 지도 화면과 같은 방식이다.
  const screenshotRef = useRef<HTMLDivElement>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
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
  const hasData = tree.length > 0

  const session = snapshotTime ? (isJapan ? japanSessionAt(snapshotTime) : USA_SESSION) : null
  const toolbarContent = (
    <>
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      <ToolbarModeText page="SUMMARY" label={label} showChevron menu={menu} />
      <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}>
        {isJapan
          ? <JapanDatePicker snapshotTime={snapshotTime} liveTime={liveQuotes.data?.snapshotTime ?? null} rangeStart={rangeStart} holidayColor={holidayColor} onSelect={select} onSelectRange={selectRange} />
          : <UsaDatePicker snapshotTime={snapshotTime} liveTime={liveQuotes.data?.snapshotTime ?? null} rangeStart={rangeStart} holidayColor={holidayColor} onSelect={select} onSelectRange={selectRange} />}
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
      {!rangeStart && (selectedTime === null || selectedTime.slice(0, 10) === liveQuotes.data?.snapshotTime?.slice(0, 10)) && (
        <>
          <ToolbarChip bare>
            <PageRefreshButton cell onRefresh={refetchAll} isRefreshing={quotes.isFetching || categories.isFetching || classifications.isFetching} helpText={isJapan ? JAPAN_REFRESH_HELP : usaRefreshHelp(snapshotTime)} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}>
              <AnimatedClockLabel snapshotTime={snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} />
            </PageRefreshButton>
          </ToolbarChip>
          {session && (isJapan ? <JapanSessionChip session={session as JapanSession} /> : <UsaSessionChip session={USA_SESSION} />)}
        </>
      )}
    </div>
    <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>
      <TaxonomyBadge taxonomy="MARKETRY" strongIndustryColor={strongIndustryColor} />
    </div>
    </>
  )
  // 홈의 두 틀(제목·캡처 이름·본문) — 화면과 틀별 캡처판이 같은 본문을 쓴다.
  const homeFrames = [
              { title: '업종 지도', captureId: 'market-map', node: (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {hasData ? <OverviewMap items={overview.items} colorScale={colorScale} large decimalPlaces={1} onSelect={handleSelectSector} /> : <p className="text-ui-muted">{isLoading ? '불러오는 중' : '데이터가 없습니다.'}</p>}
                </div>
              ) },
              { title: '그룹 등락률 (%)', captureId: 'group-change-rate', node: (
                <div className="relative flex min-h-0 flex-1 flex-col">
                  {hasData ? <RankBars chart={overview.chart} highlightColor={strongIndustryColor} colorScale={colorScale} decimalPlaces={1} onSelectSector={handleSelectSector} /> : null}
                </div>
              ) },
  ]
  const frameSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [homeFrameOrder, setHomeFrameOrder] = useLocalPersistedState(HOME_FRAME_ORDER_KEY, DEFAULT_HOME_FRAME_ORDER)
  const savedHomeFrameOrder = homeFrameOrder.map(title => (title === '시장 지도' || title === '요약 지도' ? '업종 지도' : title))
  const safeHomeFrameOrder = [
    ...savedHomeFrameOrder.filter((title, index) => DEFAULT_HOME_FRAME_ORDER.includes(title) && savedHomeFrameOrder.indexOf(title) === index),
    ...DEFAULT_HOME_FRAME_ORDER.filter(title => !savedHomeFrameOrder.includes(title)),
  ]
  const orderedHomeFrames = [...homeFrames].sort((a, b) => safeHomeFrameOrder.indexOf(a.title) - safeHomeFrameOrder.indexOf(b.title))
  const handleFrameDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = safeHomeFrameOrder.indexOf(String(active.id))
    const to = safeHomeFrameOrder.indexOf(String(over.id))
    if (from >= 0 && to >= 0) setHomeFrameOrder(arrayMove(safeHomeFrameOrder, from, to))
  }
  const fixedCaptureRef = useRef<HTMLDivElement>(null)
  return (
    <div className="flex h-screen min-h-0 select-none flex-col bg-ui-background">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col">
          <Toolbar>
            {toolbarContent}
          </Toolbar>
          <div className="flex min-h-0 flex-1">
            {/* 캡처 복제본에서는 가로 스크롤 래퍼가 스크롤바 자리만큼 아래·오른쪽을 잘라 내서, 캡처 중에는 스크롤을 풀어 둔다. */}
            <div className={`flex min-h-0 min-w-0 flex-1 bg-ui-background ${isShareOpen ? 'overflow-visible' : 'overflow-x-auto'}`}>
              <DndContext sensors={frameSensors} collisionDetection={closestCenter} onDragEnd={handleFrameDragEnd}>
                <SortableContext items={safeHomeFrameOrder} strategy={horizontalListSortingStrategy}>
                  <div data-capture-full-width className="flex min-h-0 min-w-full flex-1 bg-ui-background">
                    {orderedHomeFrames.map((frame, frameIndex) => (
                      <SortableHomeFrame key={frame.title} title={frame.title} captureId={frame.captureId} index={frameIndex} captureUntil={frameIndex === 1 ? '' : undefined}>
                        {frame.node}
                      </SortableHomeFrame>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
          <DisclaimerFooter rightContent={<ChangeRateBar swatches={resolveLegendSwatches(colorScale)} />} />
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
        <SettingsPanel pageLabel="Summary" tabStorageName={isJapan ? 'JapanHome' : 'UsaHome'} taxonomyAtBottom taxonomy="MARKETRY" onlyTaxonomy="MARKETRY" onSelectTaxonomy={NO_TAXONOMY_CHANGE} stockCountLabel={`${shownQuotes?.quotes.length ?? 0}/${isJapan ? japanStocks.length : (usaStocks.data?.length ?? 0)}종목`} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
          <SettingsPanelGroup section="colors">
            {/* 지도 화면과 같은 구성이다. 등락률 색상·상위 업종 강조 색은 고정값을 보여 주고 바꾸지 못한다. */}
            <SettingsColorSection
              isCustom={false}
              colorScaleDraft={colorScale}
              colorCustomOn
              onChangeColorCustomOn={() => {}}
              onResetColorScale={() => {}}
              isResettingColorScale={false}
              colorEditorProps={buildFixedColorEditorProps()}
              fixed
            />
            <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={() => {}} fixed />
          </SettingsPanelGroup>
        </SettingsPanel>
        </div>
      </div>
      {isShareOpen && (
        <div
          ref={fixedCaptureRef}
          aria-hidden="true"
          data-home-fixed-capture
          className="fixed flex flex-col bg-ui-background"
          style={{ left: 0, top: 0, width: HOME_CAPTURE_FRAME_WIDTH * homeFrames.length, height: HOME_CAPTURE_FRAME_HEIGHT, opacity: 0, pointerEvents: 'none' }}
        >
          <div className="flex min-h-0 flex-1 bg-ui-background">
            {orderedHomeFrames.map(frame => (
              <div key={frame.title} data-capture-fixed-frame={frame.captureId} data-capture-frame={frame.captureId} className="flex h-full shrink-0 flex-col bg-ui-background p-1" style={{ width: HOME_CAPTURE_FRAME_WIDTH }}>
                <Toolbar className="home-capture-toolbar">{toolbarContent}</Toolbar>
                <CaptureFrame title={frame.title}>{frame.node}</CaptureFrame>
              </div>
            ))}
          </div>
        </div>
      )}
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} captureReady={!isLoading}
          fixedHomeCaptureRef={fixedCaptureRef}
          frameCaptureOptions={safeHomeFrameOrder.map((title, selectedSlot) => {
            const captureId = title === '업종 지도' ? 'market-map' : 'group-change-rate'
            return { id: captureId, label: ['좌측', '우측'][selectedSlot], selector: `[data-capture-frame="${captureId}"]`, selectedSlot: selectedSlot as 0 | 1, mode: 'content' as const }
          })}
        />}
    </div>
  )
}
