import { koreaMarketData } from '@/markets/koreaMarketData'
import { useKoreaIndexBars } from '@/markets/useKoreaIndexBars'
import SummaryScreen from '@/components/SummaryScreen'
import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useKoreaSettings } from '@/markets/useKoreaSettings'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { collectItems } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredHeatmap'
import { marketRoute } from '@/utils/marketRoute'
import { marketMenu } from '@/utils/marketMenu'
import type { MarketQuery } from '@/types/api'

// 서머리 배치
// 한국 SUMMARY의 데이터와 한국에만 있는 기능(코스피·코스닥, 애프터 마켓, 시간대 필터, 거래소 분류)을 공통 화면에 넘긴다.
export default function KoreaSummary() {
  // 시장 배지 드롭다운 — 서머리의 시장(KOREA·JAPAN·USA, 배지에는 K-STOCK·NIKKEI 225·S&P 500)은 주소의 market 값으로 정한다. 일본·미국은 특별 회원·관리자에게만 보인다.
  const location = useLocation()
  const canSeeSnapshotSummary = true
  const summaryMarket: MarketQuery = location.pathname.startsWith('/summary/korea/kospi') ? 'KOSPI' : location.pathname.startsWith('/summary/korea/kosdaq') ? 'KOSDAQ' : 'ALL_STOCK'
  // 지도·그래프와 같은 목록(KOREA 아래 KOSPI·KOSDAQ, 특별 회원·관리자에게만 JAPAN·USA).
  const summaryMenu = marketMenu('/summary', summaryMarket, canSeeSnapshotSummary)
  const navigate = useNavigate()
  const settings = useKoreaSettings({ allowChangeRateMode: true })
  const { excludedIds: excludedSectorIds } = settings.sectorExclusion
  const {
    settingsModalProps, data, rootNodes, isLoading: isBaseLoading, pinnedSnapshotTime, rangeStartTime, 
    changeRateMode, changeRateChoice, colorScale, strongIndustryColor, onChangeStrongIndustryColor, colorEditorPanelProps, excludedMarketValueTiers,
    market, 
  } = settings

  const index = useKoreaIndexBars({ market, pinnedSnapshotTime, rangeStartTime, changeRateMode, changeRateChoice })
  // 지수 막대가 heatmap과 다른 쿼리에서 오므로, 지수까지 준비된 뒤 한 번에 그린다.
  const isLoading = isBaseLoading || index.isLoading
  const handleSelectIndex = (indexMarket: 'KOSPI' | 'KOSDAQ') => navigate(marketRoute('/map', indexMarket))
  // 설정창 위쪽 "nn/nn종목" — 그래프 페이지와 같은 기준이다. 분모는 지금 시장의 모든 종목, 분자는 제외한 업종(하위 업종까지)·시가총액 구간을 뺀 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = rootNodes
    // 분모에는 정지로 지도에서 뺀 종목도 더해 전체 종목 수와 맞춘다.
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0) + (data?.suspendedStockCount ?? 0)
    const included = filterTreeByExclusions(nodes, excludedSectorIds, excludedMarketValueTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return formatStockCountLabel(included, total)
  }, [rootNodes, data, excludedSectorIds, excludedMarketValueTiers])
  const marketData = koreaMarketData(settings, index.indexBars, isLoading)
  return (
    <SummaryScreen
      market={marketData}
      menu={summaryMenu}
      taxonomy={settingsModalProps.taxonomy}
      filters={{
        valueRange: { tiers: settingsModalProps.tiers, minIndex: settingsModalProps.tierRangeMinIndex, maxIndex: settingsModalProps.tierRangeMaxIndex, setRange: settingsModalProps.onChangeTierRange, excluded: excludedMarketValueTiers },
        sectorExclusion: settings.sectorExclusion,
      }}
      colors={{
        colorScale,
        strongIndustryColor,
        legendSwatches: settingsModalProps.legendSwatches,
        scaleSection: { ...settingsModalProps, colorEditorProps: colorEditorPanelProps, fixed: settingsModalProps.taxonomy !== 'MINE' },
        strongSection: { color: strongIndustryColor, onChange: onChangeStrongIndustryColor, fixed: settingsModalProps.taxonomy !== 'MINE' },
      }}
      mapPath={marketRoute('/map', market)}
      onSelectIndex={handleSelectIndex}
      panel={{ tabStorageName: 'Home', ...settingsModalProps, stockCountLabel, snapshotTime: data?.taxonomyUpdatedAt }}
    />
  )
}
