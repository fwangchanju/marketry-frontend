import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import MapScreen from '@/components/MapScreen'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useIsNarrowScreen } from '@/hooks/useIsNarrowScreen'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { koreaMarketData } from '@/markets/koreaMarketData'
import { useKoreaIndexBars } from '@/markets/useKoreaIndexBars'
import { mapStretchFor, mapTileMethod } from '@/utils/mapStretch'
import { marketMenu } from '@/utils/marketMenu'
import { marketRoute } from '@/utils/marketRoute'
import { collectItems } from '@/utils/sectorAverage'
import { normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'

// 한국 MAP의 데이터와 한국에만 있는 기능을 공통 화면에 넘긴다.
export default function KoreaMap() {
  const isLoggedIn = useIsLoggedIn()
  const settings = useGlobalSettings({ allowChangeRateMode: true })
  const { settingsModalProps, colorEditorPanelProps, market, isCustom, isMarketry, taxonomy, changeRateChoice, data, isLoading, rootNodes, filteredRootNodes, maxDepth, marketValueDepthRange, weightedAvgDepthRange, simpleAvgDepthRange, upDownCountDepthRange, boxSizeMarketCapRatio, onChangeBoxSizeMarketCapRatio, topPickSectorKeys, strongIndustryColor, onChangeStrongIndustryColor, onChangeAvgChangeRateUseSimple, onChangeSectorFilterEnabled, boxLabelMinAreaPercent, stockLabelMode, stockPopupOnHover, setStockPopupOnHover, decimalPlaces, colorScale, handleExcludeSector, excludedSectorIds, excludedMarketValueTiers, stockChangeFilter, onChangeStockChangeFilter, sectorChangeFilter, setSectorChangeFilter, sectorChangeDepth, setSectorChangeDepth, sectorChangeMaxDepth } = settings
  const [searchParams, setSearchParams] = useSearchParams()
  // 지수는 MOBILE의 그룹 등락률 미리보기에만 쓰므로 그때만 받는다.
  const isMobile = useIsNarrowScreen() && searchParams.get('capture') !== 'mobile'
  const index = useKoreaIndexBars(settings, isMobile)
  // 캡처는 MOBILE 화면과 같은 박스 크기(저장값이 없으면 시총 비례)로 찍는다.
  const [storedMobileBoxSizeRatio] = useLocalPersistedState<number>('mobile.boxSizeMarketCapRatio', 100)
  // 스크린샷 URL의 avgMode/sectorFilter를 반영하고, 소비한 쿼리 파라미터를 주소에서 지운다.
  // 옛 스크린샷 URL의 ?market=은 /map·/group 리다이렉트(App.tsx LegacyMarketRedirect)가 이미 경로로 옮겼다.
  // 여기서 지우는 market은 경로가 있는 주소에 붙어 온 값뿐이다 — 마켓은 경로가 정하므로 지우기만 한다.
  useEffect(() => {
    const marketParam = searchParams.get('market')
    const isValidMarket = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK'
    // 백엔드가 스크린샷 URL에 싣는 avgMode=simple|weighted, sectorFilter=true|false 계약에 맞춘다
    // (marketry-backend의 instructions-telegram-average-mode.md 결정 6).
    const avgModeParam = searchParams.get('avgMode')
    const isValidAvgMode = avgModeParam === 'simple' || avgModeParam === 'weighted'
    if (isValidAvgMode) onChangeAvgChangeRateUseSimple(avgModeParam === 'simple')
    const sectorFilterParam = searchParams.get('sectorFilter')
    const isValidSectorFilter = sectorFilterParam === 'true' || sectorFilterParam === 'false'
    if (isValidSectorFilter) onChangeSectorFilterEnabled(sectorFilterParam === 'true')
    if (!isValidMarket && !isValidAvgMode && !isValidSectorFilter) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (isValidMarket) next.delete('market')
        if (isValidAvgMode) next.delete('avgMode')
        if (isValidSectorFilter) next.delete('sectorFilter')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 파라미터가 있을 때만 반응하면 됨
  }, [searchParams])
  const suspendedStockCount = data?.suspendedStockCount ?? 0
  return (
    <MapScreen
      market={koreaMarketData(settings, index.indexBars, isLoading)}
      map={{
        scope: market,
        filteredNodes: filteredRootNodes,
        maxDepth: maxDepth ?? null,
        // 정지로 지도에서 뺀 종목도 더해 전체 종목 수와 맞춘다.
        totalStockCount: rootNodes.reduce((sum, node) => sum + collectItems(node).length, 0) + suspendedStockCount,
        heatmap: { marketValueDepthRange, weightedAvgDepthRange, simpleAvgDepthRange, upDownCountDepthRange, stretch: mapStretchFor(taxonomy), tile: mapTileMethod(), canExclude: isCustom || isMarketry || !isLoggedIn, labelMinAreaPercent: boxLabelMinAreaPercent, stockLabelMode, decimalPlaces, topPickSectorKeys, onExcludeSector: handleExcludeSector },
        boxSizeRatio: boxSizeMarketCapRatio,
        setBoxSizeRatio: onChangeBoxSizeMarketCapRatio,
        captureBoxSizeRatio: normalizeMobileBoxSizeRatio(storedMobileBoxSizeRatio),
        captureSettleKey: `${data?.snapshotTime}|${changeRateChoice}`,
        stockPopupOnHover, setStockPopupOnHover,
        changeFilters: { stockChangeFilter, onChangeStockChangeFilter, sectorChangeFilter, onChangeSectorChangeFilter: setSectorChangeFilter, sectorChangeDepth, onChangeSectorChangeDepth: setSectorChangeDepth, maxSelectableDepth: sectorChangeMaxDepth, noDataLimited: settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT' },
        sectorLevel: settingsModalProps,
        topPick: settingsModalProps,
        isIndexPending: index.isLoading || index.isFetching,
      }}
      menu={marketMenu('/map', market, true)}
      taxonomy={settingsModalProps.taxonomy}
      filters={{
        valueRange: { tiers: settingsModalProps.tiers, minIndex: settingsModalProps.tierRangeMinIndex, maxIndex: settingsModalProps.tierRangeMaxIndex, setRange: settingsModalProps.onChangeTierRange, excluded: excludedMarketValueTiers },
        sectorExclusion: { enabled: settingsModalProps.sectorFilterEnabled, toggle: settingsModalProps.onToggleSectorFilter, excludedIds: excludedSectorIds, rows: settingsModalProps.excludedSectors, remove: settingsModalProps.onRemoveExcludedSector, suspendedStockCount: settingsModalProps.suspendedStockCount },
      }}
      colors={{
        colorScale, strongIndustryColor, legendSwatches: settingsModalProps.legendSwatches,
        scaleSection: { ...settingsModalProps, colorEditorProps: colorEditorPanelProps, fixed: settingsModalProps.taxonomy !== 'MINE' },
        strongSection: { color: strongIndustryColor, onChange: onChangeStrongIndustryColor, fixed: settingsModalProps.taxonomy !== 'MINE' },
      }}
      routes={{ summary: marketRoute('/summary', market), graph: marketRoute('/graph', market) }}
      sheetMarket="korea"
      panel={{ ...settingsModalProps, strongIndustryColor, snapshotTime: data?.taxonomyUpdatedAt }}
    />
  )
}
