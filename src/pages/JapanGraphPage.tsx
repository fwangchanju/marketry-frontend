import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import client from '@/api/client'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import JapanDatePicker from '@/components/JapanDatePicker'
import JapanSessionChip from '@/components/JapanSessionChip'
import NavBar from '@/components/NavBar'
import NavBarPageActions, { PageRefreshButton } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import RankColumns, { type RankColumnItem } from '@/components/RankColumns'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsAverageModeSection, SettingsBeforeMinutesSection, SettingsGroupDepthSection, SettingsPanelGroup, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import Toolbar from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon } from '@/components/icons/AppIcons'
import stocks from '@/data/japanStocks.json'
import { useJapanGraphPreferences } from '@/hooks/useJapanGraphPreferences'
import { useJapanIndexCloses } from '@/hooks/useJapanIndexCloses'
import { useJapanIndexQuotes } from '@/hooks/useJapanIndexQuotes'
import { useJapanPeriodQuotes, useJapanQuotes, useJapanSnapshotTimes } from '@/hooks/useJapanQuotes'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { resolveHeatmapColor, resolveLegendSwatches } from '@/utils/heatmapColorScale'
import { JAPAN_GRAPH_DRAFT_KEY_MAP } from '@/utils/japanGraphSettings'
import { JAPAN_MAP_FIXED, JAPAN_REFRESH_HELP, JAPAN_SETTINGS_TAB_STORAGE, NO_TAXONOMY_CHANGE } from '@/utils/japanMapSettings'
import { buildJapanTree, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { japanSessionAt } from '@/utils/japanMarketSession'
import { graphIndexValue, indexChangeRate, indexRange, intradayRateAt, shiftDate } from '@/utils/indexChange'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import type { HeatmapSectorNode } from '@/types/api'

const DEPTH_NAMES = ['대분류', '중분류', '소분류']
const NO_EXCLUDED_SECTORS = new Set<number>()
const NO_EXCLUDED_TIERS = new Set<string>()
const SECTION_ORDER: SettingsPanelSectionId[] = ['graph']
// 휴장이 이어져도 시작일 앞 거래일의 종가가 들어오도록 시작일 앞 며칠을 더 받는다(황금연휴 등).
const INDEX_LOOKBACK_DAYS = 14
const NIKKEI_LABEL = '닛케이'
const { colorScale, strongIndustryColor } = JAPAN_MAP_FIXED

// 기준 시각에서 N분 전 시각을 "YYYY-MM-DDTHH:mm"으로 만든다. 일본 시각을 한국 시각과 같게 저장해서 시간대 변환이 없다.
function minutesBefore(snapshotTime: string, minutes: number): string {
  const time = new Date(new Date(snapshotTime).getTime() - minutes * 60_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`
}

export default function JapanGraphPage() {
  const navigate = useNavigate()
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
  // 종가 기준 지수 막대는 기간과 지난 날짜 보기에 쓴다. 오늘 화면은 종가가 아직 저장되지 않아 이 값이 없고, 장중 지수(아래)가 대신한다.
  const indexSpan = indexRange(rangeStart, snapshotTime, liveQuotes.data?.snapshotTime ?? null)
  const indexCloses = useJapanIndexCloses(indexSpan ? shiftDate(indexSpan.startDate, -INDEX_LOOKBACK_DAYS) : null, indexSpan?.endDate ?? null)
  const indexRate = indexSpan && indexCloses.data ? indexChangeRate(indexCloses.data, indexSpan.startDate, indexSpan.endDate) : null
  const { preferences, update } = useJapanGraphPreferences()
  const showDelta = rangeStart === null && preferences.graphMode === 'delta'
  const toggleGraph = () => update({ graphMode: showDelta ? 'current' : 'delta' })
  // N분 전 시세가 저장돼 있을 때만 비교한다. 없으면 비교 그래프는 데이터 없음으로 표시한다.
  const beforeTime = useMemo(() => {
    if (!showDelta || !snapshotTime) return null
    const target = minutesBefore(snapshotTime, preferences.beforeMinutes)
    return snapshotTimes.data?.find(time => time.slice(0, 16) === target) ?? null
  }, [showDelta, snapshotTime, snapshotTimes.data, preferences.beforeMinutes])
  // 시각이 없으면 조회를 끈다. 이때 data는 최신 시세 캐시일 수 있어 아래에서 쓰지 않는다.
  const beforeQuotes = useJapanQuotes(beforeTime, beforeTime !== null)
  // 장중 지수 — 하루 보기(기간이 아닌 보기)에서 지금 시각과 N분 전 시각의 닛케이 등락률을 쓴다. 기간 보기는 종가 기준 막대만 쓴다.
  const indexQuotesNow = useJapanIndexQuotes(rangeStart === null && snapshotTime ? snapshotTime.slice(0, 10) : null)
  const indexQuotesBefore = useJapanIndexQuotes(showDelta && beforeTime ? beforeTime.slice(0, 10) : null)
  const indexValue = graphIndexValue({
    showDelta,
    nowRate: rangeStart === null ? intradayRateAt(indexQuotesNow.data, snapshotTime) : null,
    beforeRate: intradayRateAt(indexQuotesBefore.data, beforeTime),
    dailyRate: indexRate,
  })

  const treeOf = (snapshot: typeof quotes.data): HeatmapSectorNode[] =>
    categories.data && classifications.data && names.data && snapshot?.snapshotTime
      ? buildJapanTree(stocks, categories.data, classifications.data, names.data, snapshot.quotes, snapshot.snapshotTime)
      : []
  const chart = useMemo(() => {
    const depth = preferences.groupDepth
    const valueOf = (node: HeatmapSectorNode) => {
      const average = computeSectorAverage(node, NO_EXCLUDED_TIERS)
      return preferences.avgChangeRateUseSimple ? average.simpleAvg : average.weightedAvg
    }
    const entriesOf = (nodes: HeatmapSectorNode[]) => collectAtDepth(nodes, depth, NO_EXCLUDED_SECTORS, NO_EXCLUDED_TIERS, depth < 3)
    const beforeByPath = new Map(entriesOf(beforeTime ? treeOf(beforeQuotes.data) : []).map(({ node, pathKey }) => [pathKey, node]))
    const entries: RankColumnItem[] = []
    for (const { node, pathKey } of entriesOf(treeOf(shownQuotes))) {
      const now = valueOf(node)
      if (now === null) continue
      if (!showDelta) {
        entries.push({ key: pathKey, sectorName: node.sectorName, value: now })
        continue
      }
      const beforeNode = beforeByPath.get(pathKey)
      const before = beforeNode ? valueOf(beforeNode) : null
      if (before !== null) entries.push({ key: pathKey, sectorName: node.sectorName, value: now - before })
    }
    if (indexValue !== null) entries.push({ key: 'market-index:NIKKEI225', sectorName: NIKKEI_LABEL, value: indexValue, isReference: true })
    return buildRankChart(entries)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- treeOf는 아래 값들로만 결과가 정해진다
  }, [categories.data, classifications.data, names.data, shownQuotes, beforeQuotes.data, beforeTime, showDelta, preferences.groupDepth, preferences.avgChangeRateUseSimple, indexValue])

  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), names.refetch(), ...(rangeStart ? [periodQuotes.refetch()] : [])])
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const isLoading = categories.isLoading || classifications.isLoading || names.isLoading || quotes.isLoading || periodQuotes.isLoading || snapshotTimes.isLoading || beforeQuotes.isLoading || indexCloses.isLoading || indexQuotesNow.isLoading || indexQuotesBefore.isLoading
  const isError = categories.isError || classifications.isError || names.isError || quotes.isError || periodQuotes.isError || beforeQuotes.isError
  const session = japanSessionAt(snapshotTime ?? new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).replace(' ', 'T'))
  const shownCount = shownQuotes?.quotes.length ?? 0
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
  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background text-ui-white">
      <NavBar />
      <NavSubBar actions={<NavBarPageActions onRefresh={() => undefined} isRefreshing={false} showRefresh={false} onOpenShare={() => setIsShareOpen(true)} isScreenshotOpen={isShareOpen} isNativeFullscreen={isNativeFullscreen} onToggleFullscreen={handleToggleNativeFullscreen} onToggleSettings={() => setIsSettingsOpen(open => !open)} isSettingsOpen={isSettingsOpen} />} />
      <div ref={rowRef} className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 gap-[4px] overflow-hidden bg-ui-background">
        <div ref={screenshotRef} data-main-area className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
          <Toolbar>
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <ToolbarModeText page="GRAPH" label="NIKKEI 225" />
              <ToolbarChip bare><JapanDatePicker snapshotTime={snapshotTime} liveTime={liveQuotes.data?.snapshotTime ?? null} rangeStart={rangeStart} holidayColor={resolveHeatmapColor(8, colorScale)} onSelect={time => { setRangeStart(null); setSelectedTime(time) }} onSelectRange={(start, end) => { setRangeStart(start); setSelectedTime(end) }} /></ToolbarChip>
              {!rangeStart && (selectedTime === null || selectedTime.slice(0, 10) === liveQuotes.data?.snapshotTime?.slice(0, 10)) && (
                <>
                <ToolbarChip bare><PageRefreshButton cell onRefresh={refetchAll} isRefreshing={quotes.isFetching || categories.isFetching || classifications.isFetching || names.isFetching} helpText={JAPAN_REFRESH_HELP} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}><AnimatedClockLabel snapshotTime={snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} /></PageRefreshButton></ToolbarChip>
                <JapanSessionChip session={session} />
                </>
              )}
            </div>
            <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}><TaxonomyBadge taxonomy="MARKETRY" /></div>
          </Toolbar>
          <div className="relative flex min-h-0 flex-1">
            <div className="flex min-h-0 w-full flex-1 flex-col pt-4 pb-[19.5px]">
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center"><Spinner showElapsed /></div>
              ) : isError ? (
                <div className="flex flex-1 items-center justify-center"><Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={() => { void refetchAll() }} /></div>
              ) : chart.rankedItems.length === 0 ? (
                <div className="relative flex-1"><EmptyMessage message={EMPTY_DATA_MESSAGE} topClass="top-0" /></div>
              ) : (
                <div className="-mb-[19.5px] flex min-h-0 flex-1 flex-col overflow-auto pb-[19.5px]">
                  <div className="mt-[25px] flex w-full shrink-0 items-center justify-center font-bold whitespace-nowrap" style={{ fontSize: 22, color: 'var(--ui-white)' }}>
                    <span className="inline-flex items-center leading-none font-bold">
                      <span>
                        {showDelta ? `${preferences.beforeMinutes}분 전 대비` : preferences.avgChangeRateUseSimple ? '동일 가중 등락률' : '시총 가중 등락률'}{' '}
                        <span className="font-light">({showDelta ? '%p' : '%'})</span>
                      </span>
                      <span className="ml-2.5 rounded bg-[var(--brand-surface)] px-2 py-1 text-sm leading-none font-semibold text-ui-white">{DEPTH_NAMES[preferences.groupDepth - 1]}</span>
                    </span>
                  </div>
                  <p className="mt-1.5 mb-[19.5px] flex w-full shrink-0 items-center justify-center gap-1.5 text-[13px] font-medium leading-5 whitespace-nowrap text-ui-muted">
                    <span aria-hidden="true">-</span>
                    그룹에 포함된 종목이 적을수록 왜곡이 커질 수 있습니다.
                  </p>
                  <div className="flex min-h-[260px] min-w-0 w-full flex-1 pl-[1%] pr-[2%]">
                    <RankColumns chart={chart} highlightColor={strongIndustryColor} colorScale={colorScale} onSelectSector={name => navigate(`/map/japan?sector=${encodeURIComponent(name)}`)} onSelectIndex={() => navigate('/map/japan')} applyAxisBreak />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DisclaimerFooter rightContent={<ChangeRateBar swatches={resolveLegendSwatches(colorScale)} />} />
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Graph" draftKeyMap={JAPAN_GRAPH_DRAFT_KEY_MAP} tabStorageName={JAPAN_SETTINGS_TAB_STORAGE.graph} taxonomyAtBottom taxonomy="MARKETRY" onlyTaxonomy="MARKETRY" onSelectTaxonomy={NO_TAXONOMY_CHANGE} stockCountLabel={`${shownCount}/${stocks.length}종목`} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
            <SettingsPanelGroup section="graph">
              <SettingsGroupDepthSection depth={preferences.groupDepth} onChange={groupDepth => update({ groupDepth })} selectableDepth={3} />
              <SettingsAverageModeSection avgChangeRateUseSimple={preferences.avgChangeRateUseSimple} onChange={avgChangeRateUseSimple => update({ avgChangeRateUseSimple })} enabled={!showDelta} onToggle={toggleGraph} />
              <SettingsBeforeMinutesSection beforeMinutes={preferences.beforeMinutes} onChange={beforeMinutes => update({ beforeMinutes })} enabled={showDelta} onToggle={toggleGraph} />
            </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
    </div>
  )
}
