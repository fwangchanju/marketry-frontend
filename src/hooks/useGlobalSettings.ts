import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { useStockPopupOnHover } from '@/hooks/useStockChart'
import { compareKoreanText } from '@/utils/koreanSort'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTaxonomySelection, type TaxonomySelection } from './useTaxonomySelection'
import { hasMineSheetRequest, mineSheetReturnPath, withoutSheetParam } from '@/utils/mineSheetReturn'
import { settingDefaultsFor } from '@/utils/settingDefaults'
import type { TaxonomySource, TaxonomyKey } from '@/utils/taxonomyNames'
import { useNxtOnlyWindow } from '@/hooks/useNxtOnlyWindow'
import { useAfterHoursControlsVisible } from '@/hooks/useTradingSession'
import { isAfterHoursSelectable as isAfterHoursSelectableAt } from '@/utils/tradingWindow'
import type { ChangeRateChoice, ChangeRateMode } from '@/api/heatmap'
import { useTransientSetting } from './useTransientSetting'
import { usePageSetting } from './usePageSetting'
import { useRouteAwareMarket } from './useRouteAwareMarket'
import { useIsLoggedIn, useSession } from './useSession'
import { useLoginGate } from './useLoginGate'
import { useHeatmap, usePriceAdjustments, useSnapshotDays, usePreviousTradingDay } from './useHeatmap'
import { useSnapshotSelection } from './useSnapshotSelection'
import { useSnapshotTimeOnOrBefore } from './useSnapshotDayLookup'
import { useColorScaleSettings } from './useColorScaleSettings'
import {
  collectSectorsAtDepth,
  useFilteredHeatmap,
  type StockChangeFilter,
  type SectorChangeFilter,
} from './useFilteredHeatmap'
import { useMarketValueTierRange } from './useMarketValueTierRange'
import { registerExcludedSector, unregisterExcludedSector } from '@/api/heatmap'
import { collectExcludedSectorCounts } from '@/utils/excludedSectorCounts'
import { isTelegramMapCapture, useTelegramCaptureSetting } from '@/hooks/useTelegramImageSetting'
import { notifySettingsChanged } from '@/utils/settingsDraft'
import { readBrowserSetting, writeBrowserSetting } from '@/utils/browserProfileSettings'
import { withStableSectorIds } from '@/utils/guestSectorIds'
import type { HeatmapResponse, HeatmapSectorNode } from '@/types/api'
import { profileSettingKey, type SettingsProfile } from '@/utils/settingsSchema'
import { useCustomPreferences } from './useCustomPreferences'
import { useDefaultPreferences } from './useDefaultPreferences'
import { buildRangeChangeRateTree } from '@/utils/rangeChangeRate'
import { excludedNamesForPaths } from '@/utils/excludedSectorPaths'
import { pickTopSectorKeys } from '@/utils/topPickSectors'

const NO_RANGE_ADJUSTMENTS: Readonly<Record<string, number>> = {}

// 내 기준 제외 목록을 서버 값으로 채운 상태를 화면 메모리에만 기억한다. 새로고침하면 다시 채운다.
let lastSeededExclusionKey: string | null = null

export type DepthMetric = 'weightedAvgChangeRate' | 'simpleAvgChangeRate' | 'upDownCount' | 'marketValue'
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

// 히트맵 종목 박스에 이름/등락률 중 뭘 보여줄지 — 슬라이더 인덱스로 저장(0~3). off는 둘 다 안 보여준다.
export type StockLabelMode = 'off' | 'nameOnly' | 'rateOnly' | 'both'
const STOCK_LABEL_MODES: StockLabelMode[] = ['off', 'nameOnly', 'rateOnly', 'both']
// 내 기준 제외 목록의 기본값. 매 렌더 새 Map을 넘기면 useTransientSetting 스냅샷이 계속 바뀌어 무한 렌더가 된다.
const EMPTY_MINE_EXCLUSIONS = new Map<number, string>()

// sectorId -> "상위 - 하위" 형태의 전체 경로. "이 섹터가 제외 목록에 있는지"만 관리하고,
// 실제로 화면에서 걸러낼지는 별도의 sectorFilterEnabled 마스터 스위치가 결정한다.
function seedExcludedSectorNames(
  nodes: HeatmapSectorNode[],
  ancestors: string[] = [],
  out: Map<number, string> = new Map(),
) {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.isExcluded) out.set(node.sectorId, path.join(' > '))
    seedExcludedSectorNames(node.children, path, out)
  }
  return out
}

function seedExcludedSectorKeys(nodes: HeatmapSectorNode[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.isExcluded && node.stableKey) out.push(node.stableKey)
    seedExcludedSectorKeys(node.children, out)
  }
  return out
}

function excludedNamesForStableKeys(nodes: HeatmapSectorNode[], keys: string[]): Map<number, string> {
  const selected = new Set(keys)
  const result = new Map<number, string>()
  const walk = (items: HeatmapSectorNode[], ancestors: string[] = []) => {
    for (const node of items) {
      const path = [...ancestors, node.sectorName]
      if (node.stableKey && selected.has(node.stableKey)) result.set(node.sectorId, path.join(' > '))
      walk(node.children, path)
    }
  }
  walk(nodes)
  return result
}

function stableKeyForSectorId(nodes: HeatmapSectorNode[], sectorId: number): string | null {
  for (const node of nodes) {
    if (node.sectorId === sectorId) return node.stableKey ?? null
    const key = stableKeyForSectorId(node.children, sectorId)
    if (key) return key
  }
  return null
}

// 우클릭 제외 시점엔 리프 섹터명만 알고 있으므로, 뎁스가 있으면(최상위가 아니면) 원본 트리에서
// 조상 경로를 다시 찾아 "상위 - 하위" 형태로 만든다. 최상위면 경로 길이가 1이라 그대로 리프명만 나온다.
function findSectorPath(nodes: HeatmapSectorNode[], targetId: number, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.sectorId === targetId) return path
    const found = findSectorPath(node.children, targetId, path)
    if (found) return found
  }
  return null
}


// 상위 업종도 같이 제외된 업종의 id — 이 업종의 종목은 상위 업종 줄의 종목 수에 이미 들어 있어서 목록에서 흐리게 보여 준다.
function collectCoveredExcludedIds(nodes: HeatmapSectorNode[], excluded: Map<number, string>, covered = false, out: Set<number> = new Set()) {
  for (const node of nodes) {
    const isExcluded = excluded.has(node.sectorId)
    if (isExcluded && covered) out.add(node.sectorId)
    collectCoveredExcludedIds(node.children, excluded, covered || isExcluded, out)
  }
  return out
}

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
// 제외 업종 목록을 서버 기본값으로 마지막에 채운 분류 — 화면 메모리에만 둔다.

function withPriceLabels(nodes: HeatmapSectorNode[], labels: { base: string; end: string }): HeatmapSectorNode[] {
  return nodes.map(node => ({
    ...node,
    items: node.items.map(item => ({ ...item, rangeLabels: labels })),
    children: withPriceLabels(node.children, labels),
  }))
}

export function useGlobalSettings(options?: { needsTree?: boolean; allowChangeRateMode?: boolean; defaultTaxonomy?: TaxonomySelection; taxonomyStorageKey?: string; readOnlyTelegramSnapshot?: boolean }) {
  const isTelegramCapture = isTelegramMapCapture()
  const telegramCaptureSetting = useTelegramCaptureSetting()
  const needsTree = options?.needsTree ?? true
  // 등락률 기준(누적/시간외) 선택은 지도 페이지만 쓴다. 그래프 페이지는 now·before 쌍을 따로 받아 누적 기준으로 그리므로
  // 같은 값을 실으면 화면이 섞인다.
  const allowChangeRateMode = options?.allowChangeRateMode ?? false
  const { pathname, search, hash } = useLocation()
  const navigate = useNavigate()
  const isLoggedIn = useIsLoggedIn()
  const { data: session, isLoading: isSessionLoading } = useSession()
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
  // NXT 종목만 보기 — 어느 분류(거래소/MARKETRY)이든 오늘의 시간표가 정한 필터 구간에만
  // 분류는 그대로 두고 NXT 거래 종목만 남기고, 그 밖의 시간에는 전체 종목을 보여준다. 사용자가 직접 켜고 끄지 않는다.
  const nxtOnlyWindow = useNxtOnlyWindow()
  // 등락률 기준은 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지 선택한다.
  // 표시 시간대가 아니거나 시간외 스냅샷이 아직 없으면 저장한 선택과 무관하게 누적으로 보인다.
  const [afterHoursStart, setAfterHoursStart] = useState<string | null>(null)
  const isAfterHoursControlsVisible = useAfterHoursControlsVisible(afterHoursStart)
  const [storedChangeRateChoice, setStoredChangeRateChoice] = useTransientSetting<ChangeRateChoice>('heatmap.changeRateMode', 'daily')
  // 렌더러(텔레그램 발송)가 ?capture=mobile&basis=close|afterHours 로 열면 저장된 선택과 표시 시간대에 상관없이 그 기준으로 그린다(15:30~15:40은 종가, 15:40 이후는 별도).
  // 렌더러는 저장된 선택이 없는 새 브라우저라 주소로 정해 주지 않으면 늘 누적으로 보인다.
  const captureBasis = useMemo<ChangeRateChoice | null>(() => {
    const params = new URLSearchParams(window.location.search)
    const basis = params.get('basis')
    return params.get('capture') === 'mobile' && (basis === 'close' || basis === 'afterHours') ? basis : null
  }, [])
  const requestedChoice: ChangeRateChoice = allowChangeRateMode && captureBasis !== null
    ? captureBasis
    : allowChangeRateMode && isAfterHoursControlsVisible ? storedChangeRateChoice : 'daily'
  const requestedBasis: ChangeRateMode = requestedChoice === 'afterHours' ? 'afterHours' : 'daily'
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
  const [mineExcludedSectorNames, setMineExcludedSectorNames] = useTransientSetting<Map<number, string>>(
    'heatmap.excludedSectorNames.mine', EMPTY_MINE_EXCLUSIONS,
  )
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
  // 새로 받아온 (market, source) 조합의 데이터가 처음 도착했을 때만 서버 isExcluded로 시드하고,
  // 그 뒤 60초 백그라운드 재조회가 로컬에서 방금 토글한 상태를 덮어쓰지 않게 한다(fire-and-forget 저장이라
  // 서버 반영 전에 재조회가 먼저 도착할 수 있음).

  // 달력에서 지난 날짜를 골랐을 때의 종가 스냅샷 시각 — 없으면 실시간(최신). 시장(코스피·코스닥·전체)을 바꿔도 선택은 풀리지 않는다.
  // 고른 시장의 시각을 그대로 기억해 두고, 다른 시장으로 바뀌면 그 시장의 종가 지도 목록에서 같은 날짜의 시각을 다시 찾는다.
  // 선택은 지도·그룹이 함께 쓰는 저장소에 둔다(그룹에서 업종을 눌러 지도로 가도 풀리지 않게).
  const { pinned: pinnedSelection, range: rangeSelection, liveSnapshotTime, setSelection, setLiveSnapshotTime } = useSnapshotSelection()
  // 기간 등락률 — 달력에서 시작일~종료일을 골랐을 때의 시작일 종가 스냅샷 시각. 종료일은 위 pinnedSelection이 그대로 맡는다(종료일 종가 지도).
  // 날짜 하나를 고르거나 실시간으로 돌아가면 풀린다.
  const onChangePinnedSnapshotTime = (snapshotTime: string | null) => {
    setSelection(snapshotTime === null ? null : { market, snapshotTime }, null)
  }
  const onSelectRange = (startSnapshotTime: string, endSnapshotTime: string) => {
    setSelection({ market, snapshotTime: endSnapshotTime }, { market, snapshotTime: startSnapshotTime })
  }
  // 고른 시장이 아닌 시장을 보는 중이면 그 시장의 같은 날짜 시각을 목록에서 찾는다. 목록을 받기 전이거나 그 날짜가 없으면 고른 시각을 그대로 쓴다.
  // 다른 시장(일본·미국)에서 고른 날짜는 이 시장의 같은 날짜, 없으면 이전 거래일 종가로 옮긴다. 목록을 받기 전에는 정해지지 않은 것으로 본다.
  const pinnedNeedsLookup = pinnedSelection !== null && pinnedSelection.market !== market
  const pinnedLookedUp = useSnapshotTimeOnOrBefore(market, pinnedNeedsLookup ? pinnedSelection.snapshotTime.slice(0, 10) : null, pinnedNeedsLookup)
  const pinnedSnapshotTime = pinnedSelection === null
    ? undefined
    : (pinnedNeedsLookup ? pinnedLookedUp : pinnedSelection.snapshotTime)
  const rangeNeedsLookup = rangeSelection !== null && rangeSelection.market !== market
  const rangeLookedUp = useSnapshotTimeOnOrBefore(market, rangeNeedsLookup ? rangeSelection.snapshotTime.slice(0, 10) : null, rangeNeedsLookup)
  const rangeStartTime = rangeSelection === null || pinnedSnapshotTime === undefined
    ? undefined
    : (rangeNeedsLookup ? rangeLookedUp : rangeSelection.snapshotTime)
  // NXT는 별도 거래소/설정 프로필이 아니라 특정 시간대에만 적용하는 종목 필터다.
  // NXT 종목만 보기는 실시간 지도에만 쓴다 — 그 시간대(15:40~16:00 등)에도 종가·지난 날짜·기간은 그날의 전종목을 보여 준다.
  // (종가는 오늘 정규장이 어떻게 끝났는지 보는 것이라 NXT 거래 종목만이 아니다.) 종목 수 분모도 받아 온 종목 수라 같이 전종목이 된다.
  const nxtOnly = nxtOnlyWindow !== null && pinnedSnapshotTime === undefined && requestedChoice !== 'close'
  // 이 계산의 'NXT'는 시간대 필터 상태를 기존 UI에 전달하기 위한 내부값이다. 프로필 분리·저장 키에 사용하지 않는다.
  const taxonomy: TaxonomyKey = isMarketry ? 'MARKETRY' : isCustom ? 'MINE' : nxtOnly ? 'NXT' : 'KRX'
  // 달력이 "오늘(실시간)"을 알아보려면 지난 날짜를 보는 동안에도 최신 스냅샷 시각을 기억해야 한다.

  // 종가 선택 — 지금 보는 날짜(실시간 스냅샷의 날짜)의 정규장 종가 스냅샷 시각을 달력과 같은 목록에서 찾아 그 지도를 받는다.
  // 실시간 날짜는 한 번이라도 실시간 지도를 받아야 알 수 있어서, 처음 한 번은 실시간 지도를 받고 그 뒤에 종가로 옮겨 간다.
  const wantsClose = requestedChoice === 'close' && pinnedSnapshotTime === undefined
  const liveDate = liveSnapshotTime?.slice(0, 10)
  const { data: closeDays, isSuccess: isCloseDaysSuccess, isError: isCloseDaysError, refetch: refetchCloseDays } = useSnapshotDays(
    market,
    liveDate?.slice(0, 7) ?? '',
    // 서버 오류가 계속되면 기본 재시도(3회, 30초 넘게)가 "불러오는 중"을 너무 오래 잡으므로 재시도하지 않고, 다시 시도는 종가 버튼으로 받는다.
    { enabled: wantsClose && liveDate !== undefined, retry: false },
  )
  const closeSnapshotTime = wantsClose ? closeDays?.find(day => day.date === liveDate)?.snapshotTime : undefined
  const isCloseActive = closeSnapshotTime !== undefined
  // 종가 지도가 없는 날(휴장 등)이거나 종가 시각 목록을 받지 못했으면(오류) 종가 선택을 누적으로 보여 준다. 실시간 지도를 보면서 종가라고 표시하지 않는다.
  const isCloseUnavailable = wantsClose && (isCloseDaysSuccess || isCloseDaysError) && !isCloseActive

  const {
    data: snapshotData,
    isLoading: isSnapshotLoading,
    isError: isSnapshotError,
    isSuccess: isSnapshotSuccess,
    isRefetching: isRefetchingHeatmap,
    refetch: refetchSnapshot,
  } = useHeatmap(market, source, nxtOnly, {
    enabled: needsTree && !isWaitingForSession,
    basis: requestedBasis,
    snapshotTime: pinnedSnapshotTime ?? closeSnapshotTime,
  })
  // 기간 등락률 — 시작일 종가 지도를 따로 받아, 종료일 지도(snapshotData)의 종목마다 시작일 하루 전 종가 대비 등락률로 바꾼다.
  const isRangeActive = rangeStartTime !== undefined
  // 기준은 시작일 1거래일 전의 종가다 — 그 거래일의 종가 지도에서 종가를 가져온다. 앞선 거래일을 못 찾으면(맨 처음 날짜) 시작일 지도의 전일종가로 대신한다.
  const rangePreviousDay = usePreviousTradingDay(market, rangeStartTime?.slice(0, 10) ?? null, { enabled: isRangeActive })
  const rangeBaseSnapshotTime = rangePreviousDay === undefined ? undefined : (rangePreviousDay?.snapshotTime ?? rangeStartTime)
  const rangeBaseKind = rangePreviousDay ? 'close' : 'previousClose'
  const {
    data: rangeStartData,
    isLoading: isRangeStartLoading,
    isError: isRangeStartError,
    refetch: refetchRangeStart,
  } = useHeatmap(market, source, nxtOnly, {
    enabled: needsTree && !isWaitingForSession && isRangeActive && rangeBaseSnapshotTime !== undefined,
    snapshotTime: rangeBaseSnapshotTime,
  })
  // 종료일 가격의 이름 — 종료일의 종가 지도 시각 목록에 있으면 종가, 없으면(장중 실시간 지도) 현재가. 종목 팝업에 보인다.
  const { data: rangeEndMonthDays } = useSnapshotDays(market, pinnedSnapshotTime?.slice(0, 7) ?? '', { enabled: isRangeActive, retry: 1 })
  const rangeEndPriceLabel = rangeEndMonthDays?.some(day => day.snapshotTime === pinnedSnapshotTime) === false ? '현재가' : '종가'
  // 기준일 다음 날부터 종료일까지의 분할·병합·감자 비율. 기준일 지도가 전일 종가를 쓰는 경우는 시작일 자체의 변경이 이미 반영돼 있다.
  const rangeAdjustmentFrom = rangeBaseSnapshotTime?.slice(0, 10) ?? null
  const rangeAdjustments = usePriceAdjustments(rangeAdjustmentFrom, pinnedSnapshotTime?.slice(0, 10) ?? null, { enabled: isRangeActive })
  // 비율을 못 받으면 하루치처럼 숨기지 않고 보정 없이 그린다. 분할이 없는 대부분의 종목은 값이 같다.
  const rangeAdjustmentData = rangeAdjustments.data ?? (rangeAdjustments.isError ? NO_RANGE_ADJUSTMENTS : undefined)
  const rangeResult = useMemo(
    () => (snapshotData && rangeStartData && rangeAdjustmentData ? buildRangeChangeRateTree(snapshotData.items, rangeStartData.items, rangeBaseKind, rangeEndPriceLabel, rangeAdjustmentData) : null),
    [snapshotData, rangeStartData, rangeBaseKind, rangeEndPriceLabel, rangeAdjustmentData],
  )
  // 기간 등락률을 보는 동안 두 지도가 다 오기 전에는 값이 없다 — 종료일 지도 그대로의(하루치) 등락률을 기간 값처럼 보여 주지 않는다.
  const data: HeatmapResponse | undefined = useMemo(
    () => {
      if (isRangeActive) return rangeResult && snapshotData ? { ...snapshotData, items: rangeResult.items } : undefined
      // 종가를 보는 동안에는 지도가 정규장 종가라서, 종목 팝업의 가격 줄 이름을 "현재가" 대신 "당일종가"로 보여 준다.
      if (isCloseActive && snapshotData) return { ...snapshotData, items: withPriceLabels(snapshotData.items, { base: '전일종가', end: '당일종가' }) }
      // 별도(시간외)는 정규장 종가가 기준가라서, 서버가 전일종가 자리에 그 종가를 담아 보낸다.
      if (requestedBasis === 'afterHours' && snapshotData && isAfterHoursSelectableAt(snapshotData.snapshotTime, snapshotData.afterHoursStart)) {
        return { ...snapshotData, items: withPriceLabels(snapshotData.items, { base: '당일종가', end: '현재가' }) }
      }
      return snapshotData
    },
    [isRangeActive, rangeResult, snapshotData, isCloseActive, requestedBasis],
  )
  const rangeExcludedStocks = rangeResult?.excludedStocks ?? []
  const isHeatmapLoading = isSnapshotLoading || (isRangeActive && (rangePreviousDay === undefined || isRangeStartLoading))
  const isError = isSnapshotError || (isRangeActive && isRangeStartError)
  const isHeatmapSuccess = isSnapshotSuccess && (!isRangeActive || rangeResult !== null)
  const refetchHeatmap = async () => {
    await Promise.all([
      refetchSnapshot(),
      ...(isRangeActive ? [refetchRangeStart()] : []),
    ])
  }
  const dataSnapshotTime = data?.snapshotTime
  // 종가 시각 목록을 기다리는 동안은 지도가 그대로라 아무 변화가 없어 보이므로, 이때부터 "불러오는 중" 화면을 띄운다.
  const isCloseWaiting = wantsClose && !isCloseActive && !isCloseUnavailable
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 응답이 없는 동안(다른 날짜·시장을 불러오는 중)에는 마지막으로 받은 값을 유지하는 상태라 응답에서 바로 계산할 수 없다. 이 줄은 색상 코드를 훅으로 옮기기 전에도 같았고, 옮긴 뒤 린트가 이 훅을 끝까지 검사하게 되어 드러났다.
    if (data) setAfterHoursStart(data.afterHoursStart ?? null)
  }, [data])
  useEffect(() => {
    if (!options?.readOnlyTelegramSnapshot && pinnedSnapshotTime === undefined && !isCloseActive && dataSnapshotTime) setLiveSnapshotTime(dataSnapshotTime)
  }, [pinnedSnapshotTime, isCloseActive, dataSnapshotTime, setLiveSnapshotTime, options?.readOnlyTelegramSnapshot])
  // 종가를 보는 동안에는 받은 지도가 정규장 종가라서, 별도가 열렸는지는 실시간 스냅샷으로 따진다.
  const isAfterHoursSelectable = isAfterHoursControlsVisible && isAfterHoursSelectableAt(isCloseActive ? liveSnapshotTime : data?.snapshotTime, data?.afterHoursStart)
  const changeRateMode: ChangeRateMode = isAfterHoursSelectable ? requestedBasis : 'daily'
  const changeRateChoice: ChangeRateChoice = requestedChoice === 'close' && !isCloseUnavailable ? 'close' : changeRateMode
  const rawRootNodes = data?.items
  // 비로그인의 거래소 분류는 업종 id가 모두 0이라, 제외 기능이 동작하도록 이름 기반 고유 id를 붙인다.
  // MARKETRY는 비로그인도 진짜 업종 id를 받으므로 그대로 쓴다.
  const rootNodes = useMemo(
    () => (isLoggedIn || isMarketry ? (rawRootNodes ?? []) : withStableSectorIds(rawRootNodes ?? [])),
    [isLoggedIn, isMarketry, rawRootNodes],
  )
  const defaultExchangeNames = defaultPreferences.data?.exchange?.excludedSectorNames
  // useTransientSetting은 저장값이 없을 때 이 초기값을 그대로 스냅샷으로 쓰므로, 매 렌더 새 Map이면 무한 렌더가 된다(거래소 모드 섹터 클릭 오류). 입력이 바뀔 때만 새로 만든다.
  const initialExchangeExclusions = useMemo(() => {
    const defaultExchangeSelection = new Set(Array.isArray(defaultExchangeNames) ? defaultExchangeNames.filter((item): item is string => typeof item === 'string') : [])
    return excludedNamesForPaths(rootNodes, [...defaultExchangeSelection])
  }, [rootNodes, defaultExchangeNames])
  const [exchangeExcludedSectorNames, setExchangeExcludedSectorNames] = useTransientSetting<Map<number, string>>(
    'heatmap.excludedSectorNames.exchange',
    initialExchangeExclusions,
  )

  // 기본값 배열도 트리가 바뀔 때만 새로 만든다 — 매 렌더 새 배열이면 useTransientSetting 스냅샷이 계속 바뀐다(비로그인 MARKETRY 제외).
  const seededMarketryExcludedKeys = useMemo(() => seedExcludedSectorKeys(rootNodes), [rootNodes])
  const [savedMarketryExcludedKeys, setSavedMarketryExcludedKeys] = usePageSetting<string[]>(
    profileSettingKey('marketry', 'heatmap.excludedSectorKeys'), seededMarketryExcludedKeys,
  )
  const [guestMarketryExcludedKeys, setGuestMarketryExcludedKeys] = useTransientSetting<string[]>(
    'heatmap.excludedSectorKeys.marketry.guest', savedMarketryExcludedKeys,
  )
  const marketryExcludedSectorNames = useMemo(
    () => excludedNamesForStableKeys(rootNodes, isLoggedIn ? savedMarketryExcludedKeys : guestMarketryExcludedKeys),
    [rootNodes, isLoggedIn, savedMarketryExcludedKeys, guestMarketryExcludedKeys],
  )
  useEffect(() => {
    if (!isMarketry || !isLoggedIn || !preferencesLoaded || !data || !isHeatmapSuccess || options?.readOnlyTelegramSnapshot) return
    // 거래소·MARKETRY 제외 업종은 이 브라우저에 저장한다(서버에 두지 않는다). 브라우저 값을 읽고 브라우저에 쓴다.
    const key = profileSettingKey('marketry', 'heatmap.excludedSectorKeys')
    const stored = readBrowserSetting(key)
    const saved = stored.found ? stored.value : undefined
    if (!Array.isArray(saved)) return
    const available = new Set<string>()
    const collect = (nodes: HeatmapSectorNode[]) => nodes.forEach(node => {
      if (node.stableKey) available.add(node.stableKey)
      collect(node.children)
    })
    collect(data.items)
    const pruned = saved.filter((value): value is string => typeof value === 'string' && available.has(value))
    if (pruned.length === saved.length) return
    writeBrowserSetting(key, pruned)
    notifySettingsChanged()
  }, [isMarketry, isLoggedIn, preferencesLoaded, data, isHeatmapSuccess, options?.readOnlyTelegramSnapshot])
  const excludedSectorNames = isMarketry ? marketryExcludedSectorNames : isCustom ? mineExcludedSectorNames : exchangeExcludedSectorNames
  const setExcludedSectorNames = isMarketry
    ? (next: Map<number, string> | ((previous: Map<number, string>) => Map<number, string>)) => {
      const value = typeof next === 'function' ? next(marketryExcludedSectorNames) : next
      const keys = [...value.keys()].map(id => stableKeyForSectorId(rootNodes, id)).filter((key): key is string => key !== null)
      if (isLoggedIn) setSavedMarketryExcludedKeys(keys)
      else setGuestMarketryExcludedKeys(keys)
    }
    : isCustom ? setMineExcludedSectorNames : setExchangeExcludedSectorNames

  useEffect(() => {
    if (!data) return
    if (options?.readOnlyTelegramSnapshot) return
    // 비로그인의 거래소 제외 목록은 서버 값이 아니라 이 탭에서 직접 고른 것이라 서버 값으로 다시 채우지 않는다.
    // 내 분류의 서버 isExcluded 값은 분류 데이터가 기준이다. MARKETRY 제외 목록은 stable key로
    // 프로필 설정에 저장하므로 업로드된 트리의 numeric ID를 다시 저장하지 않는다.
    if (!isCustom) return
    const seedKey = `mine:${session?.userId ?? 'anonymous'}`
    try {
      if (lastSeededExclusionKey === seedKey) return
      lastSeededExclusionKey = seedKey
    } catch {
      // 기억하지 못해도 다음 트리 응답 때 서버 값으로 다시 채운다.
    }
    setMineExcludedSectorNames(seedExcludedSectorNames(data.items, []))
  }, [data, isCustom, session?.userId, setMineExcludedSectorNames, options?.readOnlyTelegramSnapshot])

  const captureExcluded = telegramCaptureSetting.data?.values?.excludedSectors
  const snapshotExcludedSectorNames = options?.readOnlyTelegramSnapshot && data
    ? isTelegramCapture
      ? excludedNamesForStableKeys(data.items, captureExcluded?.map(([key]) => key) ?? seedExcludedSectorKeys(data.items))
      : marketryExcludedSectorNames
    : excludedSectorNames

  // 로그인 사용자의 거래소 분류 트리는 사용자 정의 섹터를 쓰지 않으므로 isExcluded와 제외 목록을 적용하지 않는다.
  // 비로그인은 거래소 분류만 쓰지만 직접 고른 제외 목록을 이 탭에서 적용한다(새로고침하면 초기화).
  // MARKETRY는 읽기 전용이라 이 탭에서만 제외한다.
  const excludedSectorIds = useMemo(
    () => (usesCustomTree || !isLoggedIn) && sectorFilterEnabled
      ? new Set(isTelegramCapture && captureExcluded
        ? excludedNamesForStableKeys(rootNodes, captureExcluded.map(([key]) => key)).keys()
        : excludedSectorNames.keys())
      : new Set<number>(),
    [usesCustomTree, isLoggedIn, sectorFilterEnabled, excludedSectorNames, isTelegramCapture, captureExcluded, rootNodes],
  )

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
  const topPickSectorKeys = useMemo(() => {
    if (!topPickEnabled || effectiveTopPickDepth < 0 || effectiveTopPickDepth >= topPickMaxSelectableDepth) {
      return new Set<string>()
    }
    return pickTopSectorKeys(collectSectorsAtDepth(filteredRootNodes, effectiveTopPickDepth), selectedTopPickCount, selectedDepthMetric)
  }, [
    selectedDepthMetric,
    filteredRootNodes,
    topPickEnabled,
    selectedTopPickCount,
    effectiveTopPickDepth,
    topPickMaxSelectableDepth,
  ])

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

  const handleExcludeSector = (sectorId: number, sectorName: string) => {
    const path = findSectorPath(rootNodes, sectorId)
    setExcludedSectorNames(prev => new Map(prev).set(sectorId, path ? path.join(' > ') : sectorName))
    // 서버에는 내 분류(본인 데이터)일 때만 저장한다. MARKETRY·비로그인은 이 탭에만 남는다.
    if (isCustom) registerExcludedSector(sectorId).catch(e => console.error('섹터 제외 실패', e))
  }

  const excludedStockCounts = useMemo(() => collectExcludedSectorCounts(rootNodes, excludedMarketValueTiers), [rootNodes, excludedMarketValueTiers])
  const excludedCountsReady = Boolean(data) && !isError && !isHeatmapLoading && !isWaitingForSession && !isCloseWaiting && isMarketValueTierRangeReady
  const coveredExcludedIds = useMemo(() => collectCoveredExcludedIds(rootNodes, excludedSectorNames), [rootNodes, excludedSectorNames])

  const handleRemoveExcludedSector = (sectorId: number) => {
    setExcludedSectorNames(prev => {
      const next = new Map(prev)
      next.delete(sectorId)
      return next
    })
    if (isCustom) unregisterExcludedSector(sectorId).catch(e => console.error('섹터 제외 해제 실패', e))
  }

  const settingsModalProps = {
    isCustom,
    strongIndustryColor,
    // 지도·평균에서 항상 빼는 정지 종목 수 — 설정창의 업종 제외 목록에 고정 항목으로 보여 준다.
    suspendedStockCount: data?.suspendedStockCount ?? 0,
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
    sectorFilterEnabled,
    onToggleSectorFilter: () => setSectorFilterEnabled(prev => !prev),
    // 제외 업종 목록은 이름순으로 보여준다 — 서버가 내려주는 트리 순서는 업종을 만든 순서를 따라서, 같은 분류라도
    // MARKETRY와 내 분류에서 순서가 다르게 나왔다.
    excludedSectors: Array.from(excludedSectorNames, ([sectorId, sectorName]) => ({ sectorId, sectorName, stockCount: excludedCountsReady ? excludedStockCounts.get(sectorId) ?? 0 : null, coveredByParent: coveredExcludedIds.has(sectorId) })).sort((a, b) =>
      compareKoreanText(a.sectorName, b.sectorName),
    ),
    onRemoveExcludedSector: handleRemoveExcludedSector,
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
      excludedSectors: Array.from(snapshotExcludedSectorNames.entries()).flatMap(([id, name]) => {
        const stableKey = stableKeyForSectorId(rootNodes, id)
        return stableKey ? [[stableKey, name] as [string, string]] : []
      }),
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
    excludedSectorNames,
    onChangeSectorFilterEnabled: setSectorFilterEnabled,
    // MARKETRY 분류+섹터 기준 스위치가 둘 다 켜져있을 때만 실제로 적용되는 최종 제외 대상 ID 집합
    // (filteredRootNodes를 만들 때 쓰는 것과 동일한 값) — 트리를 직접 그리지 않고 섹터 ID
    // 기준으로만 걸러내면 되는 페이지(섹터 랭킹 등)를 위해 내보낸다.
    excludedSectorIds,
    handleExcludeSector,
    handleRemoveExcludedSector,
    // 화면별 설정(그래프 페이지 등)도 지금 분류 기준으로 따로 저장하도록 내보낸다.
    settingsProfile,
  }
}
