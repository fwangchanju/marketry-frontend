import { compareKoreanText } from '@/utils/koreanSort'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePersistedState } from './usePersistedState'
import { useTaxonomySelection } from './useTaxonomySelection'
import { MEMBER_DEFAULTS, settingDefaultsFor } from '@/utils/settingDefaults'
import type { TaxonomySource, TaxonomyKey } from '@/utils/taxonomyNames'
import { useNxtOnlyWindow } from '@/hooks/useNxtOnlyWindow'
import { useAfterHoursControlsVisible } from '@/hooks/useTradingSession'
import { isAfterHoursSelectable as isAfterHoursSelectableAt } from '@/utils/tradingWindow'
import type { ChangeRateChoice, ChangeRateMode } from '@/api/treemap'
import { usePageSetting } from './usePageSetting'
import { useRouteAwareMarket } from './useRouteAwareMarket'
import { useIsLoggedIn, useSession } from './useSession'
import { useLoginGate } from './useLoginGate'
import { useTreemap, useSnapshotDays, usePreviousTradingDay } from './useTreemap'
import { useSnapshotSelection } from './useSnapshotSelection'
import { useTreemapColorScale } from './useTreemapColorScale'
import {
  useCreateCustomScaleThreshold as useCreateTreemapScaleThreshold,
  useUpdateCustomScaleThreshold as useUpdateTreemapScaleThreshold,
  useDeleteCustomScaleThreshold as useDeleteTreemapScaleThreshold,
} from './useTreemapCustom'
import {
  collectSectorsAtDepth,
  useFilteredTreemap,
  type FilteredTreemapSectorNode,
  type StockChangeFilter,
  type SectorChangeFilter,
} from './useFilteredTreemap'
import { useMarketValueTierRange } from './useMarketValueTierRange'
import { registerExcludedSector, unregisterExcludedSector } from '@/api/treemap'
import {
  colorAtPercent,
  createDefaultColorScale,
  DEFAULT_MINUS_THRESHOLDS,
  DEFAULT_ZERO_COLOR,
  resolveLegendSwatches,
  type ColorScaleConfig,
  type ColorScaleThreshold,
} from '@/utils/treemapColorScale'
import { clampBetweenNeighbors } from '@/utils/thresholdBar'
import { withStableSectorIds } from '@/utils/guestSectorIds'
import type { TreemapResponse, TreemapSectorNode } from '@/types/api'
import { buildRangeChangeRateTree } from '@/utils/rangeChangeRate'

// 한 부호의 구간들을 절댓값이 작은 것부터 정렬해(몇 번째 구간인지 = 순서) 원래 배열의 인덱스와 함께 돌려준다. 등락률 막대의 손잡이 순서이자 상승·하락 거울 짝의 기준이다.
function sortedSignRows(thresholds: ColorScaleThreshold[], positive: boolean): { threshold: ColorScaleThreshold; index: number }[] {
  return thresholds
    .map((threshold, index) => ({ threshold, index }))
    .filter(({ threshold }) => (positive ? threshold.thresholdPercent > 0 : threshold.thresholdPercent < 0))
    .sort((a, b) => Math.abs(a.threshold.thresholdPercent) - Math.abs(b.threshold.thresholdPercent))
}

// 조회 실패/로딩 중이거나 "색상 커스텀 사용"이 꺼져있을 때 쓰는 폴백 — thresholds가 비어있으면 어차피
// 기본 프리셋으로 귀결된다(resolveTreemapColor/resolveLegendSwatches 참고).
const EMPTY_COLOR_SCALE: ColorScaleConfig = { thresholds: [] }
const DEFAULT_STRONG_INDUSTRY_COLOR = MEMBER_DEFAULTS.strongIndustryColor
const LEGACY_STRONG_INDUSTRY_COLOR = '#eab308'

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

// 트리맵 종목 박스에 이름/등락률 중 뭘 보여줄지 — 슬라이더 인덱스로 저장(0~3). off는 둘 다 안 보여준다.
export type StockLabelMode = 'off' | 'nameOnly' | 'rateOnly' | 'both'
const STOCK_LABEL_MODES: StockLabelMode[] = ['off', 'nameOnly', 'rateOnly', 'both']

// sectorId -> "상위 - 하위" 형태의 전체 경로. "이 섹터가 제외 목록에 있는지"만 관리하고,
// 실제로 화면에서 걸러낼지는 별도의 sectorFilterEnabled 마스터 스위치가 결정한다.
function seedExcludedSectorNames(
  nodes: TreemapSectorNode[],
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

// 우클릭 제외 시점엔 리프 섹터명만 알고 있으므로, 뎁스가 있으면(최상위가 아니면) 원본 트리에서
// 조상 경로를 다시 찾아 "상위 - 하위" 형태로 만든다. 최상위면 경로 길이가 1이라 그대로 리프명만 나온다.
function findSectorPath(nodes: TreemapSectorNode[], targetId: number, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.sectorId === targetId) return path
    const found = findSectorPath(node.children, targetId, path)
    if (found) return found
  }
  return null
}

function topPickAverage(node: FilteredTreemapSectorNode, metric: DepthMetric): number | null {
  // 강세 업종은 업종 탭 표시 지표를 따른다. 평균이 아닌 지표를 고르면 시총 가중으로 계산한다.
  return metric === 'simpleAvgChangeRate' ? node.simpleAvgChangeRate : node.weightedAvgChangeRate
}

// "설정" 사이드바(SettingsPanel) + 색상 구간 편집 패널이 필요로 하는 상태/로직 전부를
// 여기 한 곳에 모아둔다 — 세션스토리지 키를 그대로 공유해서 어느 페이지에서 열어도 같은 값을 보고
// 편집한다(지도/섹터 페이지뿐 아니라 아직 이 옵션이 실제로 영향 안 주는 페이지에서 열어도 동일).
// 페이지별로 서로 다른 옵션을 보여줘야 할 필요가 생기면 그때 이 훅을 쪼개면 된다.
//
// needsTree: 이 페이지가 실제로 트리 데이터(useTreemap)를 화면에 그리는 데 쓰는지. 지도/섹터처럼
// 트리를 직접 렌더링하는 페이지는 true(기본값)로 항상 조회하고, 어드민/요약처럼 설정 사이드바를 통해서만
// 간접적으로 필요한 페이지는 false를 넘겨서 사이드바를 열기 전까지 조회 자체를 미룬다 — 그래도 설정을
// 열면 그 순간부터는 조회하므로(그리고 지도/섹터를 먼저 봤다면 react-query 캐시로 즉시 뜨므로) 설정
// 내용 자체는 어느 페이지에서 열든 동일하게 보인다.
// 제외 업종 목록을 서버 기본값으로 마지막에 채운 분류 — 이 탭의 sessionStorage에 둔다.
const SEEDED_KEY_STORAGE = 'treemap.excludedSeedKey'

function withPriceLabels(nodes: TreemapSectorNode[], labels: { base: string; end: string }): TreemapSectorNode[] {
  return nodes.map(node => ({
    ...node,
    items: node.items.map(item => ({ ...item, rangeLabels: labels })),
    children: withPriceLabels(node.children, labels),
  }))
}

export function useGlobalSettings(options?: { needsTree?: boolean; allowChangeRateMode?: boolean }) {
  const needsTree = options?.needsTree ?? true
  // 등락률 기준(누적/시간외) 선택은 지도 페이지만 쓴다. 그룹 페이지는 now·before 쌍을 따로 받아 누적 기준으로 그리므로
  // 같은 값을 실으면 화면이 섞인다.
  const allowChangeRateMode = options?.allowChangeRateMode ?? false
  const { pathname } = useLocation()
  const isLoggedIn = useIsLoggedIn()
  const { isLoading: isSessionLoading } = useSession()
  // 설정 기본값은 utils/settingDefaults.ts에 모아 두었다(비로그인과 회원이 다르다). 사용자가 값을 바꾸면 저장값이 우선한다.
  const defaults = settingDefaultsFor(isLoggedIn)
  const { requireLogin } = useLoginGate()
  // 트리 조회 마켓은 경로를 따른다 — /map, /sector 둘 다 경로 세그먼트가 곧 마켓이라 여기서 바로
  // 우선순위(쿼리 > 경로 > 저장값 > 기본값)를 적용하면, 이 훅을 그대로 쓰는 지도 페이지는 물론
  // 트리 조회만 공유하는 섹터 페이지도 같은 마켓으로 트리를 받는다(docs/instructions-route-market-first-render.md 결정 2).
  const [market] = useRouteAwareMarket('treemap.market', 'ALL_STOCK')
  // 기존 계정 설정은 브라우저 선택이 없을 때만 기본값으로 사용한다. 새 선택은 세 페이지가 localStorage로 공유한다.
  const [savedIsCustom] = usePageSetting('treemap.isCustom', defaults.isCustom)
  const [selectedTaxonomy, setSelectedTaxonomy] = useTaxonomySelection(savedIsCustom ? 'MARKETRY' : 'KRX')
  // 내 분류(mine)는 로그인이 필요하다 — 로그아웃 상태에서는 처음 화면인 MARKETRY로 보이고, 브라우저에 저장한 선택 자체는 보존한다.
  // MARKETRY는 올린 분류라 로그인 없이 읽는다(읽기 전용).
  const source: TaxonomySource = selectedTaxonomy === 'MINE' && !isLoggedIn ? 'MARKETRY' : selectedTaxonomy
  // 새로고침 직후에는 로그인 여부를 아직 모른다. 내 분류를 골라 둔 사람이 그 사이에 다른 분류 지도를 받았다가 바뀌지 않도록,
  // 로그인 확인이 끝날 때까지는 지도를 요청하지 않고 로딩으로 둔다.
  const isWaitingForSession = selectedTaxonomy === 'MINE' && isSessionLoading
  // isCustom: 본인 데이터로 만든 내 분류(편집·서버 저장이 되는 분류). isMarketry: 올린 MARKETRY. 둘 다 대·중·소분류 트리를 쓴다.
  const isCustom = source === 'MINE'
  const isMarketry = source === 'MARKETRY'
  const usesCustomTree = isCustom || isMarketry
  // NXT 종목만 보기 — 어느 분류(거래소/MARKETRY)이든 오늘의 시간표가 정한 필터 구간에만
  // 분류는 그대로 두고 NXT 거래 종목만 남기고, 그 밖의 시간에는 전체 종목을 보여준다. 사용자가 직접 켜고 끄지 않는다.
  const nxtOnlyWindow = useNxtOnlyWindow()
  // 등락률 기준은 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지 선택한다.
  // 표시 시간대가 아니거나 시간외 스냅샷이 아직 없으면 저장한 선택과 무관하게 누적으로 보인다.
  const [afterHoursStart, setAfterHoursStart] = useState<string | null>(null)
  const isAfterHoursControlsVisible = useAfterHoursControlsVisible(afterHoursStart)
  const [storedChangeRateChoice, setStoredChangeRateChoice] = usePersistedState<ChangeRateChoice>('treemap.changeRateMode', 'daily')
  const requestedChoice: ChangeRateChoice = allowChangeRateMode && isAfterHoursControlsVisible ? storedChangeRateChoice : 'daily'
  const requestedBasis: ChangeRateMode = requestedChoice === 'afterHours' ? 'afterHours' : 'daily'
  // 섹터 랭킹/강세 업종 계산에 쓰는 평균 방식은 박스 크기 비율과 별도로 저장한다.
  const [avgChangeRateUseSimple, setAvgChangeRateUseSimple] = usePageSetting('treemap.avgChangeRateUseSimple', defaults.avgChangeRateUseSimple)
  // 0은 동일 크기, 100은 시가총액 비례이며 중간값은 시가총액 차이를 거듭제곱으로 압축한다.
  const [storedBoxSizeMarketCapRatio, setBoxSizeMarketCapRatio] = usePageSetting('treemap.boxSizeMarketCapRatio', defaults.boxSizeMarketCapRatio)
  const [storedStrongIndustryColor, setStrongIndustryColor] = usePageSetting(
    'treemap.strongIndustryColor',
    defaults.strongIndustryColor,
  )
  const isLegacyStrongIndustryColor = storedStrongIndustryColor.toLowerCase() === LEGACY_STRONG_INDUSTRY_COLOR
  const strongIndustryColor = isLegacyStrongIndustryColor
    ? DEFAULT_STRONG_INDUSTRY_COLOR
    : storedStrongIndustryColor

  // 스크린샷 렌더러와 로그인 사용자 설정은 저장된 색을 사용한다. 예전 기본 금색 값이 남아 있으면
  // 첫 화면부터 청록색으로 표시하고, sessionStorage 또는 서버 설정에도 새 값을 저장한다.
  useEffect(() => {
    if (isLegacyStrongIndustryColor) setStrongIndustryColor(DEFAULT_STRONG_INDUSTRY_COLOR)
  }, [isLegacyStrongIndustryColor, setStrongIndustryColor])
  const boxSizeMarketCapRatio = Math.max(0, Math.min(100, Math.round(storedBoxSizeMarketCapRatio)))
  const [storedDepthMetric, setStoredDepthMetric] = usePageSetting<StoredDepthMetric>(
    'treemap.activeDepthMetric',
    defaults.depthMetric,
  )
  const selectedDepthMetric = resolveDepthMetric(storedDepthMetric)
  const [depthMetricEnabled, setDepthMetricEnabled] = usePageSetting(
    'treemap.depthMetricEnabled',
    storedDepthMetric !== null,
  )
  // 분류별 데이터 깊이에 맞춰 화면에 적용하되, 사용자가 고른 범위는 전환해도 보존한다.
  // 기본값: 대분류~중분류(index 0~1) — 렌더러가 스크린샷으로 찍는 기본 화면에 등락률이 보이도록.
  const [depthMetricMinIndex, setDepthMetricMinIndex] = usePageSetting('treemap.depthMetricMinIndex', defaults.depthMetricMinIndex)
  const [depthMetricMaxIndex, setDepthMetricMaxIndex] = usePageSetting('treemap.depthMetricMaxIndex', defaults.depthMetricMaxIndex)
  // avgChangeRateUseSimple은 섹터 랭킹에 사용한다. 강세 업종은 업종 탭 표시 지표를 따른다.
  // 종목 박스가 전체 트리맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다(섹터 헤더와는 무관).
  const [boxLabelMinAreaPercent, setBoxLabelMinAreaPercent] = usePageSetting('treemap.boxLabelMinAreaPercent', defaults.boxLabelMinAreaPercent)
  // 종목 박스에 이름만/등락률만/둘 다/끄기 중 뭘 보여줄지 — 기본은 둘 다(기존 동작 유지, 배열 앞에
  // "끄기"가 추가되면서 both의 인덱스가 2에서 3으로 밀림).
  const [stockLabelModeIndex, setStockLabelModeIndex] = usePageSetting('treemap.stockLabelModeIndex', defaults.stockLabelModeIndex)
  // 기존 저장값 0(끄기)도 유지하며, 켜고 끄는 동안 선택한 표기 방식은 보존한다.
  const [stockLabelEnabled, setStockLabelEnabled] = usePageSetting('treemap.stockLabelEnabled', stockLabelModeIndex !== 0)
  const selectedStockLabelModeIndex = stockLabelModeIndex || 3
  const stockLabelMode = stockLabelEnabled ? STOCK_LABEL_MODES[selectedStockLabelModeIndex] : 'off'
  // 지도 페이지에 표시되는 모든 등락률(%)의 소수점 자릿수 — 인덱스가 그대로 자릿수(0=정수, 1=소수
  // 1자리, 2=소수 2자리). 기본값 1(소수 1자리).
  const [decimalPlacesIndex, setDecimalPlacesIndex] = usePageSetting('treemap.decimalPlacesIndex', defaults.decimalPlacesIndex)
  // 종목 박스 설명 팝업을 여는 방식 — false=우클릭(기존 동작), true=커서를 박스 위로 옮길 때. 섹터(대/중/소분류)
  // 팝업은 이 설정과 무관하게 항상 우클릭이다.
  const [stockPopupOnHover, setStockPopupOnHover] = usePageSetting('treemap.stockPopupOnHover', defaults.stockPopupOnHover)
  const decimalPlaces = decimalPlacesIndex
  // 시가총액 구간 범위 필터 — 마켓맵/섹터 랭킹 화면이 세션스토리지 키를 공유한다(useMarketValueTierRange 참고).
  // 시가총액 구간 필터는 분류 체계와 무관한 표시 설정이라 두 분류 모두에서 적용한다.
  const {
    tiers: valueTiers,
    minIndex: tierRangeMinIndex,
    maxIndex: tierRangeMaxIndex,
    setMinIndex: setTierRangeMinIndex,
    setMaxIndex: setTierRangeMaxIndex,
    excludedMarketValueTiers,
    isTierRangeReady: isMarketValueTierRangeReady,
  } = useMarketValueTierRange(true)
  const [excludedSectorNames, setExcludedSectorNames] = usePersistedState<Map<number, string>>(
    'treemap.excludedSectorNames',
    new Map(),
    {
      serialize: map => [...map.entries()],
      deserialize: raw => new Map(raw as [number, string][]),
    },
  )
  // 섹터 제외를 목록별로 켜고 끄는 게 아니라, 제외 적용 자체를 통째로 켜고 끄는 마스터 스위치.
  const [sectorFilterEnabled, setSectorFilterEnabled] = usePageSetting('treemap.sectorFilterEnabled', defaults.sectorFilterEnabled)
  const [stockChangeFilter, setStockChangeFilter] = usePageSetting<StockChangeFilter>('treemap.stockChangeFilter', defaults.stockChangeFilter)
  const [sectorChangeFilter, setSectorChangeFilter] = usePageSetting<SectorChangeFilter>('treemap.sectorChangeFilter', defaults.sectorChangeFilter)
  const [sectorChangeDepth, setSectorChangeDepth] = usePageSetting('treemap.sectorChangeDepth', defaults.sectorChangeDepth)
  // null = 제한 없음(전체 뎁스 표시). 슬라이더의 실제 상한(availableMaxDepth)은 트리 계산 후에 나온다.
  // 기본값 2(렌더러 스크린샷 기준 화면에 맞춤).
  const [selectedMaxDepth, setMaxDepth] = usePageSetting<number | null>('treemap.selectedMaxDepth', defaults.maxDepth)
  const [sectorLevelEnabled, setSectorLevelEnabled] = usePageSetting('treemap.sectorLevelEnabled', defaults.sectorLevelEnabled)
  const maxDepth = sectorLevelEnabled ? selectedMaxDepth : 0
  // 선호 업종 — 선택한 절대 depth에서 등락률 상위 N개 섹터를 지도 전체에 강조한다.
  const [topPickDepth, setTopPickDepth] = usePageSetting('treemap.topPickDepth', defaults.topPickDepth)
  const [topPickCount, setTopPickCount] = usePageSetting('treemap.topPickCount', defaults.topPickCount)
  const [topPickEnabled, setTopPickEnabled] = usePageSetting('treemap.topPickEnabled', topPickCount !== 0)
  const selectedTopPickCount = topPickCount || 2
  // 설정 사이드바 열림 상태. 페이지 진입 시 기본으로 연다.
  const [isSettingsOpen, setIsSettingsOpen] = useState(true)
  const previousPathnameRef = useRef(pathname)

  useEffect(() => {
    if (previousPathnameRef.current === pathname) return
    previousPathnameRef.current = pathname
    setIsSettingsOpen(true)
  }, [pathname])
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
  const pinnedNeedsLookup = pinnedSelection !== null && pinnedSelection.market !== market
  const { data: pinnedMonthDays } = useSnapshotDays(market, pinnedSelection?.snapshotTime.slice(0, 7) ?? '', { enabled: pinnedNeedsLookup, retry: 1 })
  const pinnedSnapshotTime = pinnedSelection === null
    ? undefined
    : (pinnedNeedsLookup ? (pinnedMonthDays?.find(day => day.date === pinnedSelection.snapshotTime.slice(0, 10))?.snapshotTime ?? pinnedSelection.snapshotTime) : pinnedSelection.snapshotTime)
  const rangeNeedsLookup = rangeSelection !== null && rangeSelection.market !== market
  const { data: rangeMonthDays } = useSnapshotDays(market, rangeSelection?.snapshotTime.slice(0, 7) ?? '', { enabled: rangeNeedsLookup, retry: 1 })
  const rangeStartTime = rangeSelection === null || pinnedSnapshotTime === undefined
    ? undefined
    : (rangeNeedsLookup ? (rangeMonthDays?.find(day => day.date === rangeSelection.snapshotTime.slice(0, 10))?.snapshotTime ?? rangeSelection.snapshotTime) : rangeSelection.snapshotTime)
  // NXT 종목만 보기는 실시간 지도에만 쓴다 — 그 시간대(15:40~16:00 등)에도 종가·지난 날짜·기간은 그날의 전종목을 보여 준다.
  // (종가는 오늘 정규장이 어떻게 끝났는지 보는 것이라 NXT 거래 종목만이 아니다.) 종목 수 분모도 받아 온 종목 수라 같이 전종목이 된다.
  const nxtOnly = nxtOnlyWindow !== null && pinnedSnapshotTime === undefined && requestedChoice !== 'close'
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
    isRefetching: isRefetchingTreemap,
    refetch: refetchSnapshot,
  } = useTreemap(market, source, nxtOnly, {
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
  } = useTreemap(market, source, nxtOnly, {
    enabled: needsTree && !isWaitingForSession && isRangeActive && rangeBaseSnapshotTime !== undefined,
    snapshotTime: rangeBaseSnapshotTime,
  })
  // 종료일 가격의 이름 — 종료일의 종가 지도 시각 목록에 있으면 종가, 없으면(장중 실시간 지도) 현재가. 종목 팝업에 보인다.
  const { data: rangeEndMonthDays } = useSnapshotDays(market, pinnedSnapshotTime?.slice(0, 7) ?? '', { enabled: isRangeActive, retry: 1 })
  const rangeEndPriceLabel = rangeEndMonthDays?.some(day => day.snapshotTime === pinnedSnapshotTime) === false ? '현재가' : '종가'
  const rangeResult = useMemo(
    () => (snapshotData && rangeStartData ? buildRangeChangeRateTree(snapshotData.items, rangeStartData.items, rangeBaseKind, rangeEndPriceLabel) : null),
    [snapshotData, rangeStartData, rangeBaseKind, rangeEndPriceLabel],
  )
  // 기간 등락률을 보는 동안 두 지도가 다 오기 전에는 값이 없다 — 종료일 지도 그대로의(하루치) 등락률을 기간 값처럼 보여 주지 않는다.
  const data: TreemapResponse | undefined = useMemo(
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
  const isTreemapLoading = isSnapshotLoading || (isRangeActive && (rangePreviousDay === undefined || isRangeStartLoading))
  const isError = isSnapshotError || (isRangeActive && isRangeStartError)
  const isTreemapSuccess = isSnapshotSuccess && (!isRangeActive || rangeResult !== null)
  const refetchTreemap = () => {
    void refetchSnapshot()
    if (isRangeActive) void refetchRangeStart()
  }
  const dataSnapshotTime = data?.snapshotTime
  // 종가 시각 목록을 기다리는 동안은 지도가 그대로라 아무 변화가 없어 보이므로, 이때부터 "불러오는 중" 화면을 띄운다.
  const isCloseWaiting = wantsClose && !isCloseActive && !isCloseUnavailable
  useEffect(() => {
    if (data) setAfterHoursStart(data.afterHoursStart ?? null)
  }, [data])
  useEffect(() => {
    if (pinnedSnapshotTime === undefined && !isCloseActive && dataSnapshotTime) setLiveSnapshotTime(dataSnapshotTime)
  }, [pinnedSnapshotTime, isCloseActive, dataSnapshotTime, setLiveSnapshotTime])
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

  useEffect(() => {
    if (!data) return
    // 비로그인의 거래소 제외 목록은 서버 값이 아니라 이 탭에서 직접 고른 것이라 서버 값으로 다시 채우지 않는다.
    // MARKETRY에 정해 둔 제외 업종을 처음 값으로 받는다(그 뒤 바꾸는 건 이 탭에서만 유효하다).
    if (!isLoggedIn && !isMarketry) return
    // 어떤 분류로 채웠는지를 이 탭에 기억해 둔다 — 페이지를 옮길 때(지도→홈·그룹) 이 훅이 다시 만들어져도 지도에서 직접 바꾼 제외 목록을
    // 서버 기본값으로 되돌리지 않는다. 시장(코스피·코스닥·전체)은 키에 넣지 않는다: 업종 id가 시장과 무관해서 시장을 바꿔도 목록이 그대로여야 한다.
    const key = `${source}:${nxtOnly}`
    try {
      if (sessionStorage.getItem(SEEDED_KEY_STORAGE) === key) return
      sessionStorage.setItem(SEEDED_KEY_STORAGE, key)
    } catch {
      // 저장소를 못 쓰면 화면을 열 때마다 기본값으로 채운다(예전 동작).
    }
    setExcludedSectorNames(seedExcludedSectorNames(data.items, []))
  }, [data, source, nxtOnly, isLoggedIn, isMarketry, setExcludedSectorNames])

  // 로그인 사용자의 거래소 분류 트리는 사용자 정의 섹터를 쓰지 않으므로 isExcluded와 제외 목록을 적용하지 않는다.
  // 비로그인은 거래소 분류만 쓰지만 직접 고른 제외 목록을 이 탭에서 적용한다(새로고침하면 초기화).
  // MARKETRY는 읽기 전용이라 이 탭에서만 제외한다.
  const excludedSectorIds = useMemo(
    () => (usesCustomTree || !isLoggedIn) && sectorFilterEnabled ? new Set(excludedSectorNames.keys()) : new Set<number>(),
    [usesCustomTree, isLoggedIn, sectorFilterEnabled, excludedSectorNames],
  )

  // 거래소(KRX·NXT) 분류는 대분류(0)만 있다. 1-2 업종 등락 방향의 단계도 저장값은 두고 여기서만 따라간다.
  const effectiveSectorChangeDepth = usesCustomTree ? sectorChangeDepth : Math.min(sectorChangeDepth, 0)
  const directionFilters = useMemo(() => ({
    stockChangeFilter: pathname.startsWith('/map/') ? stockChangeFilter : 'all' as StockChangeFilter,
    sectorChangeFilter: pathname.startsWith('/map/') ? sectorChangeFilter : 'all' as SectorChangeFilter,
    sectorChangeDepth: effectiveSectorChangeDepth,
    sectorUseSimpleAverage: selectedDepthMetric === 'simpleAvgChangeRate',
  }), [pathname, stockChangeFilter, sectorChangeFilter, effectiveSectorChangeDepth, selectedDepthMetric])

  const { filteredRootNodes, availableMaxDepth } = useFilteredTreemap(
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
  // 여기서만 대분류로 따라간다(1-1 업종 분류 깊이와 같은 한계). MARKETRY로 돌아오면 원래 값이 살아난다.
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

    const candidates = collectSectorsAtDepth(filteredRootNodes, effectiveTopPickDepth)
      .map((node, index) => ({ node, index, average: topPickAverage(node, selectedDepthMetric) }))
      .filter((candidate): candidate is { node: FilteredTreemapSectorNode; index: number; average: number } => {
        return candidate.average !== null
      })
      .sort((a, b) => b.average - a.average || b.node.totalMarketValue - a.node.totalMarketValue || a.index - b.index)

    // KRX 업종은 모두 sectorId=0이므로 이름까지 포함해 구별한다.
    return new Set(candidates.slice(0, selectedTopPickCount).map(candidate =>
      JSON.stringify([candidate.node.sectorId, candidate.node.sectorName]),
    ))
  }, [
    selectedDepthMetric,
    filteredRootNodes,
    topPickEnabled,
    selectedTopPickCount,
    effectiveTopPickDepth,
    topPickMaxSelectableDepth,
  ])

  // 등락률 컬러 스케일 draft — 서버 값(useTreemapColorScale)이 도착하면 딱 한 번만 시드하고,
  // 이후로는 어드민이 설정 팝업에서 편집하는 draft를 그대로 트리맵/범례에 흘려보낸다. 그래서 "저장"
  // 전에도 실제로 보여주는 지도 색이 곧바로 바뀐다 — 별도의 미리보기 트리맵이 필요 없다.
  const [colorEditIndices, setColorEditIndices] = useState<number[]>([])
  // 세션 시작 시점의 draft 스냅샷 — 취소 복구와 편집 전 비어 있던 부호의 fallback 표시를 위해 보관한다.
  const colorEditSnapshotRef = useRef<ColorScaleConfig | null>(null)
  const { data: colorScaleServerData, refetch: refetchColorScale } = useTreemapColorScale()
  const [colorScaleDraft, setColorScaleDraft] = useState<ColorScaleConfig | null>(null)
  // 비로그인은 서버에 저장할 수 없으므로, 이 탭에서 바꾼 색상 설정은 세션(sessionStorage)에만 남긴다 — 다른
  // 화면 설정(usePageSetting의 비로그인 동작)과 같다. 로그인 사용자는 서버 저장이라 이 값을 쓰지 않는다.
  const [localColorScale, setLocalColorScale] = usePersistedState<ColorScaleConfig | null>('treemap.localColorScale', null)
  // draft가 어느 로그인 상태의 값으로 시드됐는지 — 로그인/로그아웃으로 바뀌면 새 서버 값으로 다시 시드한다.
  const [colorScaleDraftOwner, setColorScaleDraftOwner] = useState<boolean | null>(null)
  const [colorEditError, setColorEditError] = useState<string | null>(null)
  // 편집 영역이 항상 열려 있으므로, 적용/취소 뒤에 같은 칸을 다시 편집 대상으로 잡기 위해 기억해 둔다.
  const selectedColorPercentRef = useRef<number | null>(null)
  if (colorScaleServerData && (colorScaleDraft === null || colorScaleDraftOwner !== isLoggedIn)) {
    setColorScaleDraftOwner(isLoggedIn)
    // 이전 계정에서 열려 있던 편집 세션은 인덱스가 의미를 잃으므로 함께 닫는다.
    setColorEditIndices([])
    setColorEditError(null)
    colorEditSnapshotRef.current = null
    // 방어적 복사 — react-query 캐시가 들고 있는 참조를 그대로 draft로 물고 있지 않도록.
    const seededThresholds = (!isLoggedIn && localColorScale ? localColorScale : colorScaleServerData).thresholds.map(threshold => ({ ...threshold }))
    // 저장된 구간이 하나도 없으면(비로그인 첫 접속, 초기화 직후) 기본 7칸을 실제 구간으로 채워서 시작한다.
    setColorScaleDraft(seededThresholds.length > 0 ? { thresholds: seededThresholds } : createDefaultColorScale())
  }
  // "색상 커스텀 사용" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 완전히 분리돼 있어서
  // 꺼도 draft에 저장해둔 값은 건드리지 않고, 그냥 실제 지도에 넘기는 값만 빈 스케일(=기본 프리셋)로 바꿔치기한다.
  const [colorCustomOn, setColorCustomOn] = usePageSetting('treemap.colorCustomOn', defaults.colorCustomOn)
  // 같은 부호/퍼센트에 편집 중인 행이 이미 있는 임계값과 겹치면 편집 중인 값을 우선한다.
  // resolver는 같은 thresholdPercent 중 마지막 값을 유효점으로 삼으므로, 저장 draft의 배열 순서를
  // 바꾸지 않고 렌더링 입력에서만 편집 행을 뒤로 보낸다.
  const editingColorIndexSet = new Set(colorEditIndices)
  const colorScaleDraftForRendering = colorScaleDraft
    ? {
        thresholds: [
          ...colorScaleDraft.thresholds.filter((_, index) => !editingColorIndexSet.has(index)),
          ...colorEditIndices.map(index => colorScaleDraft.thresholds[index]).filter((threshold): threshold is ColorScaleThreshold => threshold !== undefined),
        ],
      }
    : EMPTY_COLOR_SCALE
  const colorScale = colorCustomOn ? colorScaleDraftForRendering : EMPTY_COLOR_SCALE
  const legendSwatches = resolveLegendSwatches(colorScale, {
    // 편집을 시작하기 전부터 비어 있던 부호는 기본 2/5/8 슬롯을 유지한다. 이번 편집으로 처음
    // 비어진 부호만 숨겨 fallback 슬롯이 새로 늘어나는 것을 막는다.
    // 색상 범위 커스텀을 끈 동안에는 지도가 기본 색을 쓰므로 범례도 기본 7칸을 모두 보여준다(흐리게 표시) — 이때는 숨기지 않는다.
    includeFallbacksForEmptySides: !colorCustomOn || colorEditIndices.length === 0 || !colorEditSnapshotRef.current
      ? true
      : {
          negative: !colorEditSnapshotRef.current.thresholds.some(threshold => threshold.thresholdPercent < 0),
          positive: !colorEditSnapshotRef.current.thresholds.some(threshold => threshold.thresholdPercent > 0),
        },
  })

  // 설정 사이드바에서 편집 중인 threshold들 — colorScaleDraft.thresholds의 인덱스 목록.
  // edit 모드는 항상 원소 1개, add 모드는 "+"로 여러 개가 될 수 있다. 빈 배열이면 세션 없음.
  const createThresholdMutation = useCreateTreemapScaleThreshold()
  const updateThresholdMutation = useUpdateTreemapScaleThreshold()
  const deleteThresholdMutation = useDeleteTreemapScaleThreshold()
  // "적용"이 세션 안의 여러 행을 순회하며 create/update를 여러 번 호출하는 비동기 작업이라,
  // 개별 뮤테이션 훅의 isPending 하나만으로는 전체 진행 상태를 못 나타내서 별도로 든다.
  const [isApplyingColorEdit, setIsApplyingColorEdit] = useState(false)

  // 범례 칸·막대 손잡이를 눌러 편집 대상(첫 편집 행)을 바꾼다 — 적용하지 않은 이전 수정은 되돌리지 않고 그대로 두어, 여러 손잡이·상승/하락을 고친 뒤 한 번에 적용하거나 취소할 수 있다.
  // 저장된 색이 없는 기본 칸은 그 칸의 기본 값으로 구간을 만들어 편집한다(범례 칸 수는 고정이라 새 칸을 만드는 기능은 없다). 이렇게 채운 기본 칸은 처음 상태(snapshot)에도 같이 넣어 "수정"으로 보지 않는다.
  const handleSelectColorSwatch = (percent: number, color: string) => {
    if (!colorScaleDraft || isApplyingColorEdit) return
    const base = colorEditSnapshotRef.current ?? colorScaleDraft
    colorEditSnapshotRef.current = base
    selectedColorPercentRef.current = percent
    setColorEditError(null)
    const existingIndex = colorScaleDraft.thresholds.findIndex(threshold => threshold.thresholdPercent === percent)
    const selectFirst = (index: number) => setColorEditIndices(previous => [index, ...previous.filter(item => item !== index)])
    if (existingIndex >= 0) {
      selectFirst(existingIndex)
      return
    }
    const added = { thresholdPercent: percent, color, colorLabel: null }
    colorEditSnapshotRef.current = { ...base, thresholds: [...base.thresholds, added] }
    setColorScaleDraft({ ...colorScaleDraft, thresholds: [...colorScaleDraft.thresholds, added] })
    selectFirst(colorScaleDraft.thresholds.length)
  }
  // 등락률 막대에서 rank번째 구간 경계를 옮긴다 — 상승 구간의 값을 바꾸면 같은 순서의 하락 구간도 같은 값의 거울(-값)로 함께 바뀐다(대칭).
  // 손잡이는 이웃 구간을 넘거나 겹치지 못해서 순서가 밀리거나 같은 값이 생기는 일이 없다. 하락 구간이 아직 없으면 기본 하락 색으로 만든다.
  const handleChangeColorEditRankPercent = (rank: number, wanted: number) => {
    if (!colorScaleDraft || colorEditIndices.length === 0) return
    const positiveRows = sortedSignRows(colorScaleDraft.thresholds, true)
    const negativeRows = sortedSignRows(colorScaleDraft.thresholds, false)
    const target = positiveRows[rank]
    if (!target) return
    const percent = clampBetweenNeighbors(positiveRows.map(row => row.threshold.thresholdPercent), rank, wanted)
    const mirror = negativeRows[rank]
    if (percent === target.threshold.thresholdPercent && mirror?.threshold.thresholdPercent === -percent) return
    let thresholds = colorScaleDraft.thresholds.map((threshold, index) => {
      // 손잡이를 옮기면 명도도 새 등락률에 맞춰 바뀐다(색 계열은 그대로, 회색은 그대로).
      if (index === target.index) return { ...threshold, thresholdPercent: percent, color: colorAtPercent(threshold.color, percent) }
      if (index === mirror?.index) return { ...threshold, thresholdPercent: -percent, color: colorAtPercent(threshold.color, percent) }
      return threshold
    })
    let mirrorIndex = mirror?.index
    if (mirrorIndex === undefined) {
      const fallback = DEFAULT_MINUS_THRESHOLDS[Math.min(rank, DEFAULT_MINUS_THRESHOLDS.length - 1)]
      mirrorIndex = thresholds.length
      thresholds = [...thresholds, { thresholdPercent: -percent, color: colorAtPercent(fallback.color, percent), colorLabel: fallback.colorLabel }]
    }
    setColorEditError(null)
    setColorScaleDraft({ ...colorScaleDraft, thresholds })
    setColorEditIndices(previous => Array.from(new Set([...previous, target.index, mirrorIndex])))
    const selectedIndex = colorEditIndices[0]
    if (selectedIndex === target.index) selectedColorPercentRef.current = percent
    else if (selectedIndex === mirrorIndex) selectedColorPercentRef.current = -percent
  }
  // 등락률 막대에서 손잡이(그 순서의 구간)나 0% 표식을 눌러 편집 대상을 고른다 — 이전의 범례 칸을 누르는 것과 같다(적용하지 않은 수정은 되돌린다).
  // side는 상승/하락 중 어느 쪽 구간의 색을 편집할지 정한다. 막대의 값은 상승 기준이고 하락은 같은 값의 거울이다.
  const handleSelectColorRank = (rank: number, side: 'up' | 'down') => {
    if (!colorScaleDraft) return
    const row = sortedSignRows(colorScaleDraft.thresholds, side === 'up')[rank]
    if (row) handleSelectColorSwatch(row.threshold.thresholdPercent, row.threshold.color)
  }
  const handleSelectColorZero = () => {
    if (!colorScaleDraft) return
    const zero = colorScaleDraft.thresholds.find(threshold => threshold.thresholdPercent === 0)
    handleSelectColorSwatch(0, zero?.color ?? DEFAULT_ZERO_COLOR)
  }
  const handleChangeColorEditColor = (rowIndex: number, color: string, colorLabel: string | null) => {
    const targetIndex = colorEditIndices[rowIndex]
    if (targetIndex === undefined) return
    setColorEditError(null)
    setColorScaleDraft(prev =>
      prev ? { ...prev, thresholds: prev.thresholds.map((t, i) => (i === targetIndex ? { ...t, color, colorLabel } : t)) } : prev,
    )
  }
  // 상승/하락 한쪽의 색을 한 번에 바꾼다 — 구간마다 색을 따로 고르지 않고 한쪽에 색 계열 하나를 정해 순서별 명도로 칠한다(colors는 작은 구간부터).
  // 바뀐 구간은 모두 편집 세션에 넣어 적용 때 함께 저장한다(첫 원소는 그대로라 고른 칸이 바뀌지 않는다).
  const handleChangeColorEditSideColor = (side: 'up' | 'down', colors: string[], colorLabel: string | null) => {
    if (!colorScaleDraft || colorEditIndices.length === 0) return
    const rows = sortedSignRows(colorScaleDraft.thresholds, side === 'up')
    const colorByIndex = new Map(rows.map((row, rank) => [row.index, colors[Math.min(rank, colors.length - 1)]]))
    if (colorByIndex.size === 0) return
    setColorEditError(null)
    setColorScaleDraft({
      ...colorScaleDraft,
      thresholds: colorScaleDraft.thresholds.map((threshold, index) => (colorByIndex.has(index) ? { ...threshold, color: colorByIndex.get(index)!, colorLabel } : threshold)),
    })
    setColorEditIndices(previous => Array.from(new Set([...previous, ...colorByIndex.keys()])))
  }
  const handleApplyColorEdit = async () => {
    if (!colorScaleDraft || colorEditIndices.length === 0) {
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
      return
    }
    setColorEditError(null)
    setIsApplyingColorEdit(true)
    try {
      // 같은 signed percentage가 편집 행과 나머지 draft에 모두 있으면, 사용자가 방금 편집한 값을
      // 남기고 기존 행은 제거한다. 그 외에도 이미 중복된 draft 값은 한 지점으로 정리한다.
      const sessionIndexSet = new Set(colorEditIndices)
      const candidatesByThreshold = new Map<number, { entry: ColorScaleThreshold; edited: boolean }[]>()
      colorScaleDraft.thresholds.forEach((entry, index) => {
        const candidates = candidatesByThreshold.get(entry.thresholdPercent) ?? []
        candidates.push({ entry, edited: sessionIndexSet.has(index) })
        candidatesByThreshold.set(entry.thresholdPercent, candidates)
      })

      const resolvedGroups = Array.from(candidatesByThreshold, ([thresholdPercent, candidates]) => {
        const editedCandidates = candidates.filter(candidate => candidate.edited)
        const winner = editedCandidates.at(-1) ?? candidates.at(-1)!
        // 새 draft 행이 기존 값과 겹치면 기존 id를 재사용해 update한다. 사용자가 수정한 기존 행의
        // id가 있으면 그 id를 유지하고, 겹친 나머지 id는 삭제 대상으로 모은다.
        const savedId = winner.entry.id ?? candidates.find(candidate => candidate.entry.id !== undefined)?.entry.id
        const losingIds = candidates
          .map(candidate => candidate.entry.id)
          .filter((id): id is number => id !== undefined && id !== savedId)
        return {
          entry: { ...winner.entry, id: savedId },
          edited: editedCandidates.length > 0,
          // 아직 서버에 저장된 적 없는 칸(처음 열 때 채운 기본 칸)도 함께 저장한다 — 바꾼 칸만 저장하면 새로고침 뒤 나머지 기본 칸이 범례에서 사라진다.
          needsSave: editedCandidates.length > 0 || savedId === undefined,
          thresholdPercent,
          losingIds,
        }
      })
      const idsToDelete = Array.from(new Set(resolvedGroups.flatMap(group => group.losingIds)))
      const entriesToSave = resolvedGroups.filter(group => group.needsSave).map(group => group.entry)

      // 비로그인은 서버에 저장하지 않는다 — 정리된 결과를 화면 설정과 이 탭의 세션에만 반영한다.
      if (!isLoggedIn) {
        const nextDraft = { thresholds: resolvedGroups.map(group => group.entry) }
        setColorScaleDraft(nextDraft)
        setLocalColorScale(nextDraft)
        colorEditSnapshotRef.current = null
        setColorEditIndices([])
        return
      }

      // 같은 thresholdPercent는 백엔드에서 중복 불가이므로, 충돌 행 삭제를 완료한 다음에 저장한다.
      await Promise.all(idsToDelete.map(id => deleteThresholdMutation.mutateAsync(id)))
      const savedEntries = await Promise.all(
        entriesToSave.map(entry => {
          const payload = { thresholdPercent: entry.thresholdPercent, color: entry.color, colorLabel: entry.colorLabel }
          return entry.id !== undefined
            ? updateThresholdMutation.mutateAsync({ id: entry.id, payload })
            : createThresholdMutation.mutateAsync(payload)
        }),
      )

      const savedByThreshold = new Map(savedEntries.map(entry => [entry.thresholdPercent, entry]))
      setColorScaleDraft({
        thresholds: resolvedGroups.map(group => group.needsSave ? savedByThreshold.get(group.thresholdPercent)! : group.entry),
      })
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
    } catch {
      // 저장이 실패하면 편집 세션을 닫지 않는다 — 입력한 값을 그대로 둔 채 다시 시도하거나 취소할 수 있다.
      setColorEditError('색상을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsApplyingColorEdit(false)
    }
  }
  const handleCancelColorEdit = () => {
    const hadSaveError = colorEditError !== null
    // 취소하면 값이 처음으로 돌아가므로, 다시 열 때 고르던 칸을 처음 값 기준으로 다시 잡는다(처음에 없던 칸이면 기본 칸을 연다).
    selectedColorPercentRef.current = colorEditSnapshotRef.current?.thresholds[colorEditIndices[0]]?.thresholdPercent ?? null
    if (colorEditSnapshotRef.current) setColorScaleDraft(colorEditSnapshotRef.current)
    colorEditSnapshotRef.current = null
    setColorEditError(null)
    setColorEditIndices([])
    // 저장 실패 뒤에는 서버에 일부만 반영됐을 수 있어서, 취소할 때 서버 값으로 다시 맞춘다.
    if (hadSaveError && isLoggedIn) {
      void refetchColorScale().then(result => {
        if (!result.data) return
        colorEditSnapshotRef.current = null
        setColorEditIndices([])
        setColorScaleDraft({ thresholds: result.data.thresholds.map(threshold => ({ ...threshold })) })
      })
    }
  }
  const colorEditThresholds = colorScaleDraft
    ? colorEditIndices.map(i => colorScaleDraft.thresholds[i]).filter((t): t is ColorScaleThreshold => t !== undefined)
    : []
  // 편집 영역을 항상 열어두기 위해, 편집 중인 칸이 없으면(처음, 적용/취소 직후) 마지막으로 보던 칸을 다시 연다.
  useEffect(() => {
    if (!colorCustomOn || !colorScaleDraft || colorEditIndices.length > 0 || isApplyingColorEdit) return
    // 처음에는 +8%(가장 큰 상승 칸)를 편집 대상으로 연다.
    const swatch = legendSwatches.find(item => Number.parseFloat(item.label) === selectedColorPercentRef.current)
      ?? legendSwatches.find(item => item.label === '+8%')
      ?? legendSwatches[0]
    if (swatch) handleSelectColorSwatch(Number.parseFloat(swatch.label), swatch.color)
  })
  // 저장해 둔 색상 구간을 모두 지워 기본 색상으로 되돌린다. 로그인 사용자는 서버에 저장된 구간도 삭제한다.
  const handleResetColorScale = async () => {
    if (!colorScaleDraft || isApplyingColorEdit) return
    setIsApplyingColorEdit(true)
    setColorEditError(null)
    try {
      const idsToDelete = (colorEditSnapshotRef.current ?? colorScaleDraft).thresholds
        .map(threshold => threshold.id)
        .filter((id): id is number => id !== undefined)
      if (isLoggedIn) await Promise.all(idsToDelete.map(id => deleteThresholdMutation.mutateAsync(id)))
      setColorScaleDraft(createDefaultColorScale())
      // 비로그인의 저장값은 비워 둔다 — 다음 접속 때 같은 기본 7칸으로 다시 채워진다.
      if (!isLoggedIn) setLocalColorScale({ thresholds: [] })
      colorEditSnapshotRef.current = null
      setColorEditIndices([])
    } catch {
      setColorEditError('색상을 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setIsApplyingColorEdit(false)
    }
  }
  // 커스텀을 끄면 편집 영역도 닫는다 — 적용하지 않은 수정은 되돌린다.
  // 끄더라도 편집 중인 작업은 취소하지 않는다 — 편집 영역이 흐려진 채로 남았다가 다시 켜면 이어서 할 수 있다.
  const handleChangeColorCustomOn = (on: boolean) => {
    setColorCustomOn(on)
  }

  // Basis 선택(MARKETRY / 거래소 / 내 분류). 내 분류만 로그인이 필요하다. 거래소는 KRX·NXT를 합친 한 칸이고, 시간대에 따라
  // NXT 거래 종목만 남길지 자동으로 정한다(taxonomy 값은 그 결과로 'KRX' 또는 'NXT'가 된다).
  // 비로그인이 내 분류를 누르면 로그인 안내만 띄우고, 보던 분류(MARKETRY 또는 거래소)에 그대로 머문다.
  // 새로고침 직후처럼 로그인 여부를 아직 모르는 동안은 안내를 띄우지 않고 선택만 받는다.
  const handleSelectTaxonomy = (next: TaxonomyKey) => {
    if (next === 'MINE' && !isLoggedIn && !isSessionLoading) {
      requireLogin(pathname)
      return
    }
    setSelectedTaxonomy(next === 'MARKETRY' || next === 'MINE' ? next : 'KRX')
  }
  const handleToggleCustom = () => handleSelectTaxonomy(isCustom ? 'KRX' : 'MINE')

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
    boxLabelMinAreaPercent,
    onChangeBoxLabelMinAreaPercent: setBoxLabelMinAreaPercent,
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
    excludedSectors: Array.from(excludedSectorNames, ([sectorId, sectorName]) => ({ sectorId, sectorName })).sort((a, b) =>
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

  const barPositiveRows = colorScaleDraft ? sortedSignRows(colorScaleDraft.thresholds, true) : []
  const barNegativeRows = colorScaleDraft ? sortedSignRows(colorScaleDraft.thresholds, false) : []
  // 편집 중인 칸이 상승/하락/0% 중 어디인지와, 상승·하락 구간 중 몇 번째인지(0%면 null).
  const selectedBar = (() => {
    const selectedIndex = colorEditIndices[0]
    const selectedThreshold = colorScaleDraft?.thresholds[selectedIndex]
    if (!colorScaleDraft || !selectedThreshold) return { side: 'zero' as const, rank: null }
    if (selectedThreshold.thresholdPercent === 0) return { side: 'zero' as const, rank: null }
    const up = selectedThreshold.thresholdPercent > 0
    const rank = (up ? barPositiveRows : barNegativeRows).findIndex(row => row.index === selectedIndex)
    return { side: up ? ('up' as const) : ('down' as const), rank: rank < 0 ? null : rank }
  })()
  // 처음(snapshot)과 지금 draft의 구간·색이 하나라도 다르면 "적용하지 않은 수정"이 있는 것이다(여러 손잡이·상승/하락을 고친 경우 포함).
  const thresholdSignature = (thresholds: ColorScaleThreshold[] | undefined) =>
    (thresholds ?? []).map(threshold => `${threshold.thresholdPercent}:${threshold.color.toLowerCase()}`).sort().join('|')
  const colorEditHasChanges = colorEditSnapshotRef.current !== null
    && thresholdSignature(colorEditSnapshotRef.current.thresholds) !== thresholdSignature(colorScaleDraft?.thresholds)

  const colorEditorPanelProps =
    colorEditThresholds.length > 0
      ? {
          hasChanges: colorEditHasChanges,
          thresholds: colorEditThresholds,
          bar: {
            positive: barPositiveRows.map(row => ({ percent: row.threshold.thresholdPercent, color: row.threshold.color })),
            negative: barNegativeRows.map(row => ({ percent: -row.threshold.thresholdPercent, color: row.threshold.color })),
            side: selectedBar.side,
            selectedRank: selectedBar.rank,
            zeroColor: colorScaleDraft?.thresholds.find(threshold => threshold.thresholdPercent === 0)?.color ?? DEFAULT_ZERO_COLOR,
          },
          onChangeRankPercent: handleChangeColorEditRankPercent,
          onSelectRank: handleSelectColorRank,
          onSelectZero: handleSelectColorZero,
          onChangeColor: handleChangeColorEditColor,
          onChangeSideColor: handleChangeColorEditSideColor,
          onApply: handleApplyColorEdit,
          onCancel: handleCancelColorEdit,
          isSaving: isApplyingColorEdit,
          errorMessage: colorEditError,
        }
      : null

  return {
    settingsModalProps,
    colorEditorPanelProps,
    // 지도 페이지가 트리맵을 실제로 그리는 데 직접 필요한 값들.
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
    refetchTreemap,
    isRefetchingTreemap,
    isLoading: isTreemapLoading || isWaitingForSession || isCloseWaiting,
    isError,
    isTreemapSuccess,
    isMarketValueTierRangeReady,
    rootNodes,
    filteredRootNodes,
    stockChangeFilter,
    onChangeStockChangeFilter: setStockChangeFilter,
    sectorChangeFilter,
    onChangeSectorChangeFilter: setSectorChangeFilter,
    sectorChangeDepth: effectiveSectorChangeDepth,
    onChangeSectorChangeDepth: setSectorChangeDepth,
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
    colorScale,
    excludedSectorNames,
    onChangeSectorFilterEnabled: setSectorFilterEnabled,
    // MARKETRY 분류+섹터 기준 스위치가 둘 다 켜져있을 때만 실제로 적용되는 최종 제외 대상 ID 집합
    // (filteredRootNodes를 만들 때 쓰는 것과 동일한 값) — 트리를 직접 그리지 않고 섹터 ID
    // 기준으로만 걸러내면 되는 페이지(섹터 랭킹 등)를 위해 내보낸다.
    excludedSectorIds,
    handleExcludeSector,
    handleRemoveExcludedSector,
  }
}
