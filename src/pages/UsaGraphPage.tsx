import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import client from '@/api/client'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import NavBar from '@/components/NavBar'
import NavBarPageActions from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import RankColumns, { type RankColumnItem } from '@/components/RankColumns'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsAverageModeSection, SettingsGroupDepthSection, SettingsPanelGroup, type SettingsPanelSectionId } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import Toolbar from '@/components/Toolbar'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarModeText from '@/components/ToolbarModeText'
import UsaDatePicker from '@/components/UsaDatePicker'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useUsaGraphPreferences } from '@/hooks/useUsaGraphPreferences'
import { useUsaIndexCloses } from '@/hooks/useUsaIndexCloses'
import { useUsaQuotes, useUsaSnapshotTimes, useUsaStocks } from '@/hooks/useUsaQuotes'
import { resolveHeatmapColor, resolveLegendSwatches } from '@/utils/heatmapColorScale'
import { indexChangeRate, shiftDate } from '@/utils/indexChange'
import { buildJapanTree, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { buildRankChart } from '@/utils/rankChart'
import { computeSectorAverage } from '@/utils/sectorAverage'
import { collectAtDepth } from '@/utils/sectorDepth'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { NO_TAXONOMY_CHANGE, USA_MAP_FIXED, USA_SETTINGS_TAB_STORAGE } from '@/utils/usaMapSettings'
import { USA_GRAPH_DRAFT_KEY_MAP } from '@/utils/usaGraphSettings'
import type { HeatmapSectorNode } from '@/types/api'

const DEPTH_NAMES = ['섹터', '업종']
const NO_EXCLUDED_SECTORS = new Set<number>()
const NO_EXCLUDED_TIERS = new Set<string>()
const SECTION_ORDER: SettingsPanelSectionId[] = ['graph']
const NO_INDEX_SELECTION = () => {}
const NO_TOGGLE = () => {}
const INDEX_LOOKBACK_DAYS = 14
const INDEX_LABEL = 'S&P 500'
const { colorScale, strongIndustryColor } = USA_MAP_FIXED

// 미국 S&P 500 그래프. 일본 그래프와 같은 구조이고 하루 한 번 저장된 종가로 그린다. 기간 보기·"N분 전 대비"·시계·세션 칩은 없다.
export default function UsaGraphPage() {
  const navigate = useNavigate()
  const categories = useQuery({ queryKey: ['usa', 'categories'], queryFn: async () => (await client.get<JapanCategory[]>('/usa/categories')).data })
  const classifications = useQuery({ queryKey: ['usa', 'classifications'], queryFn: async () => (await client.get<Record<string, JapanClassification>>('/usa/classifications')).data })
  const stocks = useUsaStocks()
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const quotes = useUsaQuotes(selectedTime)
  const liveQuotes = useUsaQuotes()
  const snapshotTimes = useUsaSnapshotTimes()
  const snapshotTime = quotes.data?.snapshotTime ?? null
  const treeStocks = useMemo(() => (stocks.data ?? []).map(stock => ({ code: stock.symbol, name: stock.name })), [stocks.data])
  const names = useMemo(() => Object.fromEntries((stocks.data ?? []).map(stock => [stock.symbol, stock.symbol])), [stocks.data])
  // 지수 막대는 그 거래일 하루의 종가 변동이다. 미국은 저장된 시세가 모두 종가라서 가장 최근 날도 막대를 만든다.
  const day = snapshotTime ? snapshotTime.slice(0, 10) : null
  const indexCloses = useUsaIndexCloses(day ? shiftDate(day, -INDEX_LOOKBACK_DAYS) : null, day)
  const indexRate = day && indexCloses.data ? indexChangeRate(indexCloses.data, day, day) : null
  const { preferences, update } = useUsaGraphPreferences()

  const chart = useMemo(() => {
    const tree: HeatmapSectorNode[] =
      categories.data && classifications.data && stocks.data && quotes.data?.snapshotTime
        ? buildJapanTree(treeStocks, categories.data, classifications.data, names, quotes.data.quotes, quotes.data.snapshotTime)
        : []
    const depth = preferences.groupDepth
    const entries: RankColumnItem[] = []
    for (const { node, pathKey } of collectAtDepth(tree, depth, NO_EXCLUDED_SECTORS, NO_EXCLUDED_TIERS, depth < 2)) {
      const average = computeSectorAverage(node, NO_EXCLUDED_TIERS)
      const value = preferences.avgChangeRateUseSimple ? average.simpleAvg : average.weightedAvg
      if (value !== null) entries.push({ key: pathKey, sectorName: node.sectorName, value })
    }
    if (indexRate !== null) entries.push({ key: 'market-index:SP500', sectorName: INDEX_LABEL, value: indexRate, isReference: true })
    return buildRankChart(entries)
  }, [categories.data, classifications.data, stocks.data, quotes.data, treeStocks, names, preferences.groupDepth, preferences.avgChangeRateUseSimple, indexRate])

  const shownCount = quotes.data?.quotes.length ?? 0
  const refetchAll = () => Promise.all([quotes.refetch(), snapshotTimes.refetch(), categories.refetch(), classifications.refetch(), stocks.refetch()])
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const isLoading = categories.isLoading || classifications.isLoading || stocks.isLoading || quotes.isLoading || snapshotTimes.isLoading || indexCloses.isLoading
  const isError = categories.isError || classifications.isError || stocks.isError || quotes.isError

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
              <ToolbarModeText page="GRAPH" label="S&P 500" />
              <ToolbarChip bare><UsaDatePicker snapshotTime={snapshotTime} liveTime={liveQuotes.data?.snapshotTime ?? null} holidayColor={resolveHeatmapColor(8, colorScale)} onSelect={setSelectedTime} /></ToolbarChip>
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
                        {preferences.avgChangeRateUseSimple ? '동일 가중 등락률' : '시총 가중 등락률'}{' '}
                        <span className="font-light">(%)</span>
                      </span>
                      <span className="ml-2.5 rounded bg-[var(--brand-surface)] px-2 py-1 text-sm leading-none font-semibold text-ui-white">{DEPTH_NAMES[preferences.groupDepth - 1]}</span>
                    </span>
                  </div>
                  <p className="mt-1.5 mb-[19.5px] flex w-full shrink-0 items-center justify-center gap-1.5 text-[13px] font-medium leading-5 whitespace-nowrap text-ui-muted">
                    <span aria-hidden="true">-</span>
                    그룹에 포함된 종목이 적을수록 왜곡이 커질 수 있습니다.
                  </p>
                  <div className="flex min-h-[260px] min-w-0 w-full flex-1 pl-[1%] pr-[2%]">
                    <RankColumns chart={chart} highlightColor={strongIndustryColor} colorScale={colorScale} onSelectSector={name => navigate(`/map/usa?sector=${encodeURIComponent(name)}`)} onSelectIndex={NO_INDEX_SELECTION} applyAxisBreak />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DisclaimerFooter rightContent={<ChangeRateBar swatches={resolveLegendSwatches(colorScale)} />} />
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Graph" draftKeyMap={USA_GRAPH_DRAFT_KEY_MAP} tabStorageName={USA_SETTINGS_TAB_STORAGE.graph} taxonomyAtBottom taxonomy="MARKETRY" onlyTaxonomy="MARKETRY" onSelectTaxonomy={NO_TAXONOMY_CHANGE} stockCountLabel={`${shownCount}/${stocks.data?.length ?? 0}종목`} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={SECTION_ORDER}>
            <SettingsPanelGroup section="graph">
              <SettingsGroupDepthSection depth={preferences.groupDepth} onChange={groupDepth => update({ groupDepth })} selectableDepth={2} />
              <SettingsAverageModeSection avgChangeRateUseSimple={preferences.avgChangeRateUseSimple} onChange={avgChangeRateUseSimple => update({ avgChangeRateUseSimple })} enabled onToggle={NO_TOGGLE} toggleDisabled />
            </SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
    </div>
  )
}
