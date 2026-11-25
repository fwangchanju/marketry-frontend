import { useMemo } from 'react'
import MobileMarketScreen from '@/components/MobileMarketScreen'
import { useFilteredHeatmap } from '@/hooks/useFilteredHeatmap'
import { useOverseasColorSettings } from '@/hooks/useOverseasColorSettings'
import { useOverseasSectorExclusion } from '@/hooks/useOverseasSectorExclusion'
import { useOverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasTierRange } from '@/hooks/useOverseasTierRange'
import { snapshotMarketData } from '@/markets/snapshotMarketData'
import { SNAPSHOT_MARKETS } from '@/markets/snapshotMarkets'
import { useSnapshotMarketSummary } from '@/markets/useSnapshotMarketSummary'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { marketMenu } from '@/utils/marketMenu'
import { toDisplayGroup } from '@/utils/mobileMapHeatmap'
import { mapTileMethod } from '@/utils/mapStretch'
import { overseasRoute, type OverseasMarket } from '@/utils/markets'

const FILTERS = { stockChangeFilter: 'all' as const, sectorChangeFilter: 'all' as const, sectorChangeDepth: 0, sectorUseSimpleAverage: false }
const NO_TOP_PICKS = new Set<string>()

// 스냅샷 시장의 MOBILE 업종 지도·그룹 등락률 데이터를 공통 화면에 넘긴다.
export default function SnapshotMobile({ market, mode }: { market: OverseasMarket; mode: 'sector' | 'graph' }) {
  // MOBILE은 PC와 모드 선택이 섞이지 않게 자기 저장 이름을 쓴다(한국과 같다).
  const { sheet } = useOverseasSheet('mobile.taxonomySelection')
  const source = useSnapshotMarketSummary(market, sheet)
  const { tree, isLoading, isIndexLoading, isIndexFetching, fixed, settingPrefix, currencyUnit } = source
  const tierRange = useOverseasTierRange(settingPrefix, currencyUnit)
  const { excludedSectorIds } = useOverseasSectorExclusion(settingPrefix)
  const { colorScale, strongIndustryColor } = useOverseasColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: 'mine' })
  const { filteredRootNodes } = useFilteredHeatmap(tree, excludedSectorIds as Set<number>, tierRange.excludedMarketValueTiers, FILTERS)
  const groups = useMemo(() => filteredRootNodes.map(toDisplayGroup), [filteredRootNodes])
  return (
    <MobileMarketScreen
      mode={mode}
      data={{
        market: snapshotMarketData(source, sheet, resolveHeatmapColor(8, colorScale), isLoading),
        scope: market,
        filteredNodes: filteredRootNodes,
        excludedTiers: tierRange.excludedMarketValueTiers,
        selectableDepth: 3,
        isIndexPending: isIndexLoading || isIndexFetching,
        colors: { colorScale, strongIndustryColor },
        mapPreview: { groups, marketValueDepthRange: null, weightedAvgDepthRange: null, simpleAvgDepthRange: null, upDownCountDepthRange: null, tile: mapTileMethod(), colorScale, labelMinAreaPercent: 2, stockLabelMode: 'both', decimalPlaces: 1, topPickSectorKeys: NO_TOP_PICKS, strongIndustryColor, currencyUnit },
        routes: { summary: overseasRoute('/summary', market), graph: overseasRoute('/graph', market), map: overseasRoute('/map', market) },
        menus: { summary: marketMenu('/summary', market, true), graph: marketMenu('/graph', market, true) },
        sheetMarket: SNAPSHOT_MARKETS[market].sheetMarket,
        chartMarket: SNAPSHOT_MARKETS[market].sheetMarket,
        onSelectIndex: null,
      }}
    />
  )
}
