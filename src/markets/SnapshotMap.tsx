import { overseasRoute } from '@/utils/markets'
import { useOverseasPublishedAt } from '@/hooks/useOverseasPublishedAt'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { buildExcludedSectorRows } from '@/utils/overseasSectorExclusion'
import { marketMenu } from '@/utils/marketMenu'
import { useMemo } from 'react'
import { useStockPopupOnHover } from '@/hooks/useStockChart'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import { pickTopSectorKeys } from '@/utils/topPickSectors'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import { collectSectorsAtDepth, useFilteredHeatmap } from '@/hooks/useFilteredHeatmap'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { mapTileMethod } from '@/utils/mapStretch'

import MapScreen from '@/components/MapScreen'
import type { MarketMap } from '@/markets/marketContract'
import { snapshotMarketData } from '@/markets/snapshotMarketData'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useSnapshotMapPreferences } from '@/markets/useSnapshotMapPreferences'
import { useSnapshotMarketSummary } from '@/markets/useSnapshotMarketSummary'
import type { OverseasMarket } from '@/utils/markets'

const NO_TOP_PICKS = new Set<string>()
const STOCK_LABEL_MODES = ['off', 'nameOnly', 'rateOnly', 'both'] as const

// 스냅샷 시장의 MAP 데이터를 공통 화면에 넘긴다.
export default function SnapshotMap({ market }: { market: OverseasMarket }) {
  const { mapDepth, mapDraftKeyMap, tabStorage, sheetMarket, fixed } = SNAPSHOT_MARKETS[market]
  const { sheet, canUseMine, selectSheet } = useOverseasSheet()
  const source = useSnapshotMarketSummary(market, sheet, true)
  const { tree, snapshotTime, isLoading, isIndexLoading, isIndexFetching, settingPrefix, currencyUnit, totalCount } = source
  const { preferences, update, isLoadingDefaults } = useSnapshotMapPreferences(market, sheet)
  const publishedAt = useOverseasPublishedAt(market, sheet)
  const tierRange = useOverseasTierRange(settingPrefix, currencyUnit)
  const sectorExclusion = useOverseasSectorExclusion(settingPrefix)
  const colorSettings = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: sheetMarket })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  // 공통 설정 탭의 값은 저장하지 않고 이 화면 메모리에만 둔다(한국 지도와 같다).
  // 시장(일본·미국)과 모드(MARKETRY·내 기준)마다 따로 기억한다. 한국 지도와 같은 방식이다. 종목 정보·종목 차트는 모드·시장과 상관없이 하나로 쓰고, 로그인한 사용자만 이 브라우저에 저장한다.
  const experimentKey = (name: string) => `overseas.experiment.${market}.${sheet}.${name}`
  const [stockChangeFilter, setStockChangeFilter] = useTransientSetting<'all' | 'rising' | 'falling'>(experimentKey('stockChangeFilter'), 'all')
  const [sectorChangeFilter, setSectorChangeFilter] = useTransientSetting<'all' | 'rising' | 'falling'>(experimentKey('sectorChangeFilter'), 'all')
  const [sectorChangeDepth, setSectorChangeDepth] = useTransientSetting(experimentKey('sectorChangeDepth'), 0)
  const [stockPopupOnHover, setStockPopupOnHover] = useStockPopupOnHover(fixed.stockPopupOnHover)
  const directionFilters = useMemo(() => ({ stockChangeFilter, sectorChangeFilter, sectorChangeDepth, sectorUseSimpleAverage: false }), [stockChangeFilter, sectorChangeFilter, sectorChangeDepth])
  const { filteredRootNodes, availableMaxDepth } = useFilteredHeatmap(tree, sectorExclusion.excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, directionFilters)
  // 상위 업종 강조 — 모든 시장이 같은 규칙으로 고른 단계의 업종 중 등락률이 높은 순서로 뽑는다. 필터가 적용된 전체 트리 기준이라 드릴다운해도 바뀌지 않는다.
  const topPickMaxSelectableDepth = preferences.maxDepth === null ? Math.max(mapDepth, availableMaxDepth) : preferences.maxDepth
  const topPickSectorKeys = useMemo(() => {
    if (!preferences.topPickEnabled || preferences.topPickDepth < 0 || preferences.topPickDepth >= topPickMaxSelectableDepth) return NO_TOP_PICKS
    return pickTopSectorKeys(collectSectorsAtDepth(filteredRootNodes, preferences.topPickDepth), preferences.topPickCount, preferences.activeDepthMetric)
  }, [filteredRootNodes, preferences.topPickEnabled, preferences.topPickDepth, preferences.topPickCount, preferences.activeDepthMetric, topPickMaxSelectableDepth])
  const depthRange: [number, number] | null = preferences.depthMetricEnabled ? [preferences.depthMetricMinIndex, preferences.depthMetricMaxIndex] : null
  const metricRange = (metric: typeof preferences.activeDepthMetric) => (preferences.activeDepthMetric === metric ? depthRange : null)
  const topPick: MarketMap['topPick'] = {
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
  const sectorLevel: MarketMap['sectorLevel'] = {
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
  const setBoxSizeRatio = (ratio: number) => update({ boxSizeMarketCapRatio: ratio })
  return (
    <MapScreen
      market={snapshotMarketData(source, sheet, resolveHeatmapColor(8, colorScale), isLoading || isLoadingDefaults)}
      map={{
        scope: market,
        filteredNodes: filteredRootNodes,
        // 업종 단계를 끄면 박스를 묶지 않고 종목만 그린다.
        maxDepth: preferences.sectorLevelEnabled ? preferences.maxDepth : 0,
        totalStockCount: totalCount,
        heatmap: { marketValueDepthRange: metricRange('marketValue'), weightedAvgDepthRange: metricRange('weightedAvgChangeRate'), simpleAvgDepthRange: metricRange('simpleAvgChangeRate'), upDownCountDepthRange: metricRange('upDownCount'), stretch: null, tile: mapTileMethod(), canExclude: true, labelMinAreaPercent: fixed.boxLabelMinAreaPercent, stockLabelMode: preferences.stockLabelEnabled ? STOCK_LABEL_MODES[preferences.stockLabelModeIndex] ?? 'both' : 'off', decimalPlaces: preferences.decimalPlaces, topPickSectorKeys, onExcludeSector: sectorExclusion.exclude },
        boxSizeRatio: preferences.boxSizeMarketCapRatio,
        setBoxSizeRatio,
        captureBoxSizeRatio: preferences.boxSizeMarketCapRatio,
        captureSettleKey: snapshotTime ?? '',
        stockPopupOnHover, setStockPopupOnHover,
        changeFilters: { stockChangeFilter, onChangeStockChangeFilter: setStockChangeFilter, sectorChangeFilter, onChangeSectorChangeFilter: setSectorChangeFilter, sectorChangeDepth, onChangeSectorChangeDepth: setSectorChangeDepth, maxSelectableDepth: availableMaxDepth, noDataLimited: false },
        sectorLevel, topPick,
        isIndexPending: isIndexLoading || isIndexFetching,
      }}
      menu={marketMenu('/map', market, true)}
      taxonomy={sheet}
      filters={{
        valueRange: { ...tierRange, excluded: tierRange.excludedMarketValueTiers },
        sectorExclusion: { enabled: sectorExclusion.enabled, toggle: sectorExclusion.toggle, excludedIds: sectorExclusion.excludedSectorIds, rows: buildExcludedSectorRows(tree, sectorExclusion.ids, tierRange.excludedMarketValueTiers), remove: sectorExclusion.remove, suspendedStockCount: null },
      }}
      colors={{ colorScale, strongIndustryColor, legendSwatches, scaleSection: colorSettings.colorSectionProps, strongSection: colorSettings.strongSectionProps }}
      routes={{ summary: overseasRoute('/summary', market), graph: overseasRoute('/graph', market) }}
      sheetMarket={sheetMarket}
      panel={{ draftKeyMap: sheet === 'MINE' ? mapDraftKeyMap : undefined, tabStorageName: tabStorage.map, onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY'), showPreferenceActions: sheet === 'MINE' }}
    />
  )
}
