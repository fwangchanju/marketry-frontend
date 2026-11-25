import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useStockPopupOnHover } from '@/hooks/useStockChart'
import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTaxonomySelection, type TaxonomySelection } from '@/hooks/useTaxonomySelection'
import { hasMineSheetRequest, mineSheetReturnPath, withoutSheetParam } from '@/utils/mineSheetReturn'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import type { TaxonomySource, TaxonomyKey } from '@/utils/taxonomyNames'
import type { ChangeRateChoice } from '@/api/heatmap'
import { useTransientSetting } from '@/hooks/useTransientSetting'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useRouteAwareMarket } from '@/hooks/useRouteAwareMarket'
import { useIsLoggedIn, useSession } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useColorScaleSettings } from '@/hooks/useColorScaleSettings'
import {
  useFilteredHeatmap,
  type StockChangeFilter,
  type SectorChangeFilter,
} from '@/hooks/useFilteredHeatmap'
import { useMarketValueTierRange } from '@/hooks/useMarketValueTierRange'
import { isTelegramMapCapture, useTelegramCaptureSetting } from '@/hooks/useTelegramImageSetting'
import { profileSettingKey, type SettingsProfile } from '@/utils/settingsSchema'
import { useCustomPreferences } from '@/hooks/useCustomPreferences'
import { useDefaultPreferences } from '@/hooks/useDefaultPreferences'
import type { DepthMetric, StockLabelMode } from '@/utils/heatmapTypes'
import { useKoreaQuotes } from '@/markets/useKoreaQuotes'
import { useKoreaSectorExclusionStore } from '@/markets/useKoreaSectorExclusionStore'
import { useSectorExclusion } from '@/hooks/useSectorExclusion'
import { useTopPickSectorKeys } from '@/hooks/useTopPickSectorKeys'

type StoredDepthMetric = DepthMetric | 'avgChangeRate' | [number, number] | null
const DEPTH_METRICS: DepthMetric[] = ['weightedAvgChangeRate', 'simpleAvgChangeRate', 'upDownCount', 'marketValue']

function resolveDepthMetric(stored: StoredDepthMetric): DepthMetric {
  // 예전에는 박스 크기 옵션과 등락률 평균 방식이 연결돼 있었다. 이전 저장값은
  // 독립 선택으로 전환하면서 동일 가중을 고정 기본값으로 사용해 더 이상 박스 크기를 따르지 않는다.
  if (Array.isArray(stored)) {
    if (stored[0] === 0 && stored[1] === 1) return 'simpleAvgChangeRate'
    return DEPTH_METRICS[stored[0]] ?? 'simpleAvgChangeRate'
  }
  return stored === 'avgChangeRate' || stored === null ? 'simpleAvgChangeRate' : stored
}

const STOCK_LABEL_MODES: StockLabelMode[] = ['off', 'nameOnly', 'rateOnly', 'both']

// "설정" 사이드바(SettingsPanel) + 색상 구간 편집 패널이 필요로 하는 상태/로직 전부를
// 여기 한 곳에 모아둔다 — 세션스토리지 키를 그대로 공유해서 어느 페이지에서 열어도 같은 값을 보고
// 편집한다(지도/섹터 페이지뿐 아니라 아직 이 옵션이 실제로 영향 안 주는 페이지에서 열어도 동일).
// 페이지별로 서로 다른 옵션을 보여줘야 할 필요가 생기면 그때 이 훅을 쪼개면 된다.
//
// needsTree: 이 페이지가 실제로 트리 데이터(useHeatmap)를 화면에 그리는 데 쓰는지. 지도/섹터처럼
// 트리를 직접 렌더링하는 페이지는 true(기본값)로 항상 조회하고, 어드민/요약처럼 설정 사이드바를 통해서만
// 간접적으로 필요한 페이지는 false를 넘겨서 사이드바를 열기 전까지 조회 자체를 미룬다 — 그래도 설정을
// 열면 그 순간부터는 조회하므로(그리고 지도/섹터를 먼저 봤다면 react-query 캐시로 즉시 뜨므로) 설정
// 내용 자체는 어느 페이지에서 열든 동일하게 보인다.


export function useKoreaSettings(options?: { needsTree?: boolean; allowChangeRateMode?: boolean; defaultTaxonomy?: TaxonomySelection; taxonomyStorageKey?: string; readOnlyTelegramSnapshot?: boolean }) {
  const isTelegramCapture = isTelegramMapCapture()
  const telegramCaptureSetting = useTelegramCaptureSetting()
  const needsTree = options?.needsTree ?? true
  // 등락률 기준(누적/시간외) 선택은 지도 페이지만 쓴다. 그래프 페이지는 now·before 쌍을 따로 받아 누적 기준으로 그리므로
  // 같은 값을 실으면 화면이 섞인다.
  const allowChangeRateMode = options?.allowChangeRateMode ?? false
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const isLoggedIn = useIsLoggedIn()
  const { isLoading: isSessionLoading } = useSession()
  // 설정 기본값은 utils/settingDefaults.ts에 모아 두었다(비로그인과 회원이 다르다). 사용자가 값을 바꾸면 저장값이 우선한다.
  const defaults = settingDefaultsFor(isLoggedIn)
  const { requireLogin } = useLoginGate()
  const { isLoaded: preferencesLoaded } = useCustomPreferences()
  const defaultPreferences = useDefaultPreferences()
  // 트리 조회 마켓은 경로를 따른다 — /map, /sector 둘 다 경로 세그먼트가 곧 마켓이라 여기서 바로
  // 우선순위(쿼리 > 경로 > 저장값 > 기본값)를 적용하면, 이 훅을 그대로 쓰는 지도 페이지는 물론
  // 트리 조회만 공유하는 섹터 페이지도 같은 마켓으로 트리를 받는다(docs/instructions-route-market-first-render.md 결정 2).
  const [routeMarket] = useRouteAwareMarket('heatmap.market', 'ALL_STOCK')
  const market = options?.readOnlyTelegramSnapshot ? 'ALL_STOCK' : routeMarket
  // 기존 계정 설정은 브라우저 선택이 없을 때만 기본값으로 사용한다. 새 선택은 세 페이지가 localStorage로 공유한다.
  const [savedIsCustom] = usePageSetting('heatmap.isCustom', defaults.isCustom)
  const [storedTaxonomy, setSelectedTaxonomy] = useTaxonomySelection(options?.defaultTaxonomy ?? (savedIsCustom ? 'MARKETRY' : 'KRX'), options?.taxonomyStorageKey)
  // 로그인 팝업이 돌려보낸 주소의 sheet=MINE — 공용 선택을 쓰는 화면에서만 받는다. 첫 화면부터 내 기준을 요청하도록 저장값보다 먼저 본다.
  const requestsMineSheet = !options?.taxonomyStorageKey && !options?.readOnlyTelegramSnapshot && hasMineSheetRequest(search)
  const selectedTaxonomy = requestsMineSheet ? 'MINE' : storedTaxonomy
  // 내 분류(mine)는 로그인이 필요하다 — 로그아웃 상태에서는 처음 화면인 MARKETRY로 보이고, 브라우저에 저장한 선택 자체는 보존한다.
  // MARKETRY는 올린 분류라 로그인 없이 읽는다(읽기 전용).
  const source: TaxonomySource = isTelegramCapture || options?.readOnlyTelegramSnapshot ? 'MARKETRY' : selectedTaxonomy === 'MINE' && !isLoggedIn ? 'MARKETRY' : selectedTaxonomy
  // 새로고침 직후에는 로그인 여부를 아직 모른다. 내 분류를 골라 둔 사람이 그 사이에 다른 분류 지도를 받았다가 바뀌지 않도록,
  // 로그인 확인이 끝날 때까지는 지도를 요청하지 않고 로딩으로 둔다.
  const isWaitingForSession = selectedTaxonomy === 'MINE' && isSessionLoading
  // isCustom: 본인 데이터로 만든 내 분류(편집·서버 저장이 되는 분류). isMarketry: 올린 MARKETRY. 둘 다 대·중·소분류 트리를 쓴다.
  const isCustom = source === 'MINE'
  const isMarketry = source === 'MARKETRY'
  const usesCustomTree = isCustom || isMarketry
  const settingsProfile: SettingsProfile = isTelegramCapture || options?.readOnlyTelegramSnapshot
    ? 'marketry'
    : isCustom ? 'mine' : isMarketry ? 'marketry' : 'exchange'
  const profileDefaults = settingDefaultsFor(isLoggedIn, settingsProfile)
  const profileKey = (key: string) => profileSettingKey(settingsProfile, key)
  const quotes = useKoreaQuotes({ market, source, isLoggedIn, isMarketry, isWaitingForSession, needsTree, allowChangeRateMode, readOnly: options?.readOnlyTelegramSnapshot ?? false })
  const { nxtOnly, nxtOnlyWindow, isAfterHoursControlsVisible, isAfterHoursSelectable, changeRateMode, changeRateChoice, setStoredChangeRateChoice, isCloseDaysError, refetchCloseDays, pinnedSnapshotTime, rangeStartTime, liveSnapshotTime, onChangePinnedSnapshotTime, onSelectRange, rangeExcludedStocks, data, rootNodes, isHeatmapLoading, isCloseWaiting, isError, isHeatmapSuccess, refetchHeatmap, isRefetchingHeatmap } = quotes
  // 섹터 랭킹/강세 업종 계산에 쓰는 평균 방식은 박스 크기 비율과 별도로 저장한다.
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting(profileKey('heatmap.avgChangeRateUseSimple'), profileDefaults.avgChangeRateUseSimple)
  // 0은 동일 크기, 100은 시가총액 비례이며 중간값은 시가총액 차이를 거듭제곱으로 압축한다.
  const [storedBoxSizeMarketCapRatio, setBoxSizeMarketCapRatio] = usePageSetting(profileKey('heatmap.boxSizeMarketCapRatio'), profileDefaults.boxSizeMarketCapRatio)
  // 등락률 색상·강조 색상 설정은 한국·일본·미국이 같은 훅을 쓴다(useColorScaleSettings).
  const {
    strongIndustryColor,
    setStrongIndustryColor,
    colorScaleDraft,
    colorCustomOn,
    onChangeColorCustomOn: handleChangeColorCustomOn,
    onSelectColorSwatch: handleSelectColorSwatch,
    onResetColorScale: handleResetColorScale,
    isResettingColorScale: isApplyingColorEdit,
    legendSwatches,
    colorScale,
    colorEditorPanelProps,
  } = useColorScaleSettings({ settingsProfile, isTelegramCapture })
  const boxSizeMarketCapRatio = Math.max(0, Math.min(100, Math.round(storedBoxSizeMarketCapRatio)))
  const [storedDepthMetric, setStoredDepthMetric] = usePageSetting<StoredDepthMetric>(
    profileKey('heatmap.activeDepthMetric'),
    profileDefaults.depthMetric,
  )
  const selectedDepthMetric = resolveDepthMetric(storedDepthMetric)
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(
    profileKey('heatmap.depthMetricEnabled'),
    storedDepthMetric !== null,
  )
  // 분류별 데이터 깊이에 맞춰 화면에 적용하되, 사용자가 고른 범위는 전환해도 보존한다.
  // 기본값: 대분류~중분류(index 0~1) — 렌더러가 스크린샷으로 찍는 기본 화면에 등락률이 보이도록.
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting(profileKey('heatmap.depthMetricMinIndex'), profileDefaults.depthMetricMinIndex)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting(profileKey('heatmap.depthMetricMaxIndex'), profileDefaults.depthMetricMaxIndex)
  // avgChangeRateUseSimple은 섹터 랭킹에 사용한다. 강세 업종은 업종 탭 표시 지표를 따른다.
  // 종목 박스가 전체 히트맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다(섹터 헤더와는 무관).
  // 공통 설정 탭의 3-3 텍스트 표시 기준은 저장하지 않는다(새로고침하면 기본값).
  // 텍스트 표시 기준(박스 안 글자를 보여 주는 최소 넓이 비중)은 설정창에서 바꾸지 않고 기본값으로 고정한다.
  const boxLabelMinAreaPercent = profileDefaults.boxLabelMinAreaPercent
  // 종목 박스에 이름만/등락률만/둘 다/끄기 중 뭘 보여줄지 — 기본은 둘 다(기존 동작 유지, 배열 앞에
  // "끄기"가 추가되면서 both의 인덱스가 2에서 3으로 밀림).
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting(profileKey('heatmap.stockLabelModeIndex'), profileDefaults.stockLabelModeIndex)
  // 기존 저장값 0(끄기)도 유지하며, 켜고 끄는 동안 선택한 표기 방식은 보존한다.
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting(profileKey('heatmap.stockLabelEnabled'), stockLabelModeIndex !== 0)
  const selectedStockLabelModeIndex = stockLabelModeIndex || 3
  const stockLabelMode = stockLabelEnabled ? STOCK_LABEL_MODES[selectedStockLabelModeIndex] : 'off'
  // 지도 페이지에 표시되는 모든 등락률(%)의 소수점 자릿수 — 인덱스가 그대로 자릿수(0=정수, 1=소수
  // 1자리, 2=소수 2자리). 기본값 1(소수 1자리).
  const [decimalPlacesIndex, setDecimalPlacesIndex] = usePageSetting(profileKey('heatmap.decimalPlacesIndex'), profileDefaults.decimalPlacesIndex)
  // 종목 박스 설명 팝업을 여는 방식 — false=우클릭(기존 동작), true=커서를 박스 위로 옮길 때. 섹터(대/중/소분류)
  // 팝업은 이 설정과 무관하게 항상 우클릭이다.
  const [stockPopupOnHover, setStockPopupOnHover] = useStockPopupOnHover(profileDefaults.stockPopupOnHover)
  const decimalPlaces = decimalPlacesIndex
  // 시가총액 구간 범위는 같은 분류의 지도와 섹터 랭킹이 공유한다.
  const {
    tiers: valueTiers,
    minIndex: tierRangeMinIndex,
    maxIndex: tierRangeMaxIndex,
    setMinIndex: setTierRangeMinIndex,
    setMaxIndex: setTierRangeMaxIndex,
    excludedMarketValueTiers,
    isTierRangeReady: isMarketValueTierRangeReady,
  } = useMarketValueTierRange(true, settingsProfile)
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = usePageSetting(profileKey('heatmap.sectorFilterEnabled'), profileDefaults.sectorFilterEnabled)
  const [stockChangeFilter, setStockChangeFilter] = useTransientSetting<StockChangeFilter>(profileKey('heatmap.stockChangeFilter'), profileDefaults.stockChangeFilter)
  // 공통 설정 탭의 업종 등락 방향·깊이는 저장하지 않는다(새로고침하면 기본값).
  const [storedSectorChangeFilter, setSectorChangeFilter] = useTransientSetting<SectorChangeFilter>(profileKey('heatmap.sectorChangeFilter'), profileDefaults.sectorChangeFilter)
  const sectorChangeFilter: SectorChangeFilter = storedSectorChangeFilter === 'rising' || storedSectorChangeFilter === 'falling' ? storedSectorChangeFilter : 'all'
  const [storedSectorChangeDepth, setSectorChangeDepth] = useTransientSetting(profileKey('heatmap.sectorChangeDepth'), profileDefaults.sectorChangeDepth)
  const sectorChangeDepth = Number.isInteger(storedSectorChangeDepth) && storedSectorChangeDepth >= 0 ? storedSectorChangeDepth : 0
  // null = 제한 없음(전체 뎁스 표시). 슬라이더의 실제 상한(availableMaxDepth)은 트리 계산 후에 나온다.
  // 기본값 2(렌더러 스크린샷 기준 화면에 맞춤).
  const [selectedMaxDepth, setMaxDepth] = usePageSetting<number | null>(profileKey('heatmap.selectedMaxDepth'), profileDefaults.maxDepth)
  const [sectorLevelEnabled, setSectorLevelEnabled] = usePageSetting(profileKey('heatmap.sectorLevelEnabled'), profileDefaults.sectorLevelEnabled)
  const maxDepth = sectorLevelEnabled ? selectedMaxDepth : 0
  // 선호 업종 — 선택한 절대 depth에서 등락률 상위 N개 섹터를 지도 전체에 강조한다.
  const [topPickDepth, setTopPickDepth] = usePageSetting(profileKey('heatmap.topPickDepth'), profileDefaults.topPickDepth)
  const [topPickCount, setTopPickCount] = usePageSetting(profileKey('heatmap.topPickCount'), profileDefaults.topPickCount)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting(profileKey('heatmap.topPickEnabled'), topPickCount !== 0)
  const selectedTopPickCount = topPickCount || 2
  // 설정 사이드바 열림 상태. 이 브라우저에 저장해 페이지를 옮기거나 새로고침해도 마지막 상태를 유지한다.
  const [isSettingsOpen, setIsSettingsOpen] = useLocalPersistedState('settings-panel-open', true)
  const taxonomy: TaxonomyKey = isMarketry ? 'MARKETRY' : isCustom ? 'MINE' : nxtOnly ? 'NXT' : 'KRX'
  const exclusionStore = useKoreaSectorExclusionStore({ data, rootNodes, isCustom, isMarketry, usesCustomTree, isLoggedIn, isHeatmapSuccess, readOnly: options?.readOnlyTelegramSnapshot ?? false, isTelegramCapture, sectorFilterEnabled })
  const excludedCountsReady = Boolean(data) && !isError && !isHeatmapLoading && !isWaitingForSession && !isCloseWaiting && isMarketValueTierRangeReady
  const sectorExclusion = useSectorExclusion({
    tree: rootNodes,
    store: exclusionStore,
    enabled: sectorFilterEnabled,
    toggle: () => setSectorFilterEnabled(prev => !prev),
    valueExclusions: excludedMarketValueTiers,
    countsReady: excludedCountsReady,
    // 지도·평균에서 항상 빼는 정지 종목 수 — 설정창의 업종 제외 목록에 고정 항목으로 보여 준다.
    suspendedStockCount: data?.suspendedStockCount ?? 0,
  })
  const excludedSectorIds = exclusionStore.excludedIds

  // 거래소(KRX·NXT) 분류는 대분류(0)만 있다. 1-2 업종 등락 방향의 단계도 저장값은 두고 여기서만 따라간다.
  // 업종 등락 방향의 업종 단계는 지금 그려지는 업종 단계(2-1 업종 분류 깊이)를 넘을 수 없다. 거래소 분류는 대분류만 있고, 업종 단계를 끄면 대분류만 그려진다.
  // 저장된 값은 건드리지 않고 여기서만 따라간다(깊이를 다시 늘리면 원래 값이 살아난다). 설정창에 보이는 선택값과 실제로 적용되는 값이 같아야 한다.
  const sectorChangeMaxDepth = Math.max(1, usesCustomTree ? (maxDepth ?? 3) : 1)
  const effectiveSectorChangeDepth = Math.min(sectorChangeDepth, sectorChangeMaxDepth - 1)
  const directionFilters = useMemo(() => ({
    stockChangeFilter: pathname.startsWith('/map/') ? stockChangeFilter : 'all' as StockChangeFilter,
    sectorChangeFilter: pathname.startsWith('/map/') ? sectorChangeFilter : 'all' as SectorChangeFilter,
    sectorChangeDepth: effectiveSectorChangeDepth,
    sectorUseSimpleAverage: selectedDepthMetric === 'simpleAvgChangeRate',
  }), [pathname, stockChangeFilter, sectorChangeFilter, effectiveSectorChangeDepth, selectedDepthMetric])

  const { filteredRootNodes, availableMaxDepth } = useFilteredHeatmap(
    rootNodes,
    excludedSectorIds,
    excludedMarketValueTiers,
    directionFilters,
  )

  // KRX 트리는 대분류까지만 있을 수 있으므로, 선택 범위 중 실제 존재하는 단계만 표시한다.
  // MARKETRY는 기존처럼 선택 범위의 끝이 트리보다 깊으면 지표를 표시하지 않는다.
  const depthMetricClampedMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxIndex)
  const depthMetricClampedMaxIndex = depthMetricMaxIndex
  const visibleDepthMetricMaxIndex = usesCustomTree
    ? depthMetricClampedMaxIndex
    : Math.min(depthMetricClampedMaxIndex, availableMaxDepth - 1)
  const isDepthMetricRangeValid = usesCustomTree
    ? depthMetricClampedMaxIndex < availableMaxDepth
    : depthMetricClampedMinIndex < availableMaxDepth

  const activeDepthRange: [number, number] | null =
    depthMetricEnabled && isDepthMetricRangeValid
      ? [depthMetricClampedMinIndex, visibleDepthMetricMaxIndex]
      : null

  const weightedAvgDepthRange = selectedDepthMetric === 'weightedAvgChangeRate' ? activeDepthRange : null
  const simpleAvgDepthRange = selectedDepthMetric === 'simpleAvgChangeRate' ? activeDepthRange : null
  const upDownCountDepthRange = selectedDepthMetric === 'upDownCount' ? activeDepthRange : null
  const marketValueDepthRange = selectedDepthMetric === 'marketValue' ? activeDepthRange : null

  // 선호 업종 라디오의 활성 상한은 업종 단계 설정을 따른다. 대/중/소분류 설정은 데이터가 얕아도
  // 미리 선택할 수 있게 두고, 현재 데이터에 해당 섹터가 없으면 강조 대상만 빈 Set으로 둔다.
  // 거래소(KRX·NXT) 분류는 대분류만 있어서, MARKETRY에서 중·소분류로 골라 둔 값은 저장은 그대로 두고
  // 여기서만 대분류로 따라간다(2-1 업종 분류 깊이와 같은 한계). MARKETRY로 돌아오면 원래 값이 살아난다.
  const taxonomyMaxDepth = usesCustomTree ? null : 1
  const topPickMaxSelectableDepth = Math.min(
    maxDepth === null ? Math.max(3, availableMaxDepth) : maxDepth,
    taxonomyMaxDepth ?? Number.POSITIVE_INFINITY,
  )
  const effectiveTopPickDepth = taxonomyMaxDepth === null ? topPickDepth : Math.min(topPickDepth, taxonomyMaxDepth - 1)
  const topPickSectorKeys = useTopPickSectorKeys({ nodes: filteredRootNodes, enabled: topPickEnabled, depth: effectiveTopPickDepth, maxDepth: topPickMaxSelectableDepth, count: selectedTopPickCount, metric: selectedDepthMetric })

  // Mode 선택(MARKETRY / 거래소 / 내 분류). 내 분류만 로그인이 필요하다. 거래소는 KRX·NXT를 합친 한 칸이고, 시간대에 따라
  // NXT 거래 종목만 남길지 자동으로 정한다(taxonomy 값은 그 결과로 'KRX' 또는 'NXT'가 된다).
  // 비로그인이 내 분류를 누르면 로그인 안내만 띄우고, 보던 분류(MARKETRY 또는 거래소)에 그대로 머문다.
  // 새로고침 직후처럼 로그인 여부를 아직 모르는 동안은 안내를 띄우지 않고 선택만 받는다.
  // 로그인에 성공하면 돌아온 주소의 sheet=MINE으로 내 기준을 저장한다. 팝업을 닫거나 로그인에 실패하면 선택은 그대로다.
  const handleSelectTaxonomy = (next: TaxonomyKey) => {
    if (next === 'MINE' && !isLoggedIn && !isSessionLoading) {
      requireLogin(mineSheetReturnPath(pathname, search, hash))
      return
    }
    setSelectedTaxonomy(next === 'MARKETRY' || next === 'MINE' ? next : 'KRX')
  }
  const handleToggleCustom = () => handleSelectTaxonomy(isCustom ? 'KRX' : 'MINE')
  // 로그인 여부가 정해진 뒤 sheet=MINE을 처리하고 주소에서 지운다. 비로그인이면 선택을 바꾸지 않는다.
  useEffect(() => {
    if (!requestsMineSheet || isSessionLoading) return
    if (isLoggedIn) setSelectedTaxonomy('MINE')
    navigate({ pathname, search: withoutSheetParam(search), hash }, { replace: true })
  }, [requestsMineSheet, isSessionLoading, isLoggedIn, setSelectedTaxonomy, navigate, pathname, search, hash])

  const handleChangeActiveDepthMetric = (metric: DepthMetric) => setStoredDepthMetric(metric)

  const handleToggleDepthMetric = () => setDepthMetricEnabled(prev => !prev)

  const handleChangeMaxDepth = (nextMaxDepth: number) => {
    setMaxDepth(nextMaxDepth)
    // 지표 범위는 그대로 보존한다. 표시 가능한 상한을 넘는 부분은 설정 UI에서만 잠시 비활성화하고,
    // 업종 단계을 다시 높이면 원래 선택 범위가 그대로 돌아온다.
  }

  const handleChangeDepthMetricRange = (min: number, max: number) => {
    setDepthMetricMinIndex(min)
    setDepthMetricMaxIndex(max)
  }

  const settingsModalProps = {
    isCustom,
    strongIndustryColor,
    onToggleCustom: handleToggleCustom,
    taxonomy,
    onSelectTaxonomy: handleSelectTaxonomy,
    maxDepth: selectedMaxDepth,
    sectorLevelEnabled,
    onToggleSectorLevel: () => setSectorLevelEnabled(prev => !prev),
    availableMaxDepth,
    onChangeMaxDepth: handleChangeMaxDepth,
    activeDepthMetric: selectedDepthMetric,
    onChangeActiveDepthMetric: handleChangeActiveDepthMetric,
    depthMetricEnabled,
    onToggleDepthMetric: handleToggleDepthMetric,
    depthMetricMinIndex: depthMetricClampedMinIndex,
    depthMetricMaxIndex: depthMetricClampedMaxIndex,
    onChangeDepthMetricRange: handleChangeDepthMetricRange,
    topPickDepth: effectiveTopPickDepth,
    topPickCount: selectedTopPickCount,
    topPickEnabled,
    onToggleTopPick: () => setTopPickEnabled(prev => !prev),
    topPickMaxSelectableDepth,
    onChangeTopPickDepth: setTopPickDepth,
    onChangeTopPickCount: setTopPickCount,
    avgChangeRateUseSimple,
    onToggleAvgChangeRateUseSimple: () => setAvgChangeRateUseSimple(prev => !prev),
    stockLabelModeIndex: selectedStockLabelModeIndex,
    stockLabelEnabled,
    onToggleStockLabel: () => setStockLabelEnabled(prev => !prev),
    onChangeStockLabelModeIndex: setStockLabelModeIndex,
    decimalPlacesIndex,
    onChangeDecimalPlacesIndex: setDecimalPlacesIndex,
    stockPopupOnHover,
    onChangeStockPopupOnHover: setStockPopupOnHover,
    tiers: valueTiers,
    tierRangeMinIndex: tierRangeMinIndex === -1 ? 0 : tierRangeMinIndex,
    tierRangeMaxIndex: tierRangeMaxIndex === -1 ? Math.max(valueTiers.length - 1, 0) : tierRangeMaxIndex,
    onChangeTierRange: (min: number, max: number) => {
      setTierRangeMinIndex(min)
      setTierRangeMaxIndex(max)
    },
    colorScaleDraft,
    colorCustomOn,
    onChangeColorCustomOn: handleChangeColorCustomOn,
    onSelectColorSwatch: handleSelectColorSwatch,
    onResetColorScale: handleResetColorScale,
    isResettingColorScale: isApplyingColorEdit,
    legendSwatches,
    isOpen: isSettingsOpen,
    onOpenChange: setIsSettingsOpen,
  }

  return {
    settingsModalProps,
    telegramImageValues: {
      preferences: {
        'heatmap.tierRangeMinValue': valueTiers[tierRangeMinIndex]?.thresholdValue ?? 0,
        'heatmap.tierRangeMaxValue': valueTiers[tierRangeMaxIndex + 1]?.thresholdValue ?? null,
        'heatmap.sectorFilterEnabled': sectorFilterEnabled,
        'heatmap.sectorLevelEnabled': sectorLevelEnabled,
        'heatmap.selectedMaxDepth': selectedMaxDepth,
        'heatmap.activeDepthMetric': storedDepthMetric,
        'heatmap.depthMetricEnabled': depthMetricEnabled,
        'heatmap.depthMetricMinIndex': depthMetricMinIndex,
        'heatmap.depthMetricMaxIndex': depthMetricMaxIndex,
        'heatmap.boxSizeMarketCapRatio': boxSizeMarketCapRatio,
        'heatmap.stockLabelModeIndex': stockLabelModeIndex,
        'heatmap.stockLabelEnabled': stockLabelEnabled,
        'heatmap.decimalPlacesIndex': decimalPlacesIndex,
        'heatmap.strongIndustryColor': strongIndustryColor,
        'heatmap.topPickDepth': topPickDepth,
        'heatmap.topPickCount': topPickCount,
        'heatmap.topPickEnabled': topPickEnabled,
      },
      excludedSectors: exclusionStore.snapshotExcludedSectors,
    },
    colorEditorPanelProps,
    // 지도 페이지가 히트맵을 실제로 그리는 데 직접 필요한 값들.
    market,
    source,
    isCustom,
    isMarketry,
    nxtOnly,
    nxtOnlyWindow,
    changeRateMode,
    changeRateChoice,
    isAfterHoursControlsVisible,
    isAfterHoursSelectable,
    // 종가 시각 목록 조회가 실패해 누적으로 보이는 중에는 저장된 선택이 이미 종가라 값이 안 바뀌므로, 종가 버튼이 다시 조회한다.
    onChangeChangeRateMode: (choice: ChangeRateChoice) => {
      setStoredChangeRateChoice(choice)
      if (choice === 'close' && isCloseDaysError) void refetchCloseDays()
    },
    taxonomy,
    data,
    pinnedSnapshotTime,
    liveSnapshotTime,
    onChangePinnedSnapshotTime,
    onSelectRange,
    rangeStartTime,
    rangeExcludedStocks,
    refetchHeatmap,
    isRefetchingHeatmap,
    isLoading: isHeatmapLoading || isWaitingForSession || isCloseWaiting || (!defaultPreferences.isSuccess && !defaultPreferences.isError) || (isLoggedIn && !preferencesLoaded) || (isTelegramCapture && (telegramCaptureSetting.isPending || isSessionLoading || !isMarketValueTierRangeReady)),
    // 관리 기본값 조회가 실패하면 코드 기본값으로 지도를 그린다. 공개 기본값 API 장애가
    // 지도 전체 오류 화면으로 번지지 않게 하고, 로딩 중에는 위에서만 잠시 대기한다.
    isError: isError || (isTelegramCapture && telegramCaptureSetting.isError),
    isHeatmapSuccess,
    isMarketValueTierRangeReady,
    rootNodes,
    filteredRootNodes,
    stockChangeFilter,
    onChangeStockChangeFilter: setStockChangeFilter,
    sectorChangeFilter,
    sectorChangeDepth: effectiveSectorChangeDepth,
    setSectorChangeFilter,
    setSectorChangeDepth,
    sectorChangeMaxDepth,
    availableMaxDepth,
    // 선택한 업종 단계는 KRX와 MARKETRY 분류에 동일하게 적용한다.
    maxDepth,
    marketValueDepthRange,
    weightedAvgDepthRange,
    simpleAvgDepthRange,
    upDownCountDepthRange,
    avgChangeRateUseSimple,
    boxSizeMarketCapRatio,
    strongIndustryColor,
    onChangeStrongIndustryColor: setStrongIndustryColor,
    onChangeBoxSizeMarketCapRatio: (value: number) => setBoxSizeMarketCapRatio(Math.max(0, Math.min(100, Math.round(value)))),
    topPickSectorKeys,
    // URL 쿼리(avgMode/sectorFilter)로 값을 직접 세팅해야 하는 페이지용 — 토글(prev => !prev)과 달리
    // 원하는 값을 그대로 넘겨 세팅한다.
    onChangeAvgChangeRateUseSimple: setAvgChangeRateUseSimple,
    excludedMarketValueTiers,
    boxLabelMinAreaPercent,
    stockLabelMode,
    decimalPlaces,
    stockPopupOnHover,
    setStockPopupOnHover,
    colorScale,
    sectorExclusion,
    excludedSectorNames: exclusionStore.names,
    onChangeSectorFilterEnabled: setSectorFilterEnabled,
    // 화면별 설정(그래프 페이지 등)도 지금 분류 기준으로 따로 저장하도록 내보낸다.
    settingsProfile,
  }
}
