import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import GraphScreen from '@/components/GraphScreen'
import { useSnapshotColorSettings } from '@/markets/useSnapshotColorSettings'
import { useSnapshotPublishedAt } from '@/markets/useSnapshotPublishedAt'
import { useSnapshotSectorExclusion } from '@/markets/useSnapshotSectorExclusion'
import { useSnapshotSheet } from '@/markets/useSnapshotSheet'
import { useSnapshotTierRange } from '@/markets/useSnapshotTierRange'
import type { MarketIndexBar } from '@/markets/marketContract'
import { snapshotMarketData } from '@/markets/snapshotMarketData'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useMarketIndexQuotes, useMarketQuotes } from '@/markets/useMarketQuotes'
import { snapshotGraphDraftKeyMap, useSnapshotGraphPreferences } from '@/markets/useSnapshotGraphPreferences'
import { useSnapshotMarketSummary } from '@/markets/useSnapshotMarketSummary'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { graphIndexValue, intradayRateAt } from '@/utils/indexChange'
import { marketMenu } from '@/utils/marketMenu'
import { snapshotRoute, type SnapshotMarket } from '@/utils/markets'
import { countVisibleItems } from '@/utils/sectorExclusion'
import { subtractMinutesFromSnapshotTime } from '@/utils/snapshotTime'
import { formatStockCountLabel } from '@/utils/stockCountLabel'

// 종가만 저장되는 시장은 장중 비교를 쓸 수 없다.
const CLOSE_ONLY_LOCK = {
  average: <>종가만 저장되는 시장이라<br />N분 전 대비로 바꿀 수 없습니다.</>,
  before: <>종가만 저장되는 시장이라<br />N분 전 대비를 사용할 수 없습니다.</>,
}

// 스냅샷 시장의 PC GRAPH 데이터를 공통 화면에 넘긴다.
export default function SnapshotGraph({ market }: { market: SnapshotMarket }) {
  const navigate = useNavigate()
  const { index, intradayDelta, graphDepth, sheetMarket, tabStorage } = SNAPSHOT_MARKETS[market]
  const { sheet, canUseMine, selectSheet } = useSnapshotSheet()
  const source = useSnapshotMarketSummary(market, sheet)
  const { tree, treeOf, snapshotTimes, snapshotTime, rangeStart, isLoading, isIndexLoading, isError, fixed, settingPrefix, currencyUnit, totalCount, refetchAll } = source
  const publishedAt = useSnapshotPublishedAt(market, sheet)
  const preferences = useSnapshotGraphPreferences(market, sheet)
  const { beforeMinutes } = preferences
  const tierRange = useSnapshotTierRange(settingPrefix, currencyUnit)
  const sectorExclusion = useSnapshotSectorExclusion(settingPrefix, tree, tierRange.excludedMarketValueTiers, sheet === 'MINE' ? market : null)
  const colorSettings = useSnapshotColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: sheetMarket })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  const showDelta = intradayDelta && rangeStart === null && preferences.graphMode === 'delta'
  // N분 전 시세가 저장돼 있을 때만 비교한다. 없으면 비교 막대가 비어 안내 문구를 보여 준다.
  const beforeTime = useMemo(() => {
    if (!showDelta || !snapshotTime) return null
    const target = subtractMinutesFromSnapshotTime(snapshotTime, beforeMinutes).slice(0, 16)
    return snapshotTimes?.find(time => time.slice(0, 16) === target) ?? null
  }, [showDelta, snapshotTime, snapshotTimes, beforeMinutes])
  const beforeQuotes = useMarketQuotes(market, beforeTime, beforeTime !== null)
  const beforeNodes = useMemo(() => (beforeTime === null ? [] : treeOf(beforeQuotes.data)), [beforeTime, treeOf, beforeQuotes.data])
  // 장중 지수를 저장하는 시장만 지수 막대를 비교한다. 저장하지 않는 시장(미국)은 조회하지 않는다.
  const indexIntraday = showDelta && index.hasIntraday
  const indexNow = useMarketIndexQuotes(market, indexIntraday && snapshotTime ? snapshotTime.slice(0, 10) : null)
  const indexBefore = useMarketIndexQuotes(market, indexIntraday && beforeTime ? beforeTime.slice(0, 10) : null)
  const deltaValue = showDelta ? graphIndexValue({ showDelta: true, nowRate: intradayRateAt(indexNow.data, snapshotTime), beforeRate: intradayRateAt(indexBefore.data, beforeTime), dailyRate: null }) : null
  const deltaIndexBars = useMemo<MarketIndexBar[]>(() => [deltaValue === null ? { key: index.key, name: index.name, value: null, reason: index.hasIntraday ? '비교할 지수 값이 없습니다.' : '장중 지수는 저장하지 않아 비교할 수 없습니다.' } : { key: index.key, name: index.name, value: deltaValue }], [index, deltaValue])
  const shownCount = useMemo(() => countVisibleItems(tree, sectorExclusion.excludedIds, tierRange.excludedMarketValueTiers), [tree, sectorExclusion.excludedIds, tierRange.excludedMarketValueTiers])
  const isAllLoading = isLoading || isIndexLoading || beforeQuotes.isLoading || indexNow.isLoading || indexBefore.isLoading
  const retrySource = { ...source, isError: isError || beforeQuotes.isError, refetchAll: () => Promise.all([refetchAll(), ...(beforeTime === null ? [] : [beforeQuotes.refetch()])]) }
  const marketData = snapshotMarketData(retrySource, sheet, resolveHeatmapColor(8, colorScale), isAllLoading)
  const mapPath = snapshotRoute('/map', market)
  return (
    <GraphScreen
      market={marketData}
      graph={{
        depth: Math.min(preferences.groupDepth, graphDepth), setDepth: preferences.setGroupDepth, selectableDepth: graphDepth,
        useSimpleAverage: preferences.avgChangeRateUseSimple, setUseSimpleAverage: preferences.setAvgChangeRateUseSimple,
        beforeMinutes, setBeforeMinutes: preferences.setBeforeMinutes,
        showDelta, toggleDelta: () => preferences.setGraphMode(showDelta ? 'current' : 'delta'),
        beforeNodes, deltaIndexBars, deltaLock: intradayDelta ? null : CLOSE_ONLY_LOCK,
      }}
      menu={marketMenu('/graph', market, true)}
      taxonomy={sheet}
      filters={{
        valueRange: { ...tierRange, excluded: tierRange.excludedMarketValueTiers },
        sectorExclusion,
      }}
      colors={{ colorScale, strongIndustryColor, legendSwatches, scaleSection: colorSettings.colorSectionProps, strongSection: colorSettings.strongSectionProps }}
      mapPath={mapPath}
      onSelectIndex={() => navigate(mapPath)}
      isCaptureReady={!isAllLoading && !retrySource.isError}
      panel={{ draftKeyMap: sheet === 'MINE' ? snapshotGraphDraftKeyMap(market) : undefined, tabStorageName: tabStorage.graph, onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY'), showPreferenceActions: sheet === 'MINE', stockCountLabel: formatStockCountLabel(shownCount, totalCount) }}
    />
  )
}
