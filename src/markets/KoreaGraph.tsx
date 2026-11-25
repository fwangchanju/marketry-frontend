import GraphScreen from '@/components/GraphScreen'
import { koreaMarketData } from '@/markets/koreaMarketData'
import type { MarketIndexBar, MarketScreenData } from '@/markets/marketContract'
import { useKoreaIndexBars } from '@/markets/useKoreaIndexBars'
import { marketMenu } from '@/utils/marketMenu'
import { useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSectorHeatmapPair } from '@/hooks/useSectorHeatmapPair'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import { usePageSetting } from '@/hooks/usePageSetting'
import { profileSettingKey } from '@/utils/settingsSchema'
import { collectItems } from '@/utils/sectorAverage'
import { collectAllItems, filterTreeByExclusions } from '@/hooks/useFilteredHeatmap'
import { formatStockCountLabel } from '@/utils/stockCountLabel'
import { marketRoute } from '@/utils/marketRoute'
import type { Market } from '@/types/api'

type GraphViewMode = 'current' | 'delta'
const INDEX_NAMES: Record<Market, string> = { KOSPI: '코스피', KOSDAQ: '코스닥' }

// 한국 PC GRAPH의 데이터와 한국에만 있는 기능을 공통 화면에 넘긴다.
export default function KoreaGraph() {
  const navigate = useNavigate()
  const [beforeMinutes, setBeforeMinutes] = useTransientSetting('sectorChangeRate.beforeMinutes', 15)
  const [searchParams, setSearchParams] = useSearchParams()
  const settings = useGlobalSettings({ allowChangeRateMode: true })
  const { settingsModalProps, strongIndustryColor, onChangeStrongIndustryColor, colorEditorPanelProps, avgChangeRateUseSimple, onChangeAvgChangeRateUseSimple, market, source, nxtOnly, changeRateMode, data, rangeStartTime, isLoading: isBaseLoading, isError, isHeatmapSuccess, isMarketValueTierRangeReady, isRefetchingHeatmap, onChangeSectorFilterEnabled, excludedMarketValueTiers, excludedSectorIds, colorScale, settingsProfile } = settings
  const [graphMode, setGraphMode] = usePageSetting<GraphViewMode>(profileSettingKey(settingsProfile, 'groupPage.graphMode'), 'current')
  // 막대 하나가 가리키는 업종 분류 깊이(1=대분류, 2=중분류, 3=소분류). 하위 단계가 없는 분류(거래소)는 대분류만 고를 수 있다.
  const [groupDepth, setGroupDepth] = usePageSetting<number>(profileSettingKey(settingsProfile, 'groupPage.depth'), 1)
  const selectableDepth = settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT' ? 1 : 3
  // 기간 등락률을 보는 중이면 "N분 전 대비"는 쓰지 않는다 — before를 받지 않고, 지금 값(data)이 곧 기간 등락률이다.
  const isRangeView = rangeStartTime !== undefined
  const showDelta = !isRangeView && graphMode === 'delta'
  // before는 now.snapshotTime에서 계산한 시각을 쌍으로 묶어 조회한다(marketry-backend 지시서 결정 4) — 재조회로 now가 새 tick으로
  // 바뀌는 순간에도 새 now와 옛 before를 섞어 그리지 않는다.
  const pairQuery = useSectorHeatmapPair(market, source, nxtOnly, beforeMinutes, data, changeRateMode, !isRangeView)
  // 쌍 쿼리가 에러(재시도 1회 뒤)면 "before 없음"으로 보고 now 쿼리의 현재 data로 그린다.
  const displayNow = isRangeView ? data : (pairQuery.data?.now ?? (pairQuery.isError ? data : undefined))
  const displayBefore = isRangeView ? null : (pairQuery.data?.before ?? null)
  const isPairSettled = isRangeView || pairQuery.isSuccess || pairQuery.isError
  const periodIndex = useKoreaIndexBars(settings)
  // data-capture-ready(결정 4) — now가 성공했고 비어 있으면(그 시각 데이터가 아예 없음) 그대로
  // "데이터가 없습니다" 화면을 스크린샷으로 찍는다. 그 외에는 쌍 쿼리까지 끝나 있고(성공 또는 에러), placeholder가
  // 아니고, 시가총액 구간 설정이 준비된 뒤에야 스크린샷을 허용한다 — now 에러는 항상 false다.
  const isDataCaptureReady =
    isHeatmapSuccess &&
    (data?.snapshotTime == null ||
      (isPairSettled && !pairQuery.isPlaceholderData && isMarketValueTierRangeReady))
  // 렌더러가 /sector/kosdaq?beforeMinutes=15&avgMode=simple&sectorFilter=true로
  // 스크린샷을 요청할 때 쓰는 진입점 — MapScreen와 동일한 패턴(초기 상태 반영 용도일 뿐 주소창엔
  // 남길 필요 없어 반영 직후 지움). market은 useGlobalSettings()가 내부에서 이미 우선 반영했으므로
  // 여기서는 나머지 세 파라미터만 다룬다. 셋은 서로 독립적으로 판정한다 — 하나가 없거나 잘못됐다고
  // 다른 것까지 무시하면 안 된다. 실제로 소비한(유효했던) 파라미터만 주소에서 지운다.
  useEffect(() => {
    // 양의 정수가 아니면 무시하고 기존 값을 쓴다. 데이터가 5분 간격으로만 존재해서(수집 주기) 5의
    // 배수가 아닌 값은 애초에 조회가 불가능하다 — 여기서도 같은 조건으로 걸러낸다.
    const beforeMinutesParam = searchParams.get('beforeMinutes')
    const parsedBeforeMinutes = beforeMinutesParam === null ? NaN : Number(beforeMinutesParam)
    const isValidBeforeMinutes = Number.isInteger(parsedBeforeMinutes) && parsedBeforeMinutes > 0 && parsedBeforeMinutes % 5 === 0
    if (isValidBeforeMinutes) setBeforeMinutes(parsedBeforeMinutes)

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

    if (!isValidMarket && !isValidBeforeMinutes && !isValidAvgMode && !isValidSectorFilter) return
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        if (isValidMarket) next.delete('market')
        if (isValidBeforeMinutes) next.delete('beforeMinutes')
        if (isValidAvgMode) next.delete('avgMode')
        if (isValidSectorFilter) next.delete('sectorFilter')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 파라미터가 있을 때만 반응하면 됨
  }, [searchParams])
  // 설정창 위쪽 "nn/nn종목" — 분모는 지금 시장의 모든 종목, 분자는 지도 설정창과 같은 기준(제외한 업종은 하위 업종까지,
  // 제외한 시가총액 구간)으로 걸러 남은 종목이다.
  const stockCountLabel = useMemo(() => {
    const nodes = displayNow?.items ?? []
    // 분모에는 정지로 지도에서 뺀 종목도 더해 전체 종목 수와 맞춘다.
    const total = nodes.reduce((sum, node) => sum + collectItems(node).length, 0) + (displayNow?.suspendedStockCount ?? 0)
    const included = filterTreeByExclusions(nodes, excludedSectorIds, excludedMarketValueTiers).reduce(
      (sum, node) => sum + collectAllItems(node).length,
      0,
    )
    return formatStockCountLabel(included, total)
  }, [displayNow, excludedSectorIds, excludedMarketValueTiers])

  // 기간은 날짜별 지수로, 하루는 업종과 같은 시각의 지수로 만든다.
  const { indexBars, deltaIndexBars } = useMemo(() => {
    const markets: Market[] = market === 'ALL_STOCK' ? ['KOSPI', 'KOSDAQ'] : [market]
    const pairs = changeRateMode !== 'daily' ? [] : displayNow?.marketOverview
      ? [{ now: displayNow.marketOverview, before: displayBefore?.marketOverview ?? null }]
      : (pairQuery.data?.marketIndexes ?? [])
    const barOf = (id: Market, value: number | undefined): MarketIndexBar => value === undefined
      ? { key: `market-index:${id}`, name: INDEX_NAMES[id], value: null, reason: '이 보기의 지수 값이 없습니다.' }
      : { key: `market-index:${id}`, name: INDEX_NAMES[id], value }
    const pairOf = (id: Market) => pairs.find(pair => pair.now.market === id)
    const current = isRangeView ? periodIndex.indexBars : markets.map(id => barOf(id, pairOf(id)?.now.changeRate)) as MarketScreenData['indexBars']
    const delta = markets.map(id => {
      const pair = pairOf(id)
      return barOf(id, pair?.before ? pair.now.changeRate - pair.before.changeRate : undefined)
    })
    return { indexBars: current, deltaIndexBars: delta }
  }, [market, changeRateMode, displayNow, displayBefore, pairQuery.data?.marketIndexes, isRangeView, periodIndex.indexBars])
  // 자료가 있는데 쌍이 아직 안 왔으면 짝이 안 맞는 반쪽 화면을 그리지 않고 기다린다.
  const isLoading = isBaseLoading || (isRangeView && periodIndex.isLoading) || (!isError && data?.snapshotTime != null && !displayNow)
  const marketData = koreaMarketData({ ...settings, data: displayNow, rootNodes: displayNow?.items ?? [], isRefetchingHeatmap: isRefetchingHeatmap || pairQuery.isFetching }, indexBars, isLoading)
  return (
    <GraphScreen
      market={marketData}
      graph={{
        depth: Math.min(groupDepth, selectableDepth), setDepth: setGroupDepth, selectableDepth,
        useSimpleAverage: avgChangeRateUseSimple, setUseSimpleAverage: onChangeAvgChangeRateUseSimple,
        beforeMinutes, setBeforeMinutes,
        showDelta, toggleDelta: () => setGraphMode(showDelta ? 'current' : 'delta'),
        beforeNodes: displayBefore?.items ?? [], deltaIndexBars, deltaLock: null,
      }}
      menu={marketMenu('/graph', market, true)}
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
      mapPath={marketRoute('/map', market)}
      onSelectIndex={index => { if (index === 'KOSPI' || index === 'KOSDAQ') navigate(marketRoute('/map', index)) }}
      isCaptureReady={isDataCaptureReady}
      panel={{ ...settingsModalProps, stockCountLabel, snapshotTime: data?.taxonomyUpdatedAt }}
    />
  )
}
