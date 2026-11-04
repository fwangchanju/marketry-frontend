import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import client from '@/api/client'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import Heatmap from '@/components/Heatmap'
import NavBar from '@/components/NavBar'
import JapanDatePicker from '@/components/JapanDatePicker'
import NavBarPageActions, { PageRefreshButton } from '@/components/NavBarPageActions'
import NavSubBar from '@/components/NavSubBar'
import ScreenshotModal from '@/components/ScreenshotModal'
import SettingsPanel, { SettingsPanelGroup } from '@/components/SettingsPanel'
import Spinner from '@/components/Spinner'
import Toolbar from '@/components/Toolbar'
import { TradingSessionChip } from '@/components/ToolbarControls'
import ToolbarModeText from '@/components/ToolbarModeText'
import { ClockIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import ToolbarChip from '@/components/ToolbarChip'
import stocks from '@/data/japanStocks.json'
import { useFilteredHeatmap, limitDepth, type FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import { useHeatmapColorScale } from '@/hooks/useHeatmapColorScale'
import { useHeatmapDrilldown } from '@/hooks/useHeatmapDrilldown'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { createDefaultColorScale, resolveHeatmapColor, resolveLegendSwatches } from '@/utils/heatmapColorScale'
import { buildJapanTree, type JapanCategory, type JapanClassification } from '@/utils/japanMap'
import { JAPAN_LATEST_SNAPSHOT_TIME, JAPAN_SESSION_GUIDE } from '@/utils/japanMarketCalendar'
import { mapTileMethod } from '@/utils/mapStretch'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'
import { MEMBER_DEFAULTS } from '@/utils/settingDefaults'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'

const REFRESH_HELP = '시세는 고정된 스냅샷이라 바뀌지 않습니다.\n분류와 한글명만 다시 받습니다.'
const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'
const LEVEL_LABELS = ['대분류', '중분류', '소분류']
const NO_EXCLUDED_SECTORS = new Set<number>()
const NO_EXCLUDED_TIERS = new Set<string>()
const NO_TOP_PICKS = new Set<string>()
const NO_DIRECTION_FILTERS = { stockChangeFilter: 'all', sectorChangeFilter: 'all', sectorChangeDepth: 0, sectorUseSimpleAverage: false } as const
const DEPTH_METRIC_RANGE: [number, number] = [MEMBER_DEFAULTS.depthMetricMinIndex, MEMBER_DEFAULTS.depthMetricMaxIndex]

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
  const categories = useQuery({ queryKey: ['admin', 'overseas-classification-categories', 'JAPAN'], queryFn: async () => (await client.get<JapanCategory[]>('/admin/overseas-classification-categories/JAPAN')).data })
  const classifications = useQuery({ queryKey: ['admin', 'overseas-stock-classifications', 'JAPAN'], queryFn: async () => (await client.get<Record<string, JapanClassification>>('/admin/overseas-stock-classifications/JAPAN')).data })
  const names = useQuery({ queryKey: ['admin', 'japan-stock-names'], queryFn: async () => (await client.get<Record<string, string>>('/admin/japan-stock-names')).data })
  const { data: serverColorScale } = useHeatmapColorScale()
  const colorScale = serverColorScale && serverColorScale.thresholds.length > 0 ? serverColorScale : createDefaultColorScale()
  const tree = useMemo(() => (categories.data && classifications.data && names.data ? buildJapanTree(stocks, categories.data, classifications.data, names.data) : []), [categories.data, classifications.data, names.data])
  const { filteredRootNodes } = useFilteredHeatmap(tree, NO_EXCLUDED_SECTORS, NO_EXCLUDED_TIERS, NO_DIRECTION_FILTERS)
  const { path, currentNode, currentSiblings, enterSector, goToDepth } = useHeatmapDrilldown(filteredRootNodes)
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  const [snapshotTime, setSnapshotTime] = useState(JAPAN_LATEST_SNAPSHOT_TIME)
  const refetchAll = () => Promise.all([categories.refetch(), classifications.refetch(), names.refetch()])
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const screenshotRef = useRef<HTMLDivElement>(null)
  const { isOnLeft, toggleSide, rowRef } = useSettingsPanelSide()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  // 국내 지도의 회원 기본값과 같다. 중분류까지 보여 주고, 더 깊이 들어가면 바로 아래 단계를 보여 준다.
  const visibleDepth = Math.max(1, MEMBER_DEFAULTS.maxDepth - path.length)
  const groups: DisplayGroup[] = currentNode
    ? [toDisplayGroup({ ...currentNode, children: limitDepth(currentNode.children, visibleDepth) })]
    : limitDepth(currentSiblings, visibleDepth).map(toDisplayGroup)
  const isLoading = categories.isLoading || classifications.isLoading || names.isLoading
  const isError = categories.isError || classifications.isError || names.isError
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
              <ToolbarChip bare><JapanDatePicker snapshotTime={snapshotTime} holidayColor={resolveHeatmapColor(8, colorScale)} onSelect={setSnapshotTime} /></ToolbarChip>
              <ToolbarChip bare><PageRefreshButton cell onRefresh={refetchAll} isRefreshing={categories.isFetching || classifications.isFetching || names.isFetching} helpText={REFRESH_HELP} minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}><AnimatedClockLabel snapshotTime={snapshotTime} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} /></PageRefreshButton></ToolbarChip>
              <TradingSessionChip session="마켓 종료" guide={JAPAN_SESSION_GUIDE} />
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
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <Heatmap
                  groups={groups}
                  selfSectorName={currentNode?.sectorName ?? null}
                  depth={path.length}
                  onSelectSector={name => { enterSector(name) }}
                  onExcludeSector={() => {}}
                  heightClassName="min-h-0 flex-1"
                  marketValueDepthRange={null}
                  weightedAvgDepthRange={DEPTH_METRIC_RANGE}
                  simpleAvgDepthRange={null}
                  upDownCountDepthRange={null}
                  boxSizeMarketCapRatio={MEMBER_DEFAULTS.boxSizeMarketCapRatio}
                  tile={mapTileMethod()}
                  canExclude={false}
                  colorScale={colorScale}
                  labelMinAreaPercent={MEMBER_DEFAULTS.boxLabelMinAreaPercent}
                  stockLabelMode="both"
                  stockPopupOnHover={MEMBER_DEFAULTS.stockPopupOnHover}
                  decimalPlaces={MEMBER_DEFAULTS.decimalPlacesIndex}
                  topPickSectorKeys={NO_TOP_PICKS}
                  strongIndustryColor={MEMBER_DEFAULTS.strongIndustryColor}
                  zoomOutRequestDepth={zoomOutRequestDepth}
                  onZoomOutComplete={depth => { goToDepth(depth); setZoomOutRequestDepth(null) }}
                  currencyUnit="엔"
                />
              </div>
            )}
            <DisclaimerFooter rightContent={<ChangeRateBar swatches={resolveLegendSwatches(colorScale)} />} />
          </div>
        </div>
        <div className={`flex shrink-0 pt-[4px] ${isOnLeft ? 'order-first' : ''}`}>
          <SettingsPanel pageLabel="Map" stockCountLabel={`${stocks.length}/${stocks.length}종목`} showPreferenceActions={false} isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} isOnLeft={isOnLeft} onToggleSide={toggleSide} sectionOrder={['custom']}>
            <SettingsPanelGroup section="custom"><div className="settings-empty-message"><span className="text-center">읽기 전용<br /><span className="text-ui-muted">데이터: Yahoo Finance 스냅샷</span></span></div></SettingsPanelGroup>
          </SettingsPanel>
        </div>
      </div>
      {isShareOpen && <ScreenshotModal onClose={() => setIsShareOpen(false)} onCopy={copy} copyLabel={copyLabel} isCopying={copyStatus === 'copying'} screenshotTarget={screenshotRef.current} />}
    </div>
  )
}
