import SummaryScreen from '@/components/SummaryScreen'
import { useMemo } from 'react'
import { useSnapshotPublishedAt } from '@/markets/useSnapshotPublishedAt'
import { useSnapshotSheet } from '@/markets/useSnapshotSheet'
import { useSnapshotColorSettings } from '@/markets/useSnapshotColorSettings'
import { useSnapshotSectorExclusion } from '@/markets/useSnapshotSectorExclusion'
import { countVisibleItems } from '@/utils/sectorExclusion'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { useSnapshotTierRange } from '@/markets/useSnapshotTierRange'
import { marketMenu } from '@/utils/marketMenu'

import type { SettingsPanelSectionId } from '@/components/SettingsPanel'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { snapshotRoute } from '@/utils/markets'

import { snapshotMarketData } from '@/markets/snapshotMarketData'
import { useSnapshotMarketSummary } from '@/markets/useSnapshotMarketSummary'
import type { SnapshotMarket } from '@/utils/markets'

const SECTION_ORDER: SettingsPanelSectionId[] = ['composition', 'colors']

// 스냅샷 시장의 PC SUMMARY 데이터를 공통 화면에 넘긴다.
export default function SnapshotSummary({ market }: { market: SnapshotMarket }) {
  const { sheet, canUseMine, selectSheet } = useSnapshotSheet()
  const source = useSnapshotMarketSummary(market, sheet)
  const { tree, isLoading, isIndexLoading, fixed, tabStorageName, settingPrefix, currencyUnit, totalCount } = source
  const publishedAt = useSnapshotPublishedAt(market, sheet)
  // 시가총액 범위 — 지도·그래프와 같은 저장 값. 업종 요약과 막대, 설정창의 종목 수에 함께 반영한다.
  const tierRange = useSnapshotTierRange(settingPrefix, currencyUnit)
  const sectorExclusion = useSnapshotSectorExclusion(settingPrefix, tree, tierRange.excludedMarketValueTiers, sheet === 'MINE' ? market : null)
  const colorSettings = useSnapshotColorSettings({ isMine: sheet === 'MINE', fixed, participantScope: 'mine' })
  const { colorScale, strongIndustryColor, legendSwatches } = colorSettings
  const shownCount = useMemo(() => countVisibleItems(tree, sectorExclusion.excludedIds, tierRange.excludedMarketValueTiers), [tree, sectorExclusion.excludedIds, tierRange.excludedMarketValueTiers])
  const menu = marketMenu('/summary', market, true)
  const marketData = snapshotMarketData(source, sheet, resolveHeatmapColor(8, colorScale), isLoading || isIndexLoading)
  return (
    <SummaryScreen
      market={marketData}
      menu={menu}
      taxonomy={sheet}
      filters={{
        valueRange: { ...tierRange, excluded: tierRange.excludedMarketValueTiers },
        sectorExclusion,
      }}
      colors={{ colorScale, strongIndustryColor, legendSwatches, scaleSection: colorSettings.colorSectionProps, strongSection: colorSettings.strongSectionProps }}
      mapPath={snapshotRoute('/map', market)}
      onSelectIndex={null}
      panel={{ tabStorageName: tabStorageName, onlyTaxonomy: 'MARKETRY', snapshotTime: publishedAt, alsoTaxonomies: canUseMine ? ['MINE'] : undefined, withoutMiddle: true, onSelectTaxonomy: next => selectSheet(next === 'MINE' ? 'MINE' : 'MARKETRY'), showPreferenceActions: sheet === 'MINE', stockCountLabel: formatStockCountLabel(shownCount, totalCount), sectionOrder: SECTION_ORDER }}
    />
  )
}
