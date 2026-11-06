import AnimatedClockLabel from '@/components/AnimatedClockLabel'
import { resolveHeatmapColor } from '@/utils/heatmapColorScale'
import { useEffect, useRef, useState } from 'react'
import { useSettled } from '@/hooks/useSettled'
import { applyStockMoves, type StockMoves } from '@/utils/stockMoves'
import type { StockDrop } from '@/hooks/useStockDrag'
import { useSearchParams } from 'react-router-dom'
import NavBar from '@/components/NavBar'
import NavSubBar from '@/components/NavSubBar'
import NxtOnlyNotice from '@/components/NxtOnlyNotice'
import SettingsPanel, {
  SettingsPanelGroup,
  SettingsMarketValueSection,
  SettingsStockChangeSection,
  SettingsSectorLevelSection,
  SettingsExcludeSection,
  SettingsColorSection,
  SettingsStrongIndustryColorSection,
  SettingsTopPickSection,
  SettingsStockSizeSelector,
  SettingsSectorChangeSection,
  SettingsTextThresholdSection,
  SettingsStockMoveSection,
  SettingsStockPopupSection,
  type SettingsPanelSectionId,
} from '@/components/SettingsPanel'
import ScreenshotModal from '@/components/ScreenshotModal'
import Toolbar from '@/components/Toolbar'
import Heatmap from '@/components/Heatmap'
import { ChangeRateModeToggle } from '@/components/ToolbarControls'
import ToolbarModeText from '@/components/ToolbarModeText'
import ChangeRateBar from '@/components/ChangeRateBar'
import DisclaimerFooter from '@/components/DisclaimerFooter'
import EmptyMessage, { CustomPageBadgeLink, EmptyLogoMessage, EMPTY_DATA_MESSAGE, EMPTY_FILTER_MESSAGE, EMPTY_MINE_MESSAGE } from '@/components/EmptyMessage'
import Spinner from '@/components/Spinner'
import { REFRESH_BUTTON_SPIN_MS } from '@/utils/uiFeedback'
import NavBarPageActions, { PageRefreshButton, SNAPSHOT_REFRESH_HELP } from '@/components/NavBarPageActions'
import { FONT_BAR_MODE_STATUS } from '@/components/FontStyle'
import { useHeatmapDrilldown } from '@/hooks/useHeatmapDrilldown'
import { useIsLoggedIn, useSession } from '@/hooks/useSession'
import { useGlobalSettings } from '@/hooks/useGlobalSettings'
import { useSettingsPanelSide } from '@/hooks/useSettingsPanelSide'
import { useNativeFullscreen } from '@/hooks/useNativeFullscreen'
import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toCount, toSnapshotDateLabel } from '@/utils/format'
import { screenshotElementToClipboard, copyDataUrlToClipboard } from '@/utils/screenshotToClipboard'
import { CAPTURE_ID } from '@/utils/captureIds'
import { HOME_CAPTURE_FRAME_WIDTH, MAP_MOBILE_CAPTURE_FRAME_HEIGHT, screenshotElementToDataUrl } from '@/utils/screenshotToPreview'
import { ClockIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'
import SnapshotDatePicker from '@/components/SnapshotDatePicker'
import RangeExcludedStocks from '@/components/RangeExcludedStocks'
import ToolbarChip from '@/components/ToolbarChip'
import TaxonomyBadge from '@/components/TaxonomyBadge'
import { appAlert } from '@/utils/appDialogBus'
import { useLeaveToEntryPage } from '@/hooks/useLeaveToEntryPage'
import { mapStretchFor, mapTileMethod } from '@/utils/mapStretch'
import { limitDepth, flattenAllItems, type FilteredHeatmapSectorNode } from '@/hooks/useFilteredHeatmap'
import type { MarketQuery, HeatmapSectorNode, HeatmapItem } from '@/types/api'
import { isAdminSession } from '@/utils/adminAccess'

declare global {
  interface Window {
    marketryCaptureMap?: () => Promise<string>
  }
}

const MARKET_LABEL: Record<MarketQuery, string> = { KOSPI: 'KOSPI', KOSDAQ: 'KOSDAQ', ALL_STOCK: 'K-STOCK' }
// 종목·업종 헤더와 같은 방식 — 올리면 흰색 35% 덮개가 씌워진다(index.css의 hover와 같은 불투명도).
// 이동 경로의 이름이 몇 번째 업종 단계인지(0부터) — 마우스가 이미 그 이름 위에 있어서 툴팁에는 이름 대신 단계 이름만 쓴다. 업종은 최대 4단계(대분류·중분류·소분류·세분류)다.
const SECTOR_LEVEL_LABEL = ['대분류', '중분류', '소분류', '세분류']

const BREADCRUMB_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'

// 이름 오른쪽의 되돌아가기 표시 — 이름과 한 버튼이라서 올리면 함께 하이라이트된다.
function BreadcrumbBackIcon() {
  return <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
}

const MAP_SETTINGS_SECTION_ORDER: SettingsPanelSectionId[] = [
  'composition', 'industry', 'stockDisplay', 'colors',
]
const SPECIAL_MAP_SETTINGS_SECTION_ORDER: SettingsPanelSectionId[] = [...MAP_SETTINGS_SECTION_ORDER, 'special']

// "업종 단계" 슬라이더가 "끄기"(뎁스 0)일 때만 쓰는 합성 섹터 — 실제 섹터가 아니므로
// sectorId는 실제 값과 겹치지 않는 sentinel을 쓰고, isSelf로 매칭해 헤더 자체를 안 그리게 한다
// (드릴다운으로 들어온 섹터의 헤더를 breadcrumb과 중복되지 않게 숨기는 것과 동일한 메커니즘).
const FLAT_GROUP_SECTOR_ID = -1
const FLAT_GROUP_NAME = '__flat__'

function toFlatDisplayGroup(items: HeatmapItem[]): DisplayGroup {
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

const NO_STOCK_MOVES: StockMoves = {}

function toDisplayGroup(node: FilteredHeatmapSectorNode): DisplayGroup {
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
function collectItems(groups: DisplayGroup[]): HeatmapItem[] {
  const result: HeatmapItem[] = []
  for (const group of groups) {
    result.push(...group.items)
    result.push(...collectItems(group.children))
  }
  return result
}

// 섹터 제외/시가총액 구간 필터를 적용하기 "전" 원본 트리 기준으로, 지금 보고 있는 뎁스(path)에
// 해당하는 종목을 전부 모은다 — "제외된 개수까지 포함한 전체 리스트 개수"를 보여주기 위한 분모.
function collectRawItems(nodes: HeatmapSectorNode[]): HeatmapItem[] {
  const result: HeatmapItem[] = []
  for (const node of nodes) {
    result.push(...node.items)
    result.push(...collectRawItems(node.children))
  }
  return result
}

function findRawNodeByPath(nodes: HeatmapSectorNode[], path: string[]): HeatmapSectorNode | null {
  let node: HeatmapSectorNode | null = null
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

// keepPageLabel: K-STOCK 배지 위의 페이지 라벨(MAP)을 남긴다(텔레그램 판·스크린샷 창 모두, 홈 판의 HOME과 같은 모양). false를 주면 숨긴다.
function revealMobileCapture(cloned: Node, keepPageLabel = true) {
  if (!(cloned instanceof Element)) return
  const mobileFrame = cloned.querySelector<HTMLElement>('[data-map-mobile-capture-frame]')
  if (mobileFrame) mobileFrame.style.opacity = '1'
  const mobileCapture = cloned.querySelector<HTMLElement>('[data-map-mobile-capture]')
  if (mobileCapture) mobileCapture.style.opacity = '1'
  const toolbarLeft = cloned.querySelector<HTMLElement>('.main-toolbar > div:first-child')
  const toolbarRight = cloned.querySelector<HTMLElement>('.main-toolbar > div:last-child')
  if (mobileCapture && toolbarLeft) {
    const toolbar = document.createElement('div')
    toolbar.className = 'main-toolbar home-capture-toolbar relative mt-[3px] mb-0 flex h-7 w-full shrink-0 items-center overflow-hidden bg-ui-background/70 text-sm font-bold text-ui-white'
    // 복제본에 새로 넣는 요소는 클래스 스타일이 적용되지 않으므로 홈 판 툴바와 같은 위치·정렬은 인라인으로 준다.
    toolbar.style.marginTop = '3px'
    toolbar.style.height = '28px'
    toolbar.style.alignItems = 'center'
    const leftContent = toolbarLeft.cloneNode(true) as HTMLElement
    leftContent.style.minWidth = '0'
    leftContent.style.overflow = 'hidden'
    // 화면·브라우저 캡처·DOM 이미지 복제에서 첫 배지 폭을 동일하게 유지한다.
    // 복제 후 새 툴바에 끼운 노드는 .home-capture-toolbar 규칙이 이미지 렌더러에 적용되지 않을 수 있다.
    const modeBadge = leftContent.querySelector<HTMLElement>('.toolbar-mode-badge')
    if (modeBadge) {
      modeBadge.style.width = '100px'
      modeBadge.style.minWidth = '100px'
      modeBadge.style.maxWidth = '100px'
    }
    // 복제본은 버튼 크기·배치를 유지하되 항상 시계·시간을 표시한다. 원본 버튼의 호버·갱신 상태가
    // 캡처 스타일에 남으면 새로고침 아이콘만 찍힐 수 있다.
    const refreshButton = leftContent.querySelector<HTMLElement>('.nav-refresh-button')
    if (refreshButton) {
      const clockLabel = refreshButton.querySelector<HTMLElement>(':scope > span:first-child')
      if (clockLabel) {
        const staticClock = clockLabel.cloneNode(true) as HTMLElement
        staticClock.removeAttribute('aria-hidden')
        staticClock.classList.remove('invisible', 'group-hover/refresh:invisible', 'group-focus-visible/refresh:invisible')
        staticClock.querySelectorAll<HTMLElement>('.invisible').forEach(node => node.classList.remove('invisible'))
        refreshButton.replaceChildren(staticClock)
      }
      refreshButton.classList.remove('group/refresh')
      refreshButton.classList.remove('cursor-pointer')
      refreshButton.style.pointerEvents = 'none'
    }
    // 모바일 캡처에서는 종가·합산·단독 중 현재 기준만 남기고, 세 버튼 중 첫 칸에 둔다.
    const changeRateSelector = leftContent.querySelector<HTMLElement>('[data-change-rate-selector]')
    const changeRateButton = changeRateSelector?.querySelector<HTMLButtonElement>('[data-change-rate-mode]')
    if (changeRateButton && changeRateSelector) {
      leftContent.querySelector('[aria-label="등락률 기준 선택"]')?.remove()
      // 지금 툴바의 칩 모양 그대로 두고 메뉴 동작만 뺀다.
      changeRateButton.removeAttribute('aria-expanded')
      changeRateButton.removeAttribute('aria-haspopup')
      changeRateButton.style.pointerEvents = 'none'
      changeRateButton.style.transition = 'none'
    }
    // 모바일 캡처에서는 K-STOCK과 겹치지 않도록 MAP 페이지 라벨을 숨긴다.
    if (keepPageLabel) {
      // 라벨이 툴바 위쪽으로 살짝 걸쳐 있어 잘리지 않게 한다.
      toolbar.style.overflow = 'visible'
      leftContent.style.overflow = 'visible'
    } else {
      leftContent.querySelector('.font-roboto-latin > span.absolute')?.remove()
    }
    toolbar.append(leftContent)
    if (toolbarRight) {
      const rightContent = toolbarRight.cloneNode(true) as HTMLElement
      rightContent.style.minWidth = 'max-content'
      rightContent.style.width = 'max-content'
      rightContent.style.maxWidth = 'none'
      rightContent.style.flexShrink = '0'
      rightContent.style.overflow = 'visible'
      const badgeWrapper = rightContent.firstElementChild as HTMLElement | null
      if (badgeWrapper) {
        badgeWrapper.style.width = 'max-content'
        badgeWrapper.style.minWidth = 'max-content'
        badgeWrapper.style.maxWidth = 'none'
      }
      rightContent.querySelectorAll<HTMLElement>('.toolbar-badge, .toolbar-badge > span, .toolbar-badge .truncate').forEach(node => {
        node.style.minWidth = 'max-content'
        node.style.maxWidth = 'none'
        node.style.overflow = 'visible'
        node.style.textOverflow = 'clip'
      })
      toolbar.style.display = 'grid'
      toolbar.style.gridTemplateColumns = 'minmax(0, 1fr) max-content'
      toolbar.style.columnGap = '4px'
      leftContent.style.width = '100%'
      leftContent.style.minWidth = '0'
      toolbar.append(rightContent)
    }
    mobileCapture.querySelector('[data-map-mobile-toolbar-placeholder]')?.replaceWith(toolbar)

    // 캡처 폭에 따라 flex 레이아웃이나 이미지 변환 과정에서 각 칩의 높이가 달라 보이지 않도록
    // 화면 툴바와 같은 높이를 인라인으로 고정한다. 배지는 폭이 좁아도 줄어들지 않는다.
    toolbar.querySelectorAll<HTMLElement>('.toolbar-badge, .toolbar-badge-control, [data-toolbar-session-chip]').forEach(badge => {
      badge.style.boxSizing = 'border-box'
      badge.style.height = '26.25px'
      badge.style.minHeight = '26.25px'
      badge.style.maxHeight = '26.25px'
      badge.style.flexShrink = '0'
    })
  }
}

export default function MapPage() {
  const isLoggedIn = useIsLoggedIn()
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
    refetchHeatmap,
    isRefetchingHeatmap,
    sectorChangeMaxDepth,
    sectorChangeFilter,
    sectorChangeDepth,
    setSectorChangeFilter,
    setSectorChangeDepth,
    isLoading,
    isError,
    rootNodes,
    filteredRootNodes,
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
    setBoxLabelMinAreaPercent,
    stockLabelMode,
    stockPopupOnHover,
    setStockPopupOnHover,
    decimalPlaces,
    colorScale,
    handleExcludeSector,
  } = useGlobalSettings({ allowChangeRateMode: true })
  const { data: session } = useSession()
  const isAdmin = isAdminSession(session)
  // 특별 회원 탭은 특별 회원과 운영자가 쓴다.
  const isSpecialMember = isAdmin || (session?.authenticated === true && session.special === true)
  // 달력에서 지난 날짜를 골라 보는 중이면 시각·시간대·합산/단독 표시는 숨긴다(실시간 정보라서).
  const isPastSnapshot = pinnedSnapshotTime !== undefined

  const [searchParams, setSearchParams] = useSearchParams()
  const { isNativeFullscreen, handleToggleNativeFullscreen } = useNativeFullscreen()
  const [isShareOpen, setIsShareOpen] = useState(false)
  const [isMobileScreenshotSelected, setIsMobileScreenshotSelected] = useState(false)
  // 실험 탭의 설정은 어디에도 저장하지 않는다. 종목 이동의 켜기 상태와 옮긴 결과(stockMoveState)도 이 화면의 메모리에만 둔다.
  const [stockMoveEnabled, setStockMoveEnabled] = useState(false)
  const [stockMoveState, setStockMoveState] = useState<{ scope: string; moves: StockMoves }>({ scope: '', moves: {} })
  // 텔레그램 렌더러가 이 함수를 호출해 화면 캡처와 같은 글꼴·여백·배율로 저장한다.
  const isMobileCaptureMode = searchParams.get('capture') === 'mobile'
  const [isMobileCaptureReady, setIsMobileCaptureReady] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const { isOnLeft: isSettingsOnLeft, toggleSide: toggleSettingsSide, rowRef: settingsRowRef } = useSettingsPanelSide()
  // null이 아니면 Heatmap이 해당 뎁스로 줄어드는 줌아웃 애니메이션을 재생하고, 끝나면
  // handleZoomOutComplete를 불러서 실제 이동을 한다 — 애니메이션 도중엔 path/groups를 먼저 바꾸지 않는다.
  const [zoomOutRequestDepth, setZoomOutRequestDepth] = useState<number | null>(null)
  const screenshotRef = useRef<HTMLDivElement>(null)

  const { path, setPath, currentNode, currentSiblings, enterSector, goToDepth, reset } = useHeatmapDrilldown(filteredRootNodes)
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
  const baseGroups: DisplayGroup[] = isFullyFlattened
    ? [toFlatDisplayGroup(flattenAllItems(currentNode ? [currentNode] : currentSiblings))]
    : displayNode
      ? [toDisplayGroup(displayNode)]
      : displaySiblings.map(toDisplayGroup)
  // 실험 탭의 종목 이동 — 끌어서 옮긴 종목을 화면에서만 도착 업종으로 옮겨 그린다. 메모리에만 두고(서버·브라우저에 저장하지 않는다),
  // 켜기를 끄거나 시장·분류를 바꾸면 쓰지 않으며 다른 페이지로 가면 상태째 사라진다.
  const stockMoveScope = `${market}|${settingsModalProps.taxonomy}`
  const stockMoves = stockMoveEnabled && stockMoveState.scope === stockMoveScope ? stockMoveState.moves : NO_STOCK_MOVES
  const groups = applyStockMoves(baseGroups, stockMoves)
  const visibleItems = collectItems(groups)
  // 지금 뎁스(path) 기준으로, 섹터 제외/시가총액 구간 필터를 적용하기 전 원본 트리에 있는 전체 종목 수.
  const rawCurrentNode = findRawNodeByPath(rootNodes, path)
  // 시장 전체를 볼 때는 정지로 뺀 종목도 분모에 더해 전체 종목 수와 맞춘다(한 업종 안으로 들어가면 그 업종 종목만 센다).
  const totalItemCount = collectRawItems(rawCurrentNode ? [rawCurrentNode] : rootNodes).length + (rawCurrentNode ? 0 : (data?.suspendedStockCount ?? 0))
  // 내 분류에 종목이 하나도 배정되지 않은 상태 — 필터·시총 범위로 다 가려진 경우나 한 업종 안으로 들어간 경우와 구분하려고 전체 트리로 센다.
  const isMineEmpty = isCustom && collectRawItems(rootNodes).length === 0

  // 상단 오른쪽 분류 배지(설정창 분류 선택 버튼과 같은 청록색).
  const modeStatusText = <TaxonomyBadge taxonomy={taxonomy} strongIndustryColor={strongIndustryColor} />

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
      void appAlert('해당 업종을 찾지 못했습니다.\n이전 화면으로 돌아갑니다.', { title: '이동 실패' }).then(leaveToEntryPage)
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
  // 나간다. 앞으로가기(⌘])는 들어갔던 단계로 다시 내려간다. 각 칸은 그 시점의 경로(heatmapPath)를 가진다.
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
        window.history.replaceState({ ...(window.history.state ?? {}), heatmapPath: path }, '')
        baseDepthRef.current = depth
        historyDepthRef.current = depth
        historyPathnameRef.current = window.location.pathname
      } else if (depth > historyDepthRef.current) {
        for (let k = historyDepthRef.current + 1; k <= depth; k++) {
          window.history.pushState({ ...(window.history.state ?? {}), heatmapPath: path.slice(0, k) }, '')
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
        else window.history.replaceState({ ...(window.history.state ?? {}), heatmapPath: path.slice(0, depth) }, '')
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 길이가 바뀔 때만 반응하면 된다(path 내용은 그때의 값을 쓴다)
  }, [path.length])
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (historyConsumingRef.current) {
        historyConsumingRef.current = false
        if (pendingBasePathRef.current !== null) {
          window.history.replaceState({ ...(window.history.state ?? {}), heatmapPath: pendingBasePathRef.current }, '')
          pendingBasePathRef.current = null
        }
        return
      }
      // 이 지도 화면 안에서의 이동만 다룬다 — 다른 페이지로 나가는 뒤로가기는 그대로 둔다.
      if (!window.location.pathname.startsWith('/map')) return
      const target: string[] = Array.isArray(e.state?.heatmapPath) ? e.state.heatmapPath : []
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
    if (!previewSrc && !screenshotRef.current) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (screenshotRef.current) await screenshotElementToClipboard(screenshotRef.current)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }


  // 끌어서 놓은 종목을 화면에서만 옮긴다. 저장되지 않는다는 안내는 켤 때 한 번만 띄운다.
  const handleMoveStock = (drop: StockDrop) => {
    setStockMoveState(previous => ({
      scope: stockMoveScope,
      moves: { ...(previous.scope === stockMoveScope ? previous.moves : {}), [drop.stockCode]: drop.targetSectorId },
    }))
  }

  const handleChangeStockMoveEnabled = (enabled: boolean) => {
    setStockMoveEnabled(enabled)
    if (enabled) {
      void appAlert('종목 이동 기능은 저장되지 않습니다.\n임시로 살펴보시고 커스텀 페이지를 이용바랍니다.', { title: '종목 이동' })
    }
  }

  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'

  // 렌더러용 모바일 판 — 데이터가 오고 히트맵 배치가 끝나면 스크린샷 창이 복제본에 하던 것(툴바 채우기·보이게 하기)을 화면의 틀에 한 번 하고 준비됐다고 알린다.
  const canShowMobileCapture = isMobileCaptureMode && !isLoading && !isError && visibleItems.length > 0
  // 툴바 시계가 새 시각으로 움직이는 동안(1초)에는 복제하지 않는다 — 종가·단독 기준으로 옮겨 가면 시각이 바뀐다.
  const isMobileCaptureSettled = useSettled(canShowMobileCapture, `${data?.snapshotTime}|${changeRateChoice}`, 1300)
  useEffect(() => {
    if (!isMobileCaptureSettled || isMobileCaptureReady) return
    let rafId = 0
    const revealWhenLaidOut = () => {
      if (!document.querySelector('[data-map-mobile-capture] [data-heatmap-layout-ready="true"]')) {
        rafId = requestAnimationFrame(revealWhenLaidOut)
        return
      }
      revealMobileCapture(document.body, true)
      setIsMobileCaptureReady(true)
    }
    rafId = requestAnimationFrame(revealWhenLaidOut)
    return () => cancelAnimationFrame(rafId)
  }, [isMobileCaptureSettled, isMobileCaptureReady])

  useEffect(() => {
    if (!isMobileCaptureMode || !isMobileCaptureReady) return
    const capture = () => {
      const root = screenshotRef.current
      if (!root) throw new Error('캡처할 지도 영역이 없습니다.')
      return screenshotElementToDataUrl(root, '[data-map-mobile-capture-frame]', 'element', revealMobileCapture)
    }
    window.marketryCaptureMap = capture
    return () => { delete window.marketryCaptureMap }
  }, [isMobileCaptureMode, isMobileCaptureReady])

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-ui-background">
      <NavBar />
      <NavSubBar
        // 지금 보는 시장을 메뉴 목록에서 다시 고르면 처음 단계(드릴다운 맨 위)로 돌아간다.
        onReselectCurrent={() => handleGoToDepth(0)}
        actions={
          <NavBarPageActions
            onRefresh={refetchHeatmap}
            isRefreshing={isRefetchingHeatmap}
            onToggleSettings={() => settingsModalProps.onOpenChange(!settingsModalProps.isOpen)}
            isSettingsOpen={settingsModalProps.isOpen}
            onOpenShare={() => setIsShareOpen(true)}
            isScreenshotOpen={isShareOpen}
            isNativeFullscreen={isNativeFullscreen}
            onToggleFullscreen={handleToggleNativeFullscreen}
            showRefresh={false}
          />
        }
      />
      <div className="flex min-h-0 flex-1">
        {/* 공유·텔레그램 모두 [세 번째 바+본문] 열만 스크린샷으로 찍어 설정창을 제외한다. */}
        <div
          ref={settingsRowRef}
          className="main-settings-row relative z-10 -mt-[15px] flex min-h-0 min-w-0 flex-1 bg-ui-background"
        >
          {/* min-w-0: 이 컬럼의 자동 최소 폭을 0으로 눌러서(overflow: visible이면 내부 콘텐츠의
              min-content 폭을 그대로 강제해서 사이드바 쪽을 밀어냄) 창을 좁혀도 사이드바(w-80)가
              항상 같은 폭을 유지하게 한다 — 내부 콘텐츠(히트맵)가 넘치면 이 컬럼 안에서만 처리된다. */}
          <div ref={screenshotRef} data-main-area data-captureid={CAPTURE_ID.MAP} data-capture-ready={!isLoading} className="relative mt-[4px] flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
            {/* 왼쪽은 마켓·기간·시계·시간대 묶음, 오른쪽 끝은 프로필(사진 + 거래소·MARKETRY). 두 묶음이 같은 줄에서 서로 밀어내므로
                창이 좁아져도 겹치지 않고, 부족하면 오른쪽 글자가 먼저 줄어든다. */}
            <Toolbar>
              <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
                <ToolbarModeText page="MAP" label={MARKET_LABEL[market]} />
                {/* 로딩·오류·빈 화면에서도 시계·시간대·합산/단독을 제자리에 둔다. 데이터가 없으면 시각 글자만 비어 있다. */}
                <>
                  {/* 데이터가 없어도 날짜·시각 자리는 같은 폭으로 잡아 둬서 뒤의 시장 시간대 표시가 당겨지지 않게 한다. */}
                  <ToolbarChip bare tone={isPastSnapshot ? 'text-[var(--brand)]' : 'text-ui-white'}>
                  <SnapshotDatePicker
                    market={market}
                    holidayColor={resolveHeatmapColor(8, colorScale)}
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
                  {isPastSnapshot && rangeStartTime && pinnedSnapshotTime && rangeExcludedStocks.length > 0 && (
                      <ToolbarChip bare tone="text-ui-muted">
                        <RangeExcludedStocks excludedStocks={rangeExcludedStocks} />
                      </ToolbarChip>
                  )}
                  {isPastSnapshot === false && (
                    <ToolbarChip bare tone="text-ui-white">
                      <PageRefreshButton
                        cell
                        onRefresh={refetchHeatmap}
                        isRefreshing={isRefetchingHeatmap}
                        helpText={SNAPSHOT_REFRESH_HELP}
                        minSpinDurationMs={REFRESH_BUTTON_SPIN_MS}
                      >
                        <AnimatedClockLabel snapshotTime={data?.snapshotTime ?? null} icon={<ClockIcon strokeWidth={2.2} className="h-[15px] w-[15px] shrink-0" aria-hidden />} />
                      </PageRefreshButton>
                    </ToolbarChip>
                  )}
                {/* 시장 시간대 말머리와 합산/단독 — 시간과 관련된 표시라 시계 옆에 붙인다. */}
                {isPastSnapshot === false && (
                  <span className="flex shrink-0">
                    <ChangeRateModeToggle basis={changeRateChoice} visible={isAfterHoursControlsVisible} selectable={isAfterHoursSelectable} onChange={onChangeChangeRateMode} />
                  </span>
                )}
                </>
              </div>
              {/* 맨 오른쪽 — 분류명을 설정창 업종 분류 선택 버튼 모양으로 표시하고, 좁아지면 이름을 줄인다. 로딩·오류·빈 화면에서도 제자리에 둔다. */}
              <div className={`${FONT_BAR_MODE_STATUS} flex min-w-0 items-center justify-end text-ui-muted`}>{modeStatusText}</div>
            </Toolbar>
            <div className="flex min-h-0 flex-1">
              <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-ui-background">
              <NxtOnlyNotice active={nxtOnly && pinnedSnapshotTime === undefined && rangeStartTime === undefined} window={nxtOnlyWindow} ready={!isLoading && !isError} nodes={rootNodes} />
              {path.length > 0 && (
                // 이름마다 "그 단계로만" 이동하는 링크다 — 줄 전체를 눌러 전체로 가던 동작은 없앴다. 지금 보고 있는
                // 마지막 이름은 링크가 아니라 현재 위치 표시(흰색)다.
                <nav
                  aria-label="업종 이동 경로"
                  className="flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold"
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
                        data-hint={`${SECTOR_LEVEL_LABEL[index]}로 돌아가기`}
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
                  <Spinner errorMessage="데이터를 불러오지 못했습니다." onRetry={refetchHeatmap} />
                </div>
              ) : visibleItems.length === 0 ? (
                isMineEmpty ? (
                  <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
                    <CustomPageBadgeLink />
                  </EmptyLogoMessage>
                ) : (
                  <div className="relative flex-1">
                    <EmptyMessage
                      message={totalItemCount === 0 ? EMPTY_DATA_MESSAGE : EMPTY_FILTER_MESSAGE}
                      topClass="-top-1"
                    />
                  </div>
                )
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  {/* 바깥 main-settings-row에서 양옆·설정창 사이 여백을 관리한다. */}
                  <Heatmap
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
                    stockMoveEnabled={stockMoveEnabled && !isMobileCaptureMode}
                    onMoveStock={handleMoveStock}
                    onZoomOutComplete={handleZoomOutComplete}
                  />
                </div>
              )}
              {/* 등락률 색상 범례 — 지도 우하단에 오른쪽 끝에 붙여 둔다. 이 줄만큼 지도 아래쪽이 올라온다. 로딩·오류·빈 화면에서도 면책 문구와 함께 맨 아래에 그대로 둔다. */}
              <DisclaimerFooter rightContent={<ChangeRateBar swatches={settingsModalProps.legendSwatches} />} />
              </div>
            </div>
          {/* 모니터 캡처에서는 모바일용 히트맵을 만들지 않아 화면 렌더링과 DOM 복제 비용을 줄인다. */}
          {((isShareOpen && isMobileScreenshotSelected) || isMobileCaptureMode) && !isLoading && !isError && visibleItems.length > 0 && (
            <div
              aria-hidden="true"
              data-map-mobile-capture-frame
              data-captureid={isMobileCaptureMode ? 'map-mobile-capture' : undefined}
              data-capture-ready={isMobileCaptureMode ? isMobileCaptureReady : undefined}
              // 모바일 캡처와 텔레그램 지도는 동일한 5:8 프레임과 여백을 쓴다.
              style={{ opacity: 0, width: `${HOME_CAPTURE_FRAME_WIDTH}px`, height: `${MAP_MOBILE_CAPTURE_FRAME_HEIGHT}px`, padding: '4px', boxSizing: 'border-box' }}
              className="pointer-events-none absolute z-[60] left-0 top-0 bg-ui-background"
            >
            <div
              aria-hidden="true"
              data-map-mobile-capture
              style={{ opacity: 0, width: '100%', height: '100%' }}
              className="flex flex-col bg-ui-background"
            >
              <div data-map-mobile-toolbar-placeholder className="main-toolbar relative mt-[3px] mb-0 h-7 w-full shrink-0 bg-ui-background/70" />
              <div aria-hidden="true" className="h-2 shrink-0" />
              {path.length > 0 && (
                <nav aria-label="업종 이동 경로" className="flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold">
                  <span className={BREADCRUMB_LINK_CLASS}>{MARKET_LABEL[market]}<BreadcrumbBackIcon /></span>
                  {path.map((name, index) => (
                    <span key={`${name}-${index}`} className={index === path.length - 1 ? 'px-2 text-[var(--accent)]' : BREADCRUMB_LINK_CLASS}>{name}{index < path.length - 1 && <BreadcrumbBackIcon />}</span>
                  ))}
                </nav>
              )}
              <div className="flex min-h-0 flex-1 flex-col">
                <Heatmap
                  groups={groups}
                  selfSectorName={isFullyFlattened ? FLAT_GROUP_NAME : (currentNode?.sectorName ?? null)}
                  depth={path.length}
                  onSelectSector={() => {}}
                  onExcludeSector={() => {}}
                  heightClassName="min-h-0 flex-1"
                  marketValueDepthRange={marketValueDepthRange}
                  weightedAvgDepthRange={weightedAvgDepthRange}
                  simpleAvgDepthRange={simpleAvgDepthRange}
                  upDownCountDepthRange={upDownCountDepthRange}
                  boxSizeMarketCapRatio={boxSizeMarketCapRatio}
                  stretch={mapStretchFor(settingsModalProps.taxonomy)}
                  tile={mapTileMethod()}
                  canExclude={false}
                  colorScale={colorScale}
                  labelMinAreaPercent={boxLabelMinAreaPercent}
                  stockLabelMode={stockLabelMode}
                  stockPopupOnHover={false}
                  decimalPlaces={decimalPlaces}
                  topPickSectorKeys={topPickSectorKeys}
                  strongIndustryColor={strongIndustryColor}
                  zoomOutRequestDepth={null}
                  onZoomOutComplete={() => {}}
                />
              </div>
            </div>
            </div>
          )}
          </div>
          {/* 설정창 위쪽 여백 4px — 헤더를 위로 3px 늘리고 아래 구분선 위치는 유지한다. */}
          <div className={`flex shrink-0 pt-[4px] ${isSettingsOnLeft ? 'order-first' : ''}`}>
            <SettingsPanel
              {...settingsModalProps}
              isOnLeft={isSettingsOnLeft}
              onToggleSide={toggleSettingsSide}
              pageLabel="Map"
              sectionOrder={isSpecialMember ? SPECIAL_MAP_SETTINGS_SECTION_ORDER : MAP_SETTINGS_SECTION_ORDER}
              taxonomyAtBottom
              snapshotTime={data?.taxonomyUpdatedAt}
              stockCountLabel={`${toCount(visibleItems.length)}/${toCount(totalItemCount)}종목`}
              onSelectTaxonomy={next => {
                settingsModalProps.onSelectTaxonomy(next)
                reset()
              }}
            >
              <SettingsPanelGroup section="composition">
                <SettingsMarketValueSection {...settingsModalProps} showDivider={false} />
                <SettingsExcludeSection {...settingsModalProps} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="industry">
                <SettingsSectorLevelSection {...settingsModalProps} showStockDisplay={false} />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="stockDisplay">
                <SettingsStockSizeSelector marketCapRatio={boxSizeMarketCapRatio} onChangeMarketCapRatio={onChangeBoxSizeMarketCapRatio} />
                <SettingsSectorLevelSection {...settingsModalProps} showTaxonomy={false} showDecimalPlaces />
              </SettingsPanelGroup>
              <SettingsPanelGroup section="colors">
                <SettingsColorSection {...settingsModalProps} colorEditorProps={colorEditorPanelProps} />
                {strongIndustryColor && onChangeStrongIndustryColor && (
                  <SettingsStrongIndustryColorSection color={strongIndustryColor} onChange={onChangeStrongIndustryColor} fixed={settingsModalProps.taxonomy !== 'MINE'} />
                )}
                <SettingsTopPickSection {...settingsModalProps} />
              </SettingsPanelGroup>
              {isSpecialMember && <SettingsPanelGroup section="special">
                <div className="settings-plain-content">
                  <SettingsStockChangeSection
                    value={stockChangeFilter}
                    onChange={value => {
                      onChangeStockChangeFilter(value)
                      reset()
                    }}
                  />
                  <SettingsSectorChangeSection
                    value={sectorChangeFilter}
                    onChange={setSectorChangeFilter}
                    depth={sectorChangeDepth}
                    onChangeDepth={setSectorChangeDepth}
                    maxSelectableDepth={sectorChangeMaxDepth}
                    noDataLimited={settingsModalProps.taxonomy === 'KRX' || settingsModalProps.taxonomy === 'NXT'}
                  />
                  <SettingsStockMoveSection enabled={stockMoveEnabled} onChange={handleChangeStockMoveEnabled} />
                  <SettingsStockPopupSection stockPopupOnHover={stockPopupOnHover} onChangeStockPopupOnHover={setStockPopupOnHover} />
                  <SettingsTextThresholdSection value={boxLabelMinAreaPercent} onChange={setBoxLabelMinAreaPercent} />
                </div>
              </SettingsPanelGroup>}
            </SettingsPanel>
          </div>
        </div>
      </div>

      {isShareOpen && (
        <ScreenshotModal
          onClose={() => {
            setIsShareOpen(false)
            setIsMobileScreenshotSelected(false)
          }}
          onCopy={handleCopy}
          copyLabel={copyLabel}
          isCopying={copyStatus === 'copying'}
          screenshotTarget={screenshotRef.current}
          captureReady={!isLoading}
          emptyPreview={isMineEmpty && !isLoading && !isError ? (
            <EmptyLogoMessage message={EMPTY_MINE_MESSAGE}>
              <CustomPageBadgeLink />
            </EmptyLogoMessage>
          ) : undefined}
          mobileRegionOption={{ label: '모바일', selector: '[data-map-mobile-capture-frame]', mode: 'element', onCloneNode: revealMobileCapture, monitorHorizontalPadding: 4 }}
          onMobileSelectionChange={setIsMobileScreenshotSelected}
        />
      )}
    </div>
  )
}
