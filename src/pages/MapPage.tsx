import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import PopupKindBadge from '@/components/PopupKindBadge'
import SettingsSidebar, {
  SettingsSidebarGroup,
  SettingsMarketValueSection,
  SettingsSectorChangeSection,
  SettingsStockChangeSection,
  SettingsSectorLevelSection,
  SettingsExcludeSection,
  SettingsColorSection,
  SettingsStrongIndustryColorSection,
  SettingsStockSizeSelector,
  type SettingsBookmarkId,
  type SettingsSidebarSectionId,
} from '@/components/SettingsSidebar'
import CaptureModal from '@/components/CaptureModal'
import Toolbar from '@/components/Toolbar'
import Treemap from '@/components/Treemap'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import ToolbarModeText from '@/components/ToolbarModeText'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerNotice from '@/components/DisclaimerNotice'
import { HINT_BUBBLE_COLOR_CLASS, POPUP_SIZE_CLASS } from '@/components/hintBubbleStyle'
import EmptyMessage, { EMPTY_DATA_MESSAGE } from '@/components/EmptyMessage'
import Spinner from '@/components/Spinner'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useTreemapDrilldown } from '@/hooks/useTreemapDrilldown'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useSettingsSidebarSide } from '@/hooks/useSettingsSidebarSide'
import { usePageSetting } from '@/hooks/usePageSetting'
import { sanitizeBookmarkIds } from '@/utils/settingsBookmarks'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { DisplayGroup } from '@/hooks/useTreemapLayout'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toCount, toSnapshotDateLabel } from '@/utils/format'
import { captureElementToClipboard, copyDataUrlToClipboard } from '@/utils/captureToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { ClockIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import ClosingPriceLabel from '@/components/ClosingPriceLabel'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import ToolbarChip from '@/components/ToolbarChip'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { appAlert } from '@/utils/appDialogBus'
import { useLeaveToEntryPage } from '@/hooks/useLeaveToEntryPage'
import { mapStretchFor, mapTileMethod } from '@/utils/mapStretch'
import { captureElementToDownload, downloadDataUrl, captureFileName } from '@/utils/captureToDownload'
import { limitDepth, flattenAllItems, type FilteredTreemapSectorNode } from '@/hooks/useFilteredTreemap'
import type { MarketQuery, TreemapSectorNode, TreemapItem } from '@/types/api'

// 업종 트리 전체의 종목 수(제외 업종도 포함한다).
const countStocks = (nodes: TreemapSectorNode[]): number => nodes.reduce((sum, node) => sum + node.items.length + countStocks(node.children), 0)
const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'ALL STOCK' }
// 종목·업종 헤더와 같은 방식 — 올리면 흰색 35% 덮개가 씌워진다(index.css의 hover와 같은 불투명도).
// 이동 경로의 이름이 몇 번째 업종 단계인지(0부터) — 마우스가 이미 그 이름 위에 있어서 툴팁에는 이름 대신 단계 이름만 쓴다. 업종은 최대 4단계(대분류·중분류·소분류·세분류)다.
const SECTOR_LEVEL_LABEL = ['대분류', '중분류', '소분류', '세분류']

const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-white transition-colors hover:bg-white/35'

// 이름 오른쪽의 되돌아가기 표시 — 이름과 한 버튼이라서 올리면 함께 하이라이트된다.
function BreadcrumbBackIcon() {
  return <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
}

// 북마크 탭이 한 화면에 들어가도록 항목 수를 제한한다.
const MAX_SETTINGS_BOOKMARKS = 5
const MAP_SETTINGS_SECTION_ORDER: SettingsSidebarSectionId[] = [
  'composition', 'industry', 'stockDisplay', 'colors', 'favorites',
]

// "업종 단계" 슬라이더가 "끄기"(뎁스 0)일 때만 쓰는 합성 섹터 — 실제 섹터가 아니므로
// sectorId는 실제 값과 겹치지 않는 sentinel을 쓰고, isSelf로 매칭해 헤더 자체를 안 그리게 한다
// (드릴다운으로 들어온 섹터의 헤더를 breadcrumb과 중복되지 않게 숨기는 것과 동일한 메커니즘).
const FLAT_GROUP_SECTOR_ID = -1
const FLAT_GROUP_NAME = '__flat__'

function toFlatDisplayGroup(items: TreemapItem[]): DisplayGroup {
  return {
    sectorId: FLAT_GROUP_SECTOR_ID,
    sectorName: FLAT_GROUP_NAME,
    totalMarketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0),
    weightedAvgChangeRate: null,
    simpleAvgChangeRate: null,
    items,
    children: [],
  }
}

function toDisplayGroup(node: FilteredTreemapSectorNode): DisplayGroup {
  return {
    sectorId: node.sectorId,
    sectorName: node.sectorName,
    totalMarketValue: node.totalMarketValue,
    weightedAvgChangeRate: node.weightedAvgChangeRate,
    simpleAvgChangeRate: node.simpleAvgChangeRate,
    items: node.items,
    children: node.children.map(toDisplayGroup),
  }
}

// 등락률 평균/상승·하락·보합 종목수는 개별 종목(changeRate) 기준이라, 지금 화면에 보이는
// 그룹들의 종목을 전부(하위 섹터 포함) 펼쳐서 모아야 한다.
function collectItems(groups: DisplayGroup[]): TreemapItem[] {
  const result: TreemapItem[] = []
  for (const group of groups) {
    result.push(...group.items)
    result.push(...collectItems(group.children))
  }
  return result
}

// 섹터 제외/시가총액 구간 필터를 적용하기 "전" 원본 트리 기준으로, 지금 보고 있는 뎁스(path)에
// 해당하는 종목을 전부 모은다 — "제외된 개수까지 포함한 전체 리스트 개수"를 보여주기 위한 분모.
function collectRawItems(nodes: TreemapSectorNode[]): TreemapItem[] {
  const result: TreemapItem[] = []
  for (const node of nodes) {
    result.push(...node.items)
    result.push(...collectRawItems(node.children))
  }
  return result
}

function findRawNodeByPath(nodes: TreemapSectorNode[], path: string[]): TreemapSectorNode | null {
  let node: TreemapSectorNode | null = null
  let siblings = nodes
  for (const name of path) {
    const found = siblings.find(n => n.sectorName === name)
    if (!found) return null
    node = found
    siblings = found.children
  }
  return node
}

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'error'

export default function MapPage() {
  const { pathname, search, hash } = useLocation()
  const isLoggedIn = useIsLoggedIn()
  const { requireLogin } = useLoginGate()
  // 북마크는 로그인 사용자의 서버 설정에만 저장한다. 비로그인이 누르면 저장하지 않고 로그인을 안내한다.
  const [storedSettingsBookmarks, setSettingsBookmarks] = usePageSetting<string[]>('treemap.settingsBookmarks', [])
  // 없어진 항목의 id가 저장돼 있어도 개수 제한(5개)에 잡히지 않도록 알려진 id만 쓴다.
  const settingsBookmarks = sanitizeBookmarkIds(storedSettingsBookmarks)
  const toggleSettingsBookmark = (id: SettingsBookmarkId) => {
    if (!isLoggedIn) {
      requireLogin(`${pathname}${search}${hash}`)
      return
    }
    if (settingsBookmarks.includes(id)) {
      setSettingsBookmarks(settingsBookmarks.filter(item => item !== id))
    } else if (settingsBookmarks.length >= MAX_SETTINGS_BOOKMARKS) {
      appAlert(`북마크는 최대 ${MAX_SETTINGS_BOOKMARKS}개까지 설정할 수 있습니다.`, { title: '추가 제한' })
    } else {
      setSettingsBookmarks([...settingsBookmarks, id])
    }
  }
  const {
    settingsModalProps,
    colorEditorPanelProps,
    market,
    isCustom,
    isMarketry,
    taxonomy,
    nxtOnly,
    nxtOnlyWindow,
    changeRateChoice,
    isAfterHoursControlsVisible,
    isAfterHoursSelectable,
    onChangeChangeRateMode,
    data,
    liveSnapshotTime,
    onChangePinnedSnapshotTime,
    onSelectRange,
    rangeStartTime,
    rangeExcludedStocks,
    pinnedSnapshotTime,
    refetchTreemap,
    isRefetchingTreemap,
    isLoading,
    isError,
    rootNodes,
    filteredRootNodes,
    sectorChangeFilter,
    onChangeSectorChangeFilter,
    sectorChangeDepth,
    onChangeSectorChangeDepth,
    stockChangeFilter,
    onChangeStockChangeFilter,
    maxDepth,
    marketValueDepthRange,
    weightedAvgDepthRange,
    simpleAvgDepthRange,
    upDownCountDepthRange,
    boxSizeMarketCapRatio,
    onChangeBoxSizeMarketCapRatio,
    topPickSectorKeys,
    strongIndustryColor,
    onChangeStrongIndustryColor,
    onChangeAvgChangeRateUseSimple,
    onChangeSectorFilterEnabled,
    boxLabelMinAreaPercent,
    stockLabelMode,
    stockPopupOnHover,
    decimalPlaces,
    colorScale,
    handleExcludeSector,
  } = useGlobalSettings({ allowChangeRateMode: true })
  // 달력에서 지난 날짜를 골라 보는 중이면 시각·시간대·누적/별도 표시는 숨긴다(실시간 정보라서).
  const isPastSnapshot = pinnedSnapshotTime !== undefined

  const [searchParams, setSearchParams] = useSearchParams()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')
  // NXT 안내 알림을 닫았는지 — 다른 분류으로 바꾸면 초기화돼서, NXT를 다시 고를 때 또 보인다.
  const [isNxtNoticeDismissed, setIsNxtNoticeDismissed] = useState(false)
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsSidebarSide()
  useEffect(() => {
    if (!nxtOnly) setIsNxtNoticeDismissed(false)
  }, [nxtOnly])
  // null이 아니면 Treemap이 해당 뎁스로 줄어드는 줌아웃 애니메이션을 재생하고, 끝나면
  // handleZoomOutComplete를 불러서 실제 이동을 한다 — 애니메이션 도중엔 path/groups를 먼저 바꾸지 않는다.
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  const captureRef = useRef<HTMLDivElement>(null)

  const { path, setPath, currentNode, currentSiblings, enterSector, goToDepth, reset } = useTreemapDrilldown(filteredRootNodes)
  // NXT 단독 시간대 안내창에 보여 줄 종목 수 — 서버가 준 NXT 종목 전체(분모)다. 제외 업종·표시 설정을 적용하기 전의 수라서 지도에 그려지는 수와 다를 수 있다.
  const nxtStockTotal = useMemo(() => countStocks(rootNodes), [rootNodes])

  // "업종 단계" 뎁스 제한은 진짜 루트(대분류) 기준 절대값이다 — 설정이 중분류까지면 어디로 드릴다운해도 중분류까지만 보인다.
  // 드릴다운해서 대분류 하나로 들어가면(path.length = 1) 이미 한 단계를 내려온 것이라, 그 안에서는 남은 단계(설정값 - path.length)만 보인다.
  // 다만 들어간 업종의 바로 아래 한 단계는 항상 보여야 하므로 최소 1단계다. 드릴다운 상태에서는 헤더를 그리지 않는 자기 자신은
  // 단계로 세지 않고 그 자식부터 1단계로 센다. 설정(2-1)이 꺼져 있으면 제한이 없다. 거래소 분류는 useGlobalSettings가 대분류(1단계)로 제한한다.
  const effectiveMaxDepth = maxDepth != null && maxDepth > 0 ? Math.max(1, maxDepth - path.length) : maxDepth
  // 뎁스 0("끄기")은 limitDepth로 표현할 수 없다(그 함수는 항상 최소 1뎁스 = 대분류 박스 하나는
  // 남긴다) — 완전 평탄화는 별도로 처리한다: 지금 보이는 위치 아래 종목을 전부 하나로 모아
  // isSelf 처리되는 합성 섹터 하나로 만들어서, 대분류 헤더까지 포함해 아무 섹터 박스도
  // 안 보이게 한다.
  const isFullyFlattened = effectiveMaxDepth === 0
  const displaySiblings =
    effectiveMaxDepth != null && !isFullyFlattened ? limitDepth(currentSiblings, effectiveMaxDepth) : currentSiblings
  const displayNode =
    currentNode && effectiveMaxDepth != null && !isFullyFlattened
      ? { ...currentNode, children: limitDepth(currentNode.children, effectiveMaxDepth) }
      : currentNode
  const groups: DisplayGroup[] = isFullyFlattened
    ? [toFlatDisplayGroup(flattenAllItems(currentNode ? [currentNode] : currentSiblings))]
    : displayNode
      ? [toDisplayGroup(displayNode)]
      : displaySiblings.map(toDisplayGroup)
  const visibleItems = collectItems(groups)
  // 지금 뎁스(path) 기준으로, 섹터 제외/시가총액 구간 필터를 적용하기 전 원본 트리에 있는 전체 종목 수.
  const rawCurrentNode = findRawNodeByPath(rootNodes, path)
  const totalItemCount = collectRawItems(rawCurrentNode ? [rawCurrentNode] : rootNodes).length

  // 상단 오른쪽 분류 배지(설정창 분류 선택 버튼과 같은 청록색).
  const modeStatusText = <TaxonomyBadge taxonomy={taxonomy} />

  // market은 이제 useGlobalSettings(useRouteAwareMarket)가 경로를 반영해서 매 렌더 계산해준다 —
  // 여기서는 그 값이 바뀔 때(NavSubBar에서 마켓을 고르는 등) 드릴다운만 초기화한다. 첫 렌더는 초기화할
  // 드릴다운이 없으므로 ref로 이전 값과 비교해서 실제로 바뀐 경우에만 반응한다.
  const previousMarketRef = useRef(market)
  useEffect(() => {
    if (previousMarketRef.current === market) return
    previousMarketRef.current = market
    reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- market이 바뀔 때만 반응하면 됨(reset은 매 렌더 새 함수)
  }, [market])

  // 안내창을 닫으면 들어온 곳(Home·Group)으로 돌려보낸다.
  const leaveToEntryPage = useLeaveToEntryPage()

  // 그룹 페이지에서 업종을 눌러 온 주소(?sector=이름) — 데이터가 준비되면 그 업종을 누른 상태로 열고 주소에서 지운다.
  // 못 찾으면 안내한다. 개발 모드의 효과 두 번 실행에도 안내창이 한 번만 뜨게, 안내한 이름을 기억해 둔다.
  const sectorParam = searchParams.get('sector')
  const noticedSectorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!sectorParam) {
      noticedSectorRef.current = null
      return
    }
    if (filteredRootNodes.length === 0) return
    // 그룹 페이지에서 들어온 칸은 단계별로 기록을 쌓지 않고 그 자체를 기준 칸으로 삼는다 — 뒤로가기를 한 번 누르면 바로 그룹으로 돌아간다.
    // (지금보다 더 깊은 경로로 들어갈 때만 — 깊이가 같거나 얕으면 새 칸이 필요 없다.)
    const entered = enterSector(sectorParam)
    entryFromOtherPageRef.current = entered !== null && entered.length > path.length
    if (entered === null && noticedSectorRef.current !== sectorParam) {
      noticedSectorRef.current = sectorParam
      void appAlert('해당 업종을 찾을 수 없습니다.\n이전 화면으로 돌아갑니다.').then(leaveToEntryPage)
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev)
        next.delete('sector')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 주소 값이 있고 트리가 준비됐을 때만 반응하면 된다(enterSector는 매 렌더 새 함수)
  }, [sectorParam, filteredRootNodes])

  // 캡처 URL의 avgMode/sectorFilter를 반영하고, 소비한 쿼리 파라미터를 주소에서 지운다.
  // 옛 캡처 URL의 ?market=은 /map·/group 리다이렉트(App.tsx LegacyMarketRedirect)가 이미 경로로 옮겼다.
  // 여기서 지우는 market은 경로가 있는 주소에 붙어 온 값뿐이다 — 마켓은 경로가 정하므로 지우기만 한다.
  useEffect(() => {
    const marketParam = searchParams.get('market')
    const isValidMarket = marketParam === 'KOSPI' || marketParam === 'KOSDAQ' || marketParam === 'ALL_STOCK'

    // 백엔드가 캡처 URL에 싣는 avgMode=simple|weighted, sectorFilter=true|false 계약에 맞춘다
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

  // breadcrumb에서 상위 뎁스로 갈 때, 바로 이동하지 않고 줌아웃 애니메이션을 먼저 요청한다.
  const handleGoToDepth = (depth: number) => {
    if (depth >= path.length) return
    setZoomOutRequestDepth(depth)
  }
  const handleZoomOutComplete = (depth: number) => {
    goToDepth(depth)
    setZoomOutRequestDepth(null)
  }

  // 들어간 단계 = 브라우저 기록 한 칸. 분류에 한 단계 들어갈 때마다 기록에 한 칸씩 쌓아서(직접 깊은 단계로
  // 들어가면 그 단계 수만큼), 브라우저 뒤로가기(⌘[, 트랙패드 스와이프, 마우스 뒤로가기 버튼)를 연달아
  // 눌러도 칸이 있는 만큼 계속 한 단계씩 올라간다. 전체 화면에서 더 누르면 원래대로 사이트 이전 페이지로
  // 나간다. 앞으로가기(⌘])는 들어갔던 단계로 다시 내려간다. 각 칸은 그 시점의 경로(treemapPath)를 가진다.
  const historyDepthRef = useRef(0) // 지금 브라우저 기록 위치가 가리키는 깊이
  const historyConsumingRef = useRef(false) // 코드가 일으킨 history.go()의 popstate는 무시한다
  const historyPathnameRef = useRef('') // 기록 칸을 쌓은 주소 — 다른 주소로 이동했으면 go()로 정리하지 않는다
  const prevPathLengthRef = useRef(0)
  // 다른 페이지(그룹)에서 업종을 눌러 들어온 칸 — 그 칸이 곧 기준 칸이다. 기준 칸의 깊이(평소 0, 그룹에서 중분류로 들어오면 2)보다 얕은 단계는 기록 칸이 없다.
  const entryFromOtherPageRef = useRef(false)
  const baseDepthRef = useRef(0)
  const pendingBasePathRef = useRef<string[] | null>(null) // history.go()가 끝난 뒤 기준 칸에 적을 경로
  const pendingUpDepthRef = useRef<number | null>(null)

  // 위로 가는 요청 — 줌아웃 애니메이션 중이면 가장 위쪽 목표 깊이만 기억해 뒀다가 끝나면 이어서 처리한다.
  const requestDepth = (target: number) => {
    if (zoomOutRequestDepth !== null) {
      pendingUpDepthRef.current = pendingUpDepthRef.current === null ? target : Math.min(pendingUpDepthRef.current, target)
      return
    }
    handleGoToDepth(target)
  }
  useEffect(() => {
    if (zoomOutRequestDepth !== null || pendingUpDepthRef.current === null) return
    const target = pendingUpDepthRef.current
    pendingUpDepthRef.current = null
    if (target < path.length) handleGoToDepth(target)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleGoToDepth는 매 렌더 새 함수
  }, [zoomOutRequestDepth, path.length])

  // 경로 길이가 바뀔 때 기록을 맞춘다 — 들어갈 때는 칸을 쌓고, 버튼/백스페이스/시장 전환 등으로 올라올 때는
  // 남은 칸을 history.go()로 정리한다(뒤로가기로 올라온 경우는 이미 칸이 소모돼 있어 할 일이 없다).
  useEffect(() => {
    const depth = path.length
    const previous = prevPathLengthRef.current
    prevPathLengthRef.current = depth
    if (depth > previous) {
      if (entryFromOtherPageRef.current) {
        // 그룹에서 들어온 칸: 새 칸을 쌓지 않고 지금 칸에 경로를 적어 기준 칸으로 삼는다.
        entryFromOtherPageRef.current = false
        window.history.replaceState({ ...(window.history.state ?? {}), treemapPath: path }, '')
        baseDepthRef.current = depth
        historyDepthRef.current = depth
        historyPathnameRef.current = window.location.pathname
      } else if (depth > historyDepthRef.current) {
        for (let k = historyDepthRef.current + 1; k <= depth; k++) {
          window.history.pushState({ ...(window.history.state ?? {}), treemapPath: path.slice(0, k) }, '')
        }
        historyDepthRef.current = depth
        historyPathnameRef.current = window.location.pathname
      }
    } else if (depth < previous) {
      // 위로 올라올 때: 기준 칸 위에 쌓인 칸만 history.go()로 정리한다(기준 칸까지 지우면 그룹으로 나가 버린다).
      const floor = Math.max(depth, baseDepthRef.current)
      let consuming = false
      if (floor < historyDepthRef.current) {
        const stale = historyDepthRef.current - floor
        historyDepthRef.current = floor
        if (window.location.pathname === historyPathnameRef.current) {
          historyConsumingRef.current = true
          window.history.go(-stale)
          consuming = true
        }
      }
      // 기준 칸보다 얕은 단계로 올라오면 기준 칸이 그 얕은 경로를 가리키게 고친다(안 그러면 나중에 이 칸으로 돌아왔을 때 처음 깊이로 되돌아간다).
      if (depth < baseDepthRef.current) {
        baseDepthRef.current = depth
        historyDepthRef.current = depth
        if (consuming) pendingBasePathRef.current = path.slice(0, depth)
        else window.history.replaceState({ ...(window.history.state ?? {}), treemapPath: path.slice(0, depth) }, '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 길이가 바뀔 때만 반응하면 된다(path 내용은 그때의 값을 쓴다)
  }, [path.length])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        if (pendingBasePathRef.current !== null) {
          window.history.replaceState({ ...(window.history.state ?? {}), treemapPath: pendingBasePathRef.current }, '')
          pendingBasePathRef.current = null
        }
        return
      }
      // 이 지도 화면 안에서의 이동만 다룬다 — 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      if (!window.location.pathname.startsWith('/map')) return
      const target: string[] = Array.isArray(e.state?.treemapPath) ? e.state.treemapPath : []
      historyDepthRef.current = target.length
      if (target.length < path.length) requestDepth(target.length)
      else if (target.length > path.length) setPath(target)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestDepth/handleGoToDepth는 매 렌더 새 함수이고 path/zoomOutRequestDepth로 충분히 갱신된다
  }, [path, zoomOutRequestDepth])

  // 백스페이스 = 브라우저 뒤로가기와 같다(한 단계 위로). 돌아가는 버튼이 눈에 잘 안 띄어서 백스페이스를 누르는
  // 경우가 많다. 글자를 입력하는 중(입력창/편집 영역)이거나 수정키가 같이 눌렸거나 공유 팝업이 떠 있거나
  // 이미 전체 화면이면 동작하지 않고, 키를 계속 누르고 있어도(자동 반복) 한 번만 동작한다.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Backspace' || e.repeat) return
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      const target = e.target
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      if (isShareOpen || historyDepthRef.current <= 0) return
      e.preventDefault()
      window.history.back()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isShareOpen])

  const handleCopy = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (captureRef.current) await captureElementToClipboard(captureRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const handleDownload = async (previewSrc?: string | null) => {
    if (!previewSrc && !captureRef.current) return
    setDownloadStatus('downloading')
    try {
      if (previewSrc) downloadDataUrl(previewSrc, captureFileName('MAP'))
      else if (captureRef.current) await captureElementToDownload(captureRef.current, captureFileName('MAP'))
      setDownloadStatus('idle')
    } catch {
      setDownloadStatus('error')
      setTimeout(() => setDownloadStatus('idle'), 2000)
    }
  }

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'
  const downloadLabel = downloadStatus === 'error' ? '다운로드 실패' : '다운로드'

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-black">
      <NavBar />
      <NavSubBar
        // 지금 보는 시장을 메뉴 목록에서 다시 고르면 처음 단계(드릴다운 맨 위)로 돌아간다.
        onReselectCurrent={() => handleGoToDepth(0)}
        actions={
          <NavBarPageActions
            onRefresh={refetchTreemap}
            isRefreshing={isRefetchingTreemap}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isCaptureOpen={isShareOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showRefresh={false}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* 공유·텔레그램 모두 [세 번째 바+본문] 열만 캡처해 설정창을 제외한다. */}
        <div
          ref={settingsRowRef}
          className="relative z-10 -mt-[10.5px] flex min-h-0 min-w-0 flex-1 bg-black"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다 — 내부 콘텐츠(트리맵)가 넘치면 이 컬럼 안에서만 처리된다. */}
          <div ref={captureRef} data-main-area data-captureid={CAPTURE_ID.MAP} data-capture-ready={!isLoading} className="flex min-h-0 min-w-0 flex-1 flex-col bg-black">
            {/* 왼쪽은 마켓·기간·시계·시간대 묶음, 오른쪽 끝은 프로필(사진 + 거래소·MARKETRY). 두 묶음이 같은 줄에서 서로 밀어내므로
                창이 좁아져도 겹치지 않고, 부족하면 오른쪽 글자가 먼저 줄어든다. */}
            <Toolbar>
              <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <ToolbarModeText page="MAP" label={MARKET_LABEL[market]} />
                {/* 로딩·오류·빈 화면에서도 시계·시간대·누적/별도를 제자리에 둔다. 데이터가 없으면 시각 글자만 비어 있다. */}
                <>
                  {/* 데이터가 없어도 날짜·시각 자리는 같은 폭으로 잡아 둬서 뒤의 시장 시간대 표시가 당겨지지 않게 한다. */}
                  <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-white'}>
                  <SnapshotDatePicker
                    market={market}
                    viewedSnapshotTime={data?.snapshotTime ?? null}
                    liveSnapshotTime={liveSnapshotTime}
                    onSelectSnapshotTime={onChangePinnedSnapshotTime}
                    onSelectRange={onSelectRange}
                    rangeStartTime={rangeStartTime}
                    isPast={isPastSnapshot}
                  >
                    {/* 기간을 보는 중이면 시작일은 고른 날짜로 이미 정해져 있으므로, 지도를 기다리는 동안에도 숨기지 않는다. */}
                    <span className={data?.snapshotTime || rangeStartTime ? undefined : 'invisible'}>
                      {toSnapshotDateLabel(rangeStartTime ?? data?.snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}
                    </span>
                    {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && <span>~ {toSnapshotDateLabel(pinnedSnapshotTime)}</span>}
                  </SnapshotDatePicker>
                  </ToolbarChip>
                  {isPastSnapshot && (rangeStartTime && pinnedSnapshotTime
                    ? rangeExcludedStocks.length > 0 && (
                      <ToolbarChip bare tone="text-gray-400">
                        <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
                      </ToolbarChip>
                    )
                    : (
                      <ToolbarChip tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-white'}>
                        <ClosingPriceLabel viewedSnapshotTime={data?.snapshotTime ?? null} liveSnapshotTime={liveSnapshotTime} />
                      </ToolbarChip>
                    ))}
                  {isPastSnapshot === false && (
                    <ToolbarChip bare tone="text-white">
                      <PageRefreshButton
                        cell
                        onRefresh={refetchTreemap}
                        isRefreshing={isRefetchingTreemap}
                        helpText={SNAPSHOT_REFRESH_HELP}
                        minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}
                      >
                        <ClockIcon className="h-[15px] w-[15px] shrink-0" aria-hidden />
                        <AnimatedClockLabel snapshotTime={data?.snapshotTime ?? null} />
                      </PageRefreshButton>
                    </ToolbarChip>
                  )}
                {/* 시장 시간대 말머리와 누적/별도 — 시간과 관련된 표시라 시계 옆에 붙인다. */}
                {isPastSnapshot === false && (
                  <span className="flex shrink-0">
                    <ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} />
                  </span>
                )}
                </>
              </div>
              {/* 맨 오른쪽 — 분류명을 설정창 업종 분류 선택 버튼 모양으로 표시하고, 좁아지면 이름을 줄인다. 로딩·오류·빈 화면에서도 제자리에 둔다. */}
              <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-gray-400`}>{modeStatusText}</div>
            </Toolbar>
            <div className="flex min-h-0 flex-1">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-black">
              {/* NXT 단독 시간대 공지 — 그 시간대에만 보여주는 알림이다. 닫을 수 있고, 시간대가 끝났다가 다시 오면 또 나온다. */}
              {/* 지도가 그려진 뒤에만 보인다 — 로딩 중이거나 불러오지 못했을 때는 가운데 로딩 원 위에 겹쳐 뜨지 않게 한다. */}
              {nxtOnly && nxtOnlyWindow && !isNxtNoticeDismissed && !isLoading && !isError && (
                // 확인창(AppDialogHost)과 같은 양식 — 지도 위 가운데에 크림색 창, 굵은 제목, 본문, 오른쪽 아래 청록 닫기 버튼.
                // 어두운 배경 없이 창만 띄우고 클릭을 막지 않는다(확인창과 달리 창 밖에서도 지도를 계속 쓸 수 있다). 공유 이미지에는 담지 않는다(data-capture-ignore).
                <div data-capture-ignore className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
                  <section
                    role="status"
                    aria-labelledby="nxt-notice-title"
                    className={`${HINT_BUBBLE_COLOR_CLASS} ${POPUP_SIZE_CLASS} pointer-events-auto`}
                  >
                    <h2 id="nxt-notice-title" className="flex items-center text-base font-bold text-black"><PopupKindBadge kind="안내" />{nxtOnlyWindow.fromMinutes < 12 * 60 ? '프리 마켓' : '애프터 마켓'}</h2>
                    <p className="mt-3 break-keep text-sm leading-relaxed text-black">
                      {nxtOnlyWindow.label.replace(/ /g, '')}에는 NXT 거래 가능 종목만 표시됩니다.
                      <br />
                      <span className="text-gray-600">최대 {toCount(nxtStockTotal)}종목이며, 설정에 따라 다를 수 있습니다.</span>
                    </p>
                    <div className="mt-auto flex justify-end pt-3">
                      <button
                        type="button"
                        onClick={() => setIsNxtNoticeDismissed(true)}
                        className="rounded-lg border-0 bg-cyan-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-cyan-600"
                      >
                        닫기
                      </button>
                    </div>
                  </section>
                </div>
              )}
              {path.length > 0 && (
                // 이름마다 "그 단계로만" 이동하는 링크다 — 줄 전체를 눌러 전체로 가던 동작은 없앴다. 지금 보고 있는
                // 마지막 이름은 링크가 아니라 현재 위치 표시(흰색)다.
                <nav
                  aria-label="업종 이동 경로"
                  className="flex h-7 w-full shrink-0 items-center truncate bg-black/70 pl-[7px] text-lg leading-none font-bold"
                >
                  <button
                    type="button"
                    data-hint="전체로 돌아가기"
                    onClick={() => handleGoToDepth(0)}
                    style={{ fontFamily: 'inherit' }}
                    className={BREADCRUMB_LINK_CLASS}
                  >
                    {MARKET_LABEL[market]}
                    <BreadcrumbBackIcon />
                  </button>
                  {path.map((name, index) => {
                    const isLastPath = index === path.length - 1
                    return isLastPath ? (
                      <span key={index} aria-current="page" className="px-2 text-[var(--accent)]">{name}</span>
                    ) : (
                      <button
                        key={index}
                        type="button"
                        data-hint={`${SECTOR_LEVEL_LABEL[index] ?? `${index + 1}단계`}로 돌아가기`}
                        onClick={() => handleGoToDepth(index + 1)}
                        style={{ fontFamily: 'inherit' }}
                        className={BREADCRUMB_LINK_CLASS}
                      >
                        {name}
                        <BreadcrumbBackIcon />
                      </button>
                    )
                  })}
                </nav>
              )}
              {/* 로딩·오류 원은 그룹 페이지와 같은 높이에 오도록 위 16px·아래 19.5px 여백 안에서 가운데에 둔다. */}
              {isLoading ? (
                <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]">
                  <Spinner showElapsed />
                </div>
              ) : isError ? (
                <div className="flex flex-1 items-center justify-center pt-4 pb-[19.5px]">
                  <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchTreemap} />
                </div>
              ) : visibleItems.length === 0 ? (
                <div className="relative flex-1">
                  <EmptyMessage
                    message={stockChangeFilter === 'all' && sectorChangeFilter === 'all' ? EMPTY_DATA_MESSAGE : '조건에 해당하는 종목이 없습니다'}
                    topClass="-top-1"
                  />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col px-[7px]">
                  {/* 양옆 여백 7px. */}
                  <Treemap
                    groups={groups}
                    selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)}
                    depth={path.length}
                    onSelectSector={enterSector}
                    onExcludeSector={handleExcludeSector}
                    heightClassName="min-h-0 flex-1"
                    marketValueDepthRange={marketValueDepthRange}
                    weightedAvgDepthRange={weightedAvgDepthRange}
                    simpleAvgDepthRange={simpleAvgDepthRange}
                    upDownCountDepthRange={upDownCountDepthRange}
                    boxSizeMarketCapRatio={boxSizeMarketCapRatio}
                    stretch={mapStretchFor(settingsModalProps.taxonomy)}
                    tile={mapTileMethod()}
                    canExclude={isCustom || isMarketry || !isLoggedIn}
                    colorScale={colorScale}
                    labelMinAreaPercent={boxLabelMinAreaPercent}
                    stockLabelMode={stockLabelMode}
                    stockPopupOnHover={stockPopupOnHover}
                    decimalPlaces={decimalPlaces}
                    topPickSectorKeys={topPickSectorKeys}
                    strongIndustryColor={strongIndustryColor}
                    zoomOutRequestDepth={zoomOutRequestDepth}
                    onZoomOutComplete={handleZoomOutComplete}
                  />
                </div>
              )}
              {/* 등락률 색상 범례 — 지도 우하단에 오른쪽 끝에 붙여 둔다. 이 줄만큼 지도 아래쪽이 올라온다. 로딩·오류·빈 화면에서도 면책 문구와 함께 맨 아래에 그대로 둔다. */}
              <div className="flex h-7 shrink-0 items-end justify-between gap-3 pl-[7px] pr-[7px]">
                <div className="flex h-7 min-w-0 items-end">
                  <DisclaimerNotice />
                </div>
                <ChangeRateBar swatches={settingsModalProps.legendSwatches} />
              </div>
              </div>
            </div>
          </div>
          {/* 설정창 위쪽 여백 7px — 위쪽 바의 누적·별도 토글 윗선과 맞춘 값이다. 아래는 붙인다. */}
          <div className={`flex shrink-0 pt-[7px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsSidebar
              {...settingsModalProps}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              boxSizeMarketCapRatio={boxSizeMarketCapRatio}
              onChangeBoxSizeMarketCapRatio={onChangeBoxSizeMarketCapRatio}
              pageLabel="Map"
              sectionOrder={MAP_SETTINGS_SECTION_ORDER}
              taxonomyAtBottom
              snapshotTime={data?.taxonomyUpdatedAt}
              stockCountLabel={`${toCount(visibleItems.length)}/${toCount(totalItemCount)}종목`}
              bookmarks={settingsBookmarks}
              onToggleBookmark={toggleSettingsBookmark}
              bookmarkLoginRequired={!isLoggedIn}
              onRequestLogin={() => requireLogin(`${pathname}${search}${hash}`)}
              onSelectTaxonomy={next => {
                settingsModalProps.onSelectTaxonomy(next)
                reset()
              }}
            >
              <SettingsSidebarGroup section="composition">
                <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
                <SettingsSectorChangeSection
                  value={sectorChangeFilter}
                  onChange={value => {
                    onChangeSectorChangeFilter(value)
                    reset()
                  }}
                  depth={sectorChangeDepth}
                  onChangeDepth={depth => {
                    onChangeSectorChangeDepth(depth)
                    reset()
                  }}
                  maxSelectableDepth={Math.max(1, settingsModalProps.topPickMaxSelectableDepth)}
                  noDataLimited={settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT'}
                />
                <SettingsStockChangeSection
                  value={stockChangeFilter}
                  onChange={value => {
                    onChangeStockChangeFilter(value)
                    reset()
                  }}
                />
                <SettingsExcludeSection {...settingsModalProps} afterStockChange />
              </SettingsSidebarGroup>
              <SettingsSidebarGroup section="industry">
                <SettingsSectorLevelSection {...settingsModalProps} showTopPick showStockDisplay={false} />
              </SettingsSidebarGroup>
              <SettingsSidebarGroup section="stockDisplay">
                <SettingsSectorLevelSection {...settingsModalProps} showTaxonomy={false} showDecimalPlaces />
              </SettingsSidebarGroup>
              {/* 북마크 탭 — 원래 탭의 항목을 같은 순서로 다시 그리고, 북마크한 항목만 보인다. */}
              <SettingsSidebarGroup section="favorites">
                <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
                <SettingsSectorChangeSection
                  value={sectorChangeFilter}
                  onChange={value => {
                    onChangeSectorChangeFilter(value)
                    reset()
                  }}
                  depth={sectorChangeDepth}
                  onChangeDepth={depth => {
                    onChangeSectorChangeDepth(depth)
                    reset()
                  }}
                  maxSelectableDepth={Math.max(1, settingsModalProps.topPickMaxSelectableDepth)}
                  noDataLimited={settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT'}
                />
                <SettingsStockChangeSection
                  value={stockChangeFilter}
                  onChange={value => {
                    onChangeStockChangeFilter(value)
                    reset()
                  }}
                />
                <SettingsExcludeSection {...settingsModalProps} afterStockChange />
                <SettingsSectorLevelSection {...settingsModalProps} showTopPick showStockDisplay={false} />
                <SettingsStockSizeSelector marketCapRatio={boxSizeMarketCapRatio} onChangeMarketCapRatio={onChangeBoxSizeMarketCapRatio} />
                <SettingsSectorLevelSection {...settingsModalProps} showTaxonomy={false} showDecimalPlaces />
                {strongIndustryColor && onChangeStrongIndustryColor && (
                  <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} />
                )}
              </SettingsSidebarGroup>
              <SettingsSidebarGroup section="colors">
                {strongIndustryColor && onChangeStrongIndustryColor && (
                  <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} />
                )}
                <SettingsColorSection {...settingsModalProps} colorEditorProps={colorEditorPanelProps} />
              </SettingsSidebarGroup>
            </SettingsSidebar>
          </div>
        </div>
      </div>

      {isShareOpen && (
        <CaptureModal
          onClose={() => setIsShareOpen(false)}
          onCopy={handleCopy}
          onDownload={handleDownload}
          copyLabel={copyLabel}
          downloadLabel={downloadLabel}
          isCopying={copyStatus === 'copying'}
          isDownloading={downloadStatus === 'downloading'}
          captureTarget={captureRef.current}
        />
      )}
    </div>
  )
}
