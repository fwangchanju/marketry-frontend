import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import MobileMarketScreen from '@/components/MobileMarketScreen'
import { limitDepth } from '@/hooks/useFilteredHeatmap'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { koreaMarketData } from '@/markets/koreaMarketData'
import { useKoreaIndexBars } from '@/markets/useKoreaIndexBars'
import { marketMenu } from '@/utils/marketMenu'
import { marketRoute } from '@/utils/marketRoute'
import { toDisplayGroup } from '@/utils/mobileMapHeatmap'
import { mapStretchFor, mapTileMethod } from '@/utils/mapStretch'
import { isInDepthRange } from '@/utils/sectorDepth'

// 한국 MOBILE 업종 지도·그룹 등락률의 데이터를 공통 화면에 넘긴다.
export default function KoreaMobile({ mode }: { mode: 'sector' | 'graph' }) {
  const navigate = useNavigate()
  const settings = useGlobalSettings({ allowChangeRateMode: true, defaultTaxonomy: 'MARKETRY', taxonomyStorageKey: 'mobile.taxonomySelection' })
  const { market, taxonomy, isLoading, filteredRootNodes, maxDepth, excludedMarketValueTiers, colorScale, strongIndustryColor, marketValueDepthRange, weightedAvgDepthRange, simpleAvgDepthRange, upDownCountDepthRange, topPickSectorKeys, boxLabelMinAreaPercent, stockLabelMode } = settings
  const index = useKoreaIndexBars(settings)
  // 종목 지도(/map)가 최상위에서 쓰는 것과 같은 트리·단계 제한을 쓴다.
  const groups = useMemo(() => (maxDepth != null && maxDepth > 0 ? limitDepth(filteredRootNodes, maxDepth) : filteredRootNodes).map(toDisplayGroup), [filteredRootNodes, maxDepth])
  return (
    <MobileMarketScreen
      mode={mode}
      data={{
        market: koreaMarketData(settings, index.indexBars, isLoading),
        scope: market,
        filteredNodes: filteredRootNodes,
        excludedTiers: excludedMarketValueTiers,
        // MARKETRY·내 기준은 대·중·소분류, 거래소는 1단계.
        selectableDepth: taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : 3,
        isIndexPending: index.isLoading || index.isFetching,
        colors: { colorScale, strongIndustryColor },
        mapPreview: {
          groups, marketValueDepthRange, weightedAvgDepthRange, simpleAvgDepthRange, upDownCountDepthRange, stretch: mapStretchFor(taxonomy), tile: mapTileMethod(), colorScale, labelMinAreaPercent: boxLabelMinAreaPercent, stockLabelMode, decimalPlaces: 1, topPickSectorKeys, strongIndustryColor,
          // 도착 화면(MapPage)의 MOBILE과 같은 행 지표를 써야 전환 뒤 첫 행이 바뀌지 않는다.
          captureRowMetric: isInDepthRange(simpleAvgDepthRange, 0) && !isInDepthRange(weightedAvgDepthRange, 0) ? 'simpleAvgChangeRate' : 'weightedAvgChangeRate',
        },
        routes: { summary: marketRoute('/summary', market), graph: marketRoute('/graph', market), map: marketRoute('/map', market) },
        menus: { summary: marketMenu('/summary', market, true), graph: marketMenu('/graph', market, true) },
        sheetMarket: 'korea',
        chartMarket: 'korea',
        onSelectIndex: key => navigate(marketRoute('/graph', key === 'market-index:KOSPI' ? 'KOSPI' : 'KOSDAQ'), { replace: true }),
      }}
    />
  )
}
