import { SlidingHighlight } from '@/components/SlidingHighlight'
import { CountLabelWithBadge } from '@/components/KindBadge'
import { Children, Fragment, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DepthMetric } from '@/hooks/useGlobalSettings'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'
import type { StockChangeFilter, SectorChangeFilter } from '@/hooks/useFilteredTreemap'
import { hexToHsl, type ColorScaleConfig } from '@/utils/treemapColorScale'
import TreemapColorThresholdEditorPanel, { type ColorThresholdEditorProps } from '@/components/TreemapColorThresholdEditorPanel'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import SettingsDropdown from '@/components/SettingsDropdown'
import { HistoryIcon, RefreshIcon, ReturnArrowIcon } from '@/components/icons/AppIcons'
import type { MarketValueTierItem } from '@/types/api'
import { FONT_BAR_TIME_SHAPE } from '@/components/FontStyle'
import { ACCENT_PALETTE } from '@/utils/accentPalette'
import { TAXONOMY_SELECT_TITLE, TAXONOMY_NAMES, type TaxonomyKey } from '@/utils/taxonomyNames'
import { MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO, toSnapshotDateLabel, toSnapshotTimeOnlyLabel } from '@/utils/format'
import { useIsLoggedIn } from '@/hooks/useSession'
import { useCustomPreferences } from '@/hooks/useCustomPreferences'
import { commitDrafts, discardDrafts, useHasDrafts } from '@/utils/settingsDraft'
import { BOOKMARK_ORDER, type SettingsBookmarkId } from '@/utils/settingsBookmarks'
import Spinner from '@/components/Spinner'
import { REFRESH_FEEDBACK_MIN_DURATION_MS } from '@/utils/uiFeedback'
import { appAlert, appConfirm } from '@/utils/appDialogBus'

export type { SettingsBookmarkId }
export type SettingsPanelSectionId = 'favorites' | 'composition' | 'industry' | 'stockDisplay' | 'colors' | 'adminOps' | 'adminMoved'

interface SettingsPanelGroupProps {
  section: SettingsPanelSectionId
  children?: ReactNode
}

// 각 페이지가 자기 설정을 참조 탭 아래에 배치한다. SettingsPanel는 활성 탭의 그룹만 렌더링한다.
export function SettingsPanelGroup({ children }: SettingsPanelGroupProps) {
  return <>{children}</>
}

// 제목 바로 아래에 항상 보이는 한 줄 설명 — 제목만으로 뜻이 안 와닿는 항목을 물음표 없이 이해하게 한다.
// 한 줄(16px) + 위 간격(4px)이라 높이를 20px로 계산해서 index.css의 탭 정렬 값을 맞춘다.
// dimmed: 그 항목의 토글이 꺼져 있을 때 제목 줄만 밝게 두고 설명과 조작부를 함께 옅게 한다(조작부는 호출부가 옅게 한다).
function SettingDescription({ children, dimmed = false }: { children: ReactNode; dimmed?: boolean }) {
  return <p className={`settings-description mt-1 max-w-[16rem] text-xs/4 font-medium text-ui-muted ${dimmed ? 'opacity-35' : ''}`}>{children}</p>
}

// 좌우 이동 탭을 "Basis" 줄 높이로 옮기고, 그 줄 위에 구분선이 있으면(아래쪽 Basis) 탭을 그 선까지 키운 뒤 아래도 같은 길이만큼 대칭으로
// 키운다. 그릴 때마다 재는 값이라 상태가 아니라 DOM에 바로 쓴다(상태로 두면 다시 그리기가 이어진다). 해당 줄이 없으면 가운데·기본 크기로 둔다.
// Basis 줄이 없는 페이지(관리자)에서 좌우 이동 탭을 다른 페이지(Basis 줄에 맞춘 자리)와 같은 곳에 두는 값 — 설정창 아래 끝에서 66px 위, 높이 50px.
const SIDE_TAB_FROM_BOTTOM = 66
const SIDE_TAB_HEIGHT = 50

function alignSideTab(outerElement: HTMLElement | null, tab: HTMLElement | null, fixedLikeBasis = false) {
  if (!outerElement || !tab) return
  const outer = outerElement.getBoundingClientRect()
  const title = outerElement.querySelector('[data-map-select-title]')?.getBoundingClientRect()
  if (!title && fixedLikeBasis) {
    // 탭은 style.top이 탭의 가운데 줄(위에서 -50% 이동)이라, 탭의 아래 끝이 설정창 아래 끝에서 66px 위에 오도록 가운데 줄을 구한다.
    const parentTop = (tab.offsetParent as HTMLElement | null)?.getBoundingClientRect().top ?? outer.top
    tab.style.top = `${Math.round(outer.bottom - SIDE_TAB_FROM_BOTTOM - SIDE_TAB_HEIGHT / 2 - parentTop)}px`
    tab.style.height = `${SIDE_TAB_HEIGHT}px`
    return
  }
  const topLine = outerElement.querySelector('[data-map-select-top-line]')?.getBoundingClientRect()
  const center = title ? title.top + title.height / 2 : null
  tab.style.top = center === null ? '' : `${Math.round(center - outer.top)}px`
  const half = center !== null && topLine ? Math.round(center - topLine.top) : null
  tab.style.height = half !== null && half > 16 ? `${half * 2}px` : ''
}

// 도움말 말풍선이 설정창 가장자리에서 띄우는 최소 간격.
const HELP_TOOLTIP_MARGIN = 6
const SETTINGS_LOAD_WAIT_MS = 4000
// 하단 업종 분류·좌우 이동 버튼·분류 선택 버튼 영역은 앞으로도 항상 같은 배경색을 사용한다.
const TAXONOMY_BACKGROUND_COLOR = 'var(--ui-panel)'

// 말풍선 폭은 가장 긴 줄에 맞춘다(w-max whitespace-pre) — 줄바꿈은 문구마다 \n(문자열) 또는 <br />(JSX)로 직접 정한다. 줄 하나가 설정창(18rem)
// 안에 들어와야 하니 한 줄을 23글자 안쪽으로 쓴다.
function SettingHelpBubble({ label, description, bookmarkId }: { label: string; description: ReactNode; bookmarkId?: SettingsBookmarkId }) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ left: 8, top: 8 })

  useLayoutEffect(() => {
    if (!isOpen) return

    const updatePosition = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const tooltip = tooltipRef.current?.getBoundingClientRect()
      if (!anchor || !tooltip) return

      // 설정창 밖으로 나가지 않게 가둔다 — 아이콘 왼쪽 끝에 맞추되 설정창 오른쪽에 걸리면 안쪽으로 밀고, 아래에 자리가 모자라면 아이콘 위로 뒤집는다.
      const sidebar = buttonRef.current?.closest('[data-settings-panel]')?.getBoundingClientRect()
      const bounds = sidebar ?? { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
      const margin = HELP_TOOLTIP_MARGIN
      const left = Math.max(bounds.left + margin, Math.min(anchor.left, bounds.right - tooltip.width - margin))
      let top = anchor.bottom + 4
      if (top + tooltip.height > bounds.bottom - margin) {
        const above = anchor.top - tooltip.height - 4
        top = above >= bounds.top + margin ? above : Math.max(bounds.top + margin, bounds.bottom - tooltip.height - margin)
      }
      setTooltipPosition({ left, top })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen])

  return (
    <>
    <span className="relative ml-1 inline-flex shrink-0 align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label} 설명`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        onBlur={event => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) setIsOpen(false)
        }}
        className="inline-flex h-4 w-4 items-center justify-center border-0 bg-transparent p-0 text-ui-muted hover:text-brand focus-visible:text-brand focus-visible:outline focus-visible:outline-1"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.35" />
          <path d="M6.25 6.05a1.85 1.85 0 1 1 3.55.78c-.48.86-1.8 1.06-1.8 2.52" />
          <circle cx="8" cy="11.75" r="0.55" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {isOpen && (
        <span
          ref={tooltipRef}
          role="tooltip"
          style={{ position: 'fixed', left: tooltipPosition.left, top: tooltipPosition.top }}
          className={`z-50 w-max whitespace-pre ${HINT_BUBBLE_CLASS}`}
        >
          {description}
        </span>
      )}
    </span>
    {bookmarkId && <BookmarkButton id={bookmarkId} label={label} />}
    </>
  )
}

// 북마크한 설정 항목을 북마크 탭에 그대로 다시 그리기 위한 공유 상태. 항목 컴포넌트는 같은 코드를 두 곳(원래 탭,
// 북마크 탭)에서 쓰고, mode로 어디서 그려지는지 구분한다. 북마크 기능을 켜지 않은 페이지는 enabled=false라 아무것도 안 보인다.
interface SettingsBookmarkContextValue {
  enabled: boolean
  mode: 'source' | 'bookmark'
  ids: readonly string[]
  // 북마크 탭에서 보여줄 "원래 위치" 번호(예: "1-2") — 탭 번호-항목 번호.
  numbers: Partial<Record<SettingsBookmarkId, string>>
  // 북마크 탭에서 첫 번째로 표시할 항목.
  firstId?: SettingsBookmarkId
  onToggle: (id: SettingsBookmarkId) => void
}

// 설정 반영 때 설정창 전체에 로딩 화면을 잠깐 덮는 실행기 — 저장·되돌리기와 같은 로딩 화면을 하위 항목(색상 초기화 등)도 쓰게 한다.
const SettingsFeedbackContext = createContext<(action: () => void) => void>(action => action())

const SettingsBookmarkContext = createContext<SettingsBookmarkContextValue>({
  enabled: false,
  mode: 'source',
  ids: [],
  numbers: {},
  onToggle: () => {},
})

// 북마크 탭에서 선택하지 않은 항목은 숨기고, 선택한 항목은 북마크 전용 간격으로 표시한다.
function bookmarkItemClass(ctx: SettingsBookmarkContextValue, id: SettingsBookmarkId) {
  if (ctx.mode !== 'bookmark') return ''
  if (!ctx.ids.includes(id)) return 'hidden'
  return `settings-bookmark-item ${ctx.firstId === id ? 'settings-bookmark-first' : ''}`
}

function BookmarkButton({ id, label }: { id: SettingsBookmarkId; label: string }) {
  const { enabled, ids, onToggle } = useContext(SettingsBookmarkContext)
  if (!enabled) return null
  const active = ids.includes(id)
  return (
    <button
      type="button"
      aria-label={`${label} 북마크${active ? ' 해제' : ''}`}
      aria-pressed={active}
      data-hint={active ? '북마크 해제' : '북마크 추가'}
      onClick={() => onToggle(id)}
      className={`ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 ${active ? 'text-brand' : 'text-ui-muted hover:text-brand focus-visible:text-brand'}`}
    >
      {/* 설정창 메뉴 줄의 북마크 아이콘(SettingsSectionIcon)과 같은 모양이다. 14px에서 선 2.1이 화면에서 약 1.2px로 보인다. */}
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 7v14l-6-4l-6 4v-14a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4" />
      </svg>
    </button>
  )
}

// 항목 제목 + 북마크 버튼. 북마크 탭에서는 번호를 자동 카운터 대신 원래 위치 번호로 보여준다.
function SettingTitle({ bookmarkId, className = '', help = false, children }: { bookmarkId: SettingsBookmarkId; className?: string; help?: boolean; children: string }) {
  const { mode, numbers } = useContext(SettingsBookmarkContext)
  const number = mode === 'bookmark' ? numbers[bookmarkId] : undefined
  return (
    <>
      <span className={`settings-section-num ${number ? 'settings-bookmark-num' : ''} ${className}`} data-num={number}>{children}</span>
      {!help && <BookmarkButton id={bookmarkId} label={children} />}
    </>
  )
}

const SETTINGS_SECTIONS: { id: SettingsPanelSectionId; label: string; icon: SettingsSectionIconName }[] = [
  { id: 'composition', label: '종목 구성', icon: 'composition' },
  { id: 'industry', label: '업종 분류', icon: 'industry' },
  { id: 'stockDisplay', label: '종목 박스', icon: 'stock-display' },
  { id: 'colors', label: '색상', icon: 'colors' },
  { id: 'favorites', label: '북마크', icon: 'favorites' },
  // 관리자 페이지 전용 탭 — 맨 뒤에 붙여서 위 탭 번호(1~5)는 그대로다.
  { id: 'adminOps', label: '운영', icon: 'admin-ops' },
  { id: 'adminMoved', label: '미사용', icon: 'admin-moved' },
]

// 탭 제목에는 숫자를 표시하지 않지만 북마크와 안내 말풍선에는 원래 설정 위치("탭 번호-항목 번호", 예: 2-1)를 표기한다.
// 탭 번호는 SETTINGS_SECTIONS 순서에서, 항목 번호는 SETTING_ITEM_POSITIONS의 탭 안 순서에서 만들어서
// 탭 순서나 항목 순서를 바꾸면 북마크와 말풍선의 번호가 함께 바뀐다(BOOKMARK_ORDER와 북마크 그룹의 렌더 순서는 따로 바꾼다).
const SETTINGS_SECTION_NUMBERS = Object.fromEntries(
  SETTINGS_SECTIONS.map((section, index) => [section.id, index + 1]),
) as Record<SettingsPanelSectionId, number>

// 각 탭 안에서 항목이 놓인 순서(1부터).
const SETTING_ITEM_POSITIONS: Partial<Record<SettingsBookmarkId, { section: SettingsPanelSectionId; item: number }>> = {
  marketValueRange: { section: 'composition', item: 1 },
  excludeSector: { section: 'composition', item: 2 },
  stockChange: { section: 'composition', item: 3 },
  depthLevel: { section: 'industry', item: 1 },
  depthMetric: { section: 'industry', item: 2 },
  depthRange: { section: 'industry', item: 3 },
  boxSize: { section: 'stockDisplay', item: 1 },
  boxLabel: { section: 'stockDisplay', item: 2 },
  decimalPlaces: { section: 'stockDisplay', item: 3 },
  strongColor: { section: 'colors', item: 1 },
  topPick: { section: 'colors', item: 2 },
}

// "2-1" 같은 설정 위치 번호.
const settingNumber = (id: SettingsBookmarkId) => {
  const position = SETTING_ITEM_POSITIONS[id]
  return position ? `${SETTINGS_SECTION_NUMBERS[position.section]}-${position.item}` : ''
}

interface ExcludedSector {
  sectorId: number
  sectorName: string
}

// checked가 꺼지면 라벨 텍스트도 같이 옅어져서, 꺼져있다는 게 스위치 색뿐 아니라 글자로도 드러난다.
function ToggleSwitch({
  checked,
  onChange,
  label,
  labelSuffix,
  hint,
  disabled = false,
  bold = false,
  labelClassName = '',
  labelDataNum,
  hideLabel = false,
  forceLabelWhite = false,
}: {
  checked: boolean
  onChange: () => void
  label: string
  // 라벨 바로 뒤(같은 왼쪽 그룹) 붙는 보조 콘텐츠 — 예: "커스텀 모드" 옆 "N/N종목" 표시.
  labelSuffix?: ReactNode
  hint?: string
  disabled?: boolean
  bold?: boolean
  labelClassName?: string
  // 북마크 탭에서 라벨 앞에 보이는 원래 위치 번호(settings-bookmark-num이 data-num을 그린다).
  labelDataNum?: string
  // true면 라벨을 화면에 그리지 않고 스위치만 그린다(접근성용 aria-label은 label을 그대로 씀) —
  // 바깥에서 이미 같은 텍스트를 제목(예: "색상 범위")으로 보여주고 있어 중복 표시를 피할 때 쓴다.
  hideLabel?: boolean
  // true면 checked=false여도 라벨을 회색으로 옅게 하지 않고 흰색으로 그린다 — "동일 가중/시총 가중"처럼
  // OFF가 "꺼짐(비활성)"이 아니라 "다른 선택지가 켜짐"을 뜻하는 경우, label 자체가 항상 지금 선택된
  // 쪽을 나타내므로 checked 여부와 무관하게 항상 강조돼야 한다.
  forceLabelWhite?: boolean
  // 상위 설정과 같은 위계를 만들지 않을 작은 하위 옵션용 스위치.
  compact?: boolean
}) {
  // 라벨(+보조 콘텐츠)은 왼쪽에 모으고, 스위치는 justify-between으로 항상 이 줄의 우측 끝에 붙인다.
  return (
    <div className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-35' : ''}`}>
      {!hideLabel && (
        <span className="flex min-w-0 items-center gap-2">
          <span
            data-num={labelDataNum}
            className={`${labelClassName} ${bold ? 'font-bold' : ''} ${forceLabelWhite || checked ? 'text-ui-white' : 'text-ui-muted'}`}
          >
            {label}
          </span>
          {labelSuffix}
          {hint && <span className="text-[10.5px] text-ui-muted">{hint}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onChange}
        disabled={disabled}
        className={`relative -mr-1.5 h-2 w-6 shrink-0 appearance-none rounded-full border-0 p-0 shadow-none transition-colors duration-[500ms] ease-out ${checked ? 'bg-[var(--accent)]' : 'bg-ui-control'} ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        <span
          className={`absolute top-1/2 left-0 box-border h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 ${checked ? 'border-ui-control' : 'border-ui-control-hover'} bg-ui-panel transition-transform duration-[500ms] ease-out ${checked ? 'translate-x-2.5' : 'translate-x-0'}`}
        />
      </button>
    </div>
  )
}

// 뎁스 범위 슬라이더 인덱스는 뎁스에 직접 대응한다(0=대분류, 1=중분류, 2=소분류, ...).
const DEPTH_LABELS = ['대분류', '중분류', '소분류']

// 활성화는 제목 오른쪽 토글, 슬라이더는 표시할 개수만 선택한다.
const TOP_PICK_COUNT_OPTIONS: { key: '1' | '2' | '3'; label: string }[] = [
  { key: '1', label: '1개' },
  { key: '2', label: '2개' },
  { key: '3', label: '3개' },
]

// 그룹 탭에는 이 중 하나만 표시한다.
const GROUP_TAB_METRIC_OPTIONS: { key: DepthMetric; label: string }[] = [
  { key: 'weightedAvgChangeRate', label: '시총 가중 등락률' },
  { key: 'simpleAvgChangeRate', label: '동일 가중 등락률' },
  { key: 'upDownCount', label: '상승/하락 종목 수' },
  { key: 'marketValue', label: '업종 시가총액 합계' },
]

// 박스 내 표기 방식은 라디오형 세그먼트 컨트롤로 표시한다.
const STOCK_LABEL_MODE_LABELS = ['종목명', '등락률', '모두']

// 등락률 소수점 슬라이더 라벨 — 인덱스 그대로 소수점 자릿수(toPctSigned의 decimalPlaces 인자, 0=정수).
const DECIMAL_PLACES_LABELS = ['0%', '0.0%', '0.00%']

// 범위 슬라이더 핸들 안의 화살표. 업종 분류 세로 손잡이(StairChevron)의 꺽쇠를 옆으로 눕힌 모양이다.
function ChevronGlyph({ direction, outward = false }: { direction: 'left' | 'right'; outward?: boolean }) {
  // outward: 핸들(원) 안에서 꺽쇠를 바깥쪽(왼쪽 화살표는 왼쪽, 오른쪽 화살표는 오른쪽)으로 2px 옮긴다.
  const shift = outward ? (direction === 'left' ? '-translate-x-[2px]' : 'translate-x-[2px]') : ''
  return (
    <svg viewBox="0 0 6 10" className={`h-2 shrink-0 ${shift}`} aria-hidden="true">
      <path
        d={direction === 'left' ? 'M5 1 1 5l4 4' : 'M1 1l4 4-4 4'}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// 설정창이 열리고 닫힐 때의 애니메이션 길이(ms) — index.css의 settings-panel-* 애니메이션 시간(0.25s)과 같아야 한다.
const SIDEBAR_ANIMATION_MS = 250

// 업종 분류 세로 손잡이와 같은 모양(청록 외곽선, 고른 칸 바탕색)이다.
const RANGE_HANDLE_CLASS =
  'pointer-events-none absolute top-1/2 flex h-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center box-border rounded-full border border-brand bg-brand-surface text-ui-white touch-none'

// 섹션 전체가 막혔을 때의 안내 말풍선은 섹션 아래 끝이 아니라 마우스 커서 바로 옆에 띄운다 —
// 섹션이 높아도 안내가 컨트롤에서 멀어지지 않는다. x·y는 마우스의 화면 좌표이고, bounds는 말풍선이 나가면 안 되는 설정창의 화면 위치다.
interface CursorHint {
  x: number
  y: number
  bounds: { left: number; right: number; top: number; bottom: number }
}
// 말풍선이 설정창 가장자리에서 띄우는 최소 간격.
const BUBBLE_MARGIN = 8
const cursorHintFrom = (e: ReactPointerEvent<HTMLElement>): CursorHint => {
  const sidebar = e.currentTarget.closest('[data-settings-panel]')?.getBoundingClientRect()
  const bounds = sidebar
    ? { left: sidebar.left, right: sidebar.right, top: sidebar.top, bottom: sidebar.bottom }
    : { left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight }
  return { x: e.clientX, y: e.clientY, bounds }
}
function CursorHintBubble({ hint, children }: { hint: CursorHint; children: ReactNode }) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  // 마우스 오른쪽 아래에 띄우되 설정창 밖으로 나가지 않게 한다. 오른쪽에 자리가 모자라면 왼쪽으로 밀고, 아래에 모자라면 마우스 위로 뒤집는다.
  // 크기를 잰 뒤 DOM 위치만 직접 고치므로(상태를 다시 설정하지 않는다) 마우스가 움직여도 화면이 튀지 않는다.
  useLayoutEffect(() => {
    const el = bubbleRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const { bounds } = hint
    const left = Math.max(bounds.left + BUBBLE_MARGIN, Math.min(hint.x + 12, bounds.right - BUBBLE_MARGIN - width))
    let top = hint.y + 16
    if (top + height > bounds.bottom - BUBBLE_MARGIN) {
      top = hint.y - height - 8
    }
    top = Math.max(bounds.top + BUBBLE_MARGIN, Math.min(top, bounds.bottom - BUBBLE_MARGIN - height))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  })
  // 설정창 안에 그리면 위치 지정(relative)된 아래 항목의 제목·버튼이 말풍선 위로 올라오므로, 화면 맨 바깥(body)에 고정 위치로 그린다.
  // 줄바꿈은 문구마다 <br />로 직접 정하고(w-max whitespace-nowrap), 한글이 중간에서 끊기지 않게 "활성화됩니다." 같은 끝 문구는
  // 공백을 &nbsp;로 묶어 둔다.
  return createPortal(
    <div
      ref={bubbleRef}
      role="status"
      style={{ position: 'fixed', left: 0, top: 0 }}
      className={`pointer-events-none z-50 w-max whitespace-nowrap ${HINT_BUBBLE_CLASS}`}
    >
      {children}
    </div>,
    document.body,
  )
}

// 계단식 업종 칸(업종 분류 깊이·지표 표시 단계가 같이 쓴다) — 대분류·중분류(▸)·소분류(▸▸)를 지도 업종 헤더 모양(칸 18px, 간격 3px)으로 쌓고 꺾인 선으로 잇는다.
// 칸과 배지는 고르는 버튼이 아니라 상태 표시이고, 고르는 건 오른쪽 세로 트랙(STAIR_RAIL 폭)의 손잡이가 맡는다.
// 3단계가 항목 안(제목 위에서 아래 구분선까지 115px)에 들어간다.
const STAIR_ROW = 25
const STAIR_GAP = 6
const STAIR_STEP = 14
const STAIR_RAIL = 16
const stairCenterOf = (index: number) => index * (STAIR_ROW + STAIR_GAP) + STAIR_ROW / 2
// 세로 트랙 위 포인터 높이에서 가리키는 칸 번호(범위 밖이면 그대로 둔다 — 선택할 수 없는 칸을 가리키는지 알아내는 데 쓴다).
const stairRawIndex = (rect: DOMRect, clientY: number) => Math.round((clientY - rect.top - STAIR_ROW / 2) / (STAIR_ROW + STAIR_GAP))
const stairHeight = (count: number) => count * STAIR_ROW + (count - 1) * STAIR_GAP

function StairChevron({ direction, className = '' }: { direction: 'up' | 'down'; className?: string }) {
  return (
    <svg viewBox="0 0 10 6" className={`w-2 ${className}`}>
      <path d={direction === 'up' ? 'M1 5l4-4 4 4' : 'M1 1l4 4 4-4'} fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// litFrom~litTo(포함)의 칸은 배경이 강조색으로 켜지고 나머지는 흐려진다. 선택할 수 없는 칸(maxSelectableIndex 아래)은 더 흐리고 blockedHint(말풍선)를 단다.
function StairRows({
  labels,
  litFrom,
  litTo,
  maxSelectableIndex,
  blockedHint,
  valueLabel,
  selectedIndex,
  onPick,
  disabled = false,
  railWidth = STAIR_RAIL,
}: {
  labels: string[]
  litFrom: number
  litTo: number
  maxSelectableIndex: number
  blockedHint: (label: string) => string
  // 켜진 칸의 배지 옆에 덧붙이는 값 글자(지표 표시 단계에 덧붙일 지표 이름).
  valueLabel?: string
  // 칸을 눌러 하나만 고르는 모드(상위 업종 강조): 고른 칸에 청록 프레임이 쳐지고, 선택할 수 없는 칸은 눌러도 안 된다.
  selectedIndex?: number
  onPick?: (index: number) => void
  disabled?: boolean
  railWidth?: number
}) {
  return (
    <>
      {labels.map((label, index) => {
        const blocked = index > maxSelectableIndex
        const lit = index >= litFrom && index <= litTo
        const top = index * (STAIR_ROW + STAIR_GAP)
        const left = index * STAIR_STEP
        const mark = index === 0 ? null : index === 1 ? '▸ ' : (
          <>
            <span style={{ letterSpacing: '-0.15em', paddingRight: '0.15em' }}>{'▸'.repeat(index)}</span>{' '}
          </>
        )
        return (
          <Fragment key={label}>
            {index > 0 && (
              <span
                aria-hidden="true"
                className="absolute rounded-bl-[3px] border-0 border-b-2 border-l-2 border-solid border-ui-border"
                style={{ left: left - STAIR_STEP + 8, top: top - STAIR_GAP, width: STAIR_STEP - 8, height: STAIR_GAP + STAIR_ROW / 2 }}
              />
            )}
            <div
              data-hint={blocked ? blockedHint(label) : undefined}
              role={onPick ? 'radio' : undefined}
              aria-checked={onPick ? selectedIndex === index : undefined}
              aria-disabled={onPick && (disabled || blocked) ? true : undefined}
              tabIndex={onPick && !disabled && !blocked ? 0 : undefined}
              onClick={onPick && !disabled && !blocked ? () => onPick(index) : undefined}
              onKeyDown={onPick && !disabled && !blocked ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(index) } } : undefined}
              className={`absolute flex items-center rounded-[3px] text-left text-[12px] font-bold leading-none text-ui-white transition-[background-color,opacity] ${onPick && selectedIndex === index ? 'bg-brand/35' : 'bg-ui-control'} ${onPick ? `box-border border border-solid ${selectedIndex === index ? 'border-brand' : 'border-transparent'} ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}` : ''}`}
              style={{ left, top, width: `calc(100% - ${left + railWidth}px)`, height: STAIR_ROW, opacity: blocked ? 0.2 : lit ? 1 : 0.5 }}
            >
              <span className={`ml-[2.5px] whitespace-nowrap rounded-[3px] px-1.5 leading-[20px] ${lit ? 'bg-ui-panel text-ui-white' : 'bg-ui-white/20'}`}>
                {mark}{label}
              </span>
              {valueLabel && lit && !blocked && <span className="ml-2.5 truncate text-[13px] font-medium">{valueLabel}</span>}
            </div>
          </Fragment>
        )
      })}
    </>
  )
}

const STAIR_HANDLE_BASE =
  'absolute left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-[top,width,height,gap] duration-100'

// 업종 분류 깊이 — 손잡이 하나(︿﹀ 알약, 평소엔 작고 올리면 커진다)를 끌거나 트랙을 눌러 깊이를 바꾼다. 손잡이가 닿은 칸까지(위 칸 포함) 켜져서 겹침이 보인다.
function DepthStairSelect({
  depth,
  labels,
  onChange,
  disabled = false,
  maxSelectableIndex,
}: {
  depth: number
  labels: string[]
  onChange: (index: number) => void
  disabled?: boolean
  maxSelectableIndex: number
}) {
  const last = labels.length - 1
  const railRef = useRef<HTMLDivElement>(null)
  // 선택할 수 없는 깊은 칸 높이에 포인터가 있으면 트랙에 이유 말풍선을 단다(손잡이를 그쪽으로 끌어도 안 움직이는 이유).
  // 말풍선은 같은 마우스 움직임에서 곧바로 떠야 하므로(상태로 두면 다음 움직임에야 반영된다) data-hint를 DOM에 바로 쓴다.
  const updateHint = (clientY: number) => {
    const rail = railRef.current
    if (!rail) return
    const raw = stairRawIndex(rail.getBoundingClientRect(), clientY)
    if (raw > maxSelectableIndex && raw <= last) rail.dataset.hint = `현재 분류에는\n${labels[raw]} 단계가 없습니다.`
    else delete rail.dataset.hint
  }
  const pickByPointer = (clientY: number) => {
    if (disabled) return
    const rect = railRef.current?.getBoundingClientRect()
    if (!rect) return
    const raw = stairRawIndex(rect, clientY)
    const next = Math.max(0, Math.min(maxSelectableIndex, raw))
    if (next !== depth - 1) onChange(next)
  }
  return (
    <div
      role="group"
      aria-label="업종 분류 깊이"
      aria-disabled={disabled || undefined}
      className={`relative ${disabled ? 'pointer-events-none' : ''}`}
      style={{ height: stairHeight(labels.length) }}
    >
      <StairRows
        railWidth={0}
        labels={labels}
        litFrom={0}
        litTo={depth - 1}
        maxSelectableIndex={maxSelectableIndex}
        blockedHint={label => `현재 분류에는\n${label} 단계가 없습니다.`}
      />
      <div
        ref={railRef}
        className="group absolute -right-[20px] top-0 h-full cursor-pointer touch-none"
        style={{ width: STAIR_RAIL }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          updateHint(e.clientY)
          pickByPointer(e.clientY)
        }}
        onPointerMove={e => {
          updateHint(e.clientY)
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pickByPointer(e.clientY)
        }}
        onPointerLeave={e => { delete e.currentTarget.dataset.hint }}
      >
        <span className="pointer-events-none absolute left-[6px] w-[4px] rounded-full bg-ui-border" style={{ top: stairCenterOf(0), height: stairCenterOf(last) - stairCenterOf(0) }} />
        <span className="pointer-events-none absolute left-[6px] w-[4px] rounded-full bg-brand transition-[height]" style={{ top: stairCenterOf(0), height: stairCenterOf(depth - 1) - stairCenterOf(0) }} />
        <span
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label="업종 분류 깊이"
          aria-disabled={disabled || undefined}
          aria-orientation="vertical"
          aria-valuemin={1}
          aria-valuemax={maxSelectableIndex + 1}
          aria-valuenow={depth}
          aria-valuetext={labels[depth - 1]}
          onKeyDown={e => {
            if (disabled) return
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(Math.max(0, depth - 2)) }
            else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); onChange(Math.min(maxSelectableIndex, depth)) }
          }}
          className={`${STAIR_HANDLE_BASE} h-6 w-3 flex-col gap-2 border-brand bg-brand-surface`}
          style={{ top: stairCenterOf(depth - 1) }}
        >
          <StairChevron direction="up" />
          <StairChevron direction="down" />
        </span>
      </div>
    </div>
  )
}

// 지표 표시 단계 — 업종 분류 깊이와 같은 계단 칸에 손잡이 둘(위 ︿ = 시작 단계, 아래 ﹀ = 끝 단계)을 둔다. 두 손잡이 사이(포함)의 칸이 켜진다.
// 두 손잡이가 같은 칸에 모이면 ︿﹀가 함께 든 알약 하나로 그리고, 그때는 처음 움직이는 방향(위/아래)으로 어느 쪽을 잡았는지 정한다.
function DepthStairRange({
  minIndex,
  maxIndex,
  labels,
  onChange,
  disabled = false,
  maxSelectableIndex,
  blockedHint,
  valueLabel,
}: {
  minIndex: number
  maxIndex: number
  labels: string[]
  onChange: (minIndex: number, maxIndex: number) => void
  disabled?: boolean
  maxSelectableIndex: number
  blockedHint: string
  // 켜진 칸마다 배지 옆에 보이는 값(2-2) 업종 지표에서 고른 이름).
  valueLabel?: string
}) {
  const last = labels.length - 1
  const railRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<'min' | 'max' | null>(null)
  const updateHint = (clientY: number) => {
    const rail = railRef.current
    if (!rail) return
    const raw = stairRawIndex(rail.getBoundingClientRect(), clientY)
    if (raw > maxSelectableIndex && raw <= last) rail.dataset.hint = blockedHint
    else delete rail.dataset.hint
  }
  const indexFromPointer = (clientY: number) => {
    const rect = railRef.current?.getBoundingClientRect()
    if (!rect) return minIndex
    const raw = stairRawIndex(rect, clientY)
    return Math.max(0, Math.min(maxSelectableIndex, raw))
  }
  const apply = (index: number) => {
    if (disabled) return
    let which = dragRef.current
    if (!which) {
      if (index < minIndex) which = 'min'
      else if (index > maxIndex) which = 'max'
      else return
      if (minIndex === maxIndex) dragRef.current = which
    }
    if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
    else onChange(minIndex, Math.max(index, minIndex))
  }
  const merged = minIndex === maxIndex
  const handleKeys = (which: 'min' | 'max') => (e: React.KeyboardEvent) => {
    if (disabled) return
    const delta = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
    if (!delta) return
    e.preventDefault()
    if (which === 'min') onChange(Math.max(0, Math.min(minIndex + delta, maxIndex)), maxIndex)
    else onChange(minIndex, Math.max(minIndex, Math.min(maxIndex + delta, maxSelectableIndex)))
  }
  const handleStyle = (index: number) => ({ top: stairCenterOf(index) })
  const singleClass = `${STAIR_HANDLE_BASE} size-3 border-brand bg-brand-surface`
  return (
    <div
      role="group"
      aria-label="지표 표시 단계"
      aria-disabled={disabled || undefined}
      className={`relative ${disabled ? 'cursor-not-allowed' : ''}`}
      style={{ height: stairHeight(labels.length) }}
    >
      <StairRows railWidth={0} labels={labels} litFrom={minIndex} litTo={maxIndex} maxSelectableIndex={maxSelectableIndex} blockedHint={() => blockedHint} valueLabel={valueLabel} />
      <div
        ref={railRef}
        className={`group absolute -right-[20px] top-0 h-full touch-none ${disabled ? 'pointer-events-none' : 'cursor-pointer'}`}
        style={{ width: STAIR_RAIL }}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture(e.pointerId)
          updateHint(e.clientY)
          const index = indexFromPointer(e.clientY)
          dragRef.current = minIndex === maxIndex ? null : index <= (minIndex + maxIndex) / 2 ? 'min' : 'max'
          apply(index)
        }}
        onPointerMove={e => {
          updateHint(e.clientY)
          if (e.currentTarget.hasPointerCapture(e.pointerId)) apply(indexFromPointer(e.clientY))
        }}
        onPointerLeave={e => { delete e.currentTarget.dataset.hint }}
        onPointerUp={() => { dragRef.current = null }}
      >
        <span className="pointer-events-none absolute left-[6px] w-[4px] rounded-full bg-ui-border" style={{ top: stairCenterOf(0), height: stairCenterOf(last) - stairCenterOf(0) }} />
        <span className="pointer-events-none absolute left-[6px] w-[4px] rounded-full bg-brand transition-[top,height]" style={{ top: stairCenterOf(minIndex), height: stairCenterOf(maxIndex) - stairCenterOf(minIndex) }} />
        {merged ? (
          <span
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label="지표 표시 단계"
            aria-disabled={disabled || undefined}
            aria-valuetext={labels[minIndex]}
            onKeyDown={e => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') handleKeys('min')(e)
              else handleKeys('max')(e)
            }}
            className={`${STAIR_HANDLE_BASE} h-6 w-3 flex-col gap-2 border-brand bg-brand-surface`}
            style={handleStyle(minIndex)}
          >
            <StairChevron direction="up" />
            <StairChevron direction="down" />
          </span>
        ) : (
          <>
            <span role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} aria-label="지표 표시 시작 단계" aria-valuetext={labels[minIndex]} onKeyDown={handleKeys('min')} className={`${singleClass} z-10`} style={handleStyle(minIndex)}>
              <StairChevron direction="up" className="-translate-y-[2px]" />
            </span>
            <span role="slider" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined} aria-label="지표 표시 끝 단계" aria-valuetext={labels[maxIndex]} onKeyDown={handleKeys('max')} className={`${singleClass} z-20`} style={handleStyle(maxIndex)}>
              <StairChevron direction="down" className="translate-y-[2px]" />
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// 업종 단계(대/중/소분류) 텍스트 선택 — 업종 분류 깊이(2-1)보다 깊거나 분류에 없는 단계는 비활성이고,
// 올리거나 누르면 이유를 커서 옆 말풍선으로 알려준다.
function DepthTextSelect({
  depth,
  onChange,
  maxSelectableDepth,
  ariaLabel,
  disabled = false,
  noDataLimited = false,
  className = '',
}: {
  depth: number
  onChange: (depth: number) => void
  maxSelectableDepth: number
  ariaLabel: string
  disabled?: boolean
  // true면 2-1 설정이 아니라 분류 자체에 그 단계 데이터가 없어서 막힌 것이다(KRX·NXT).
  noDataLimited?: boolean
  className?: string
}) {
  const [hint, setHint] = useState<CursorHint | null>(null)
  const [blockedLabel, setBlockedLabel] = useState('')
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`relative flex max-w-[16rem] flex-row items-center gap-3 whitespace-nowrap text-left text-[13px]/4 ${className}`}
      onPointerMove={e => { if (hint) setHint(cursorHintFrom(e)) }}
      onPointerLeave={() => setHint(null)}
    >
      {DEPTH_LABELS.map((label, index) => {
        const isCapped = index >= maxSelectableDepth
        const canExplain = isCapped && !disabled
        return (
          <span
            key={label}
            className={`relative inline-flex ${canExplain ? 'cursor-not-allowed' : ''}`}
            onPointerEnter={canExplain ? e => { setBlockedLabel(label); setHint(cursorHintFrom(e)) } : undefined}
            onPointerDown={canExplain ? e => {
              e.preventDefault()
              setBlockedLabel(label)
              setHint(cursorHintFrom(e))
            } : undefined}
          >
            <button
              type="button"
              role="radio"
              aria-checked={depth === index}
              onClick={() => onChange(index)}
              disabled={disabled || isCapped}
              className={`border-0 bg-transparent p-0 text-left text-[13px]/4 disabled:cursor-not-allowed ${
                depth === index ? 'text-ui-white' : isCapped ? 'text-ui-muted' : 'text-ui-muted hover:text-ui-white'
              }`}
            >
              {label}
            </button>
            {canExplain && <span aria-hidden="true" className="absolute inset-0 z-10 cursor-not-allowed" />}
          </span>
        )
      })}
      {hint && !disabled && (
        <CursorHintBubble hint={hint}>
          {noDataLimited ? (
            <>현재 {blockedLabel} 데이터가 없어<br />비활성화되어 있습니다.</>
          ) : (
            <><span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthLevel')}) 업종 분류 깊이</span>에서<br />더 깊은 업종 단계를 선택하면<br />활성화됩니다.</>
          )}
        </CursorHintBubble>
      )}
    </div>
  )
}

// 양쪽 끝에 핸들이 있으면 전체 구간 다 보여주고, 핸들을 안쪽으로 옮기면 그 구간(포함) 밖은 제외된다.
// 두 핸들은 서로를 지나칠 수 없다(겹치는 건 허용 — 그러면 그 한 칸만 표시).
function RangeSlider({
  minIndex,
  maxIndex,
  steps,
  labels,
  minAriaLabel,
  maxAriaLabel,
  onChange,
  disabled = false,
  maxSelectableIndex,
  limitReason,
  disabledReason,
}: {
  minIndex: number
  maxIndex: number
  steps: number
  labels: string[]
  minAriaLabel: string
  maxAriaLabel: string
  onChange: (minIndex: number, maxIndex: number) => void
  disabled?: boolean
  // 눈금은 전부 보여주되, 실제로 이동할 수 있는 마지막 인덱스만 제한한다.
  maxSelectableIndex?: number
  limitReason?: ReactNode
  disabledReason?: ReactNode
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [limitHintVisible, setLimitHintVisible] = useState(false)
  const [hintPos, setHintPos] = useState<CursorHint | null>(null)
  // 끌고 있는 동안은 핸들이 손을 늦게 따라오지 않도록 아주 짧게, 눌러서 옮길 때는 0.3초 동안 미끄러진다.
  const [isDragging, setIsDragging] = useState(false)
  const slideTransition = `left ${isDragging ? 150 : 300}ms ease-out, width ${isDragging ? 150 : 300}ms ease-out`
  const sliderSteps = Math.max(steps, 1)
  const selectableMaxIndex = Math.min(sliderSteps, maxSelectableIndex ?? sliderSteps)

  // 핸들 버튼은 순전히 시각적 표시일 뿐, 실제 클릭/드래그는 트랙 전체가 받는다 — 두 핸들이 겹치면
  // DOM상 나중에 그려지는 쪽(max)이 항상 클릭을 가로채 반대쪽 핸들을 못 잡는 문제를 이렇게 피한다.
  // 클릭 지점이 두 핸들의 중점보다 왼쪽이면 min을, 오른쪽이면 max를 그 위치로 옮긴다.
  //
  // 포인터가 실제로 움직였으면(threshold 이상) "드래그"로 보고 범위를 조정하고, 움직임 없이 그냥
  // 뗐으면("클릭") 가까운 핸들을 그 위치로 옮긴다. 기능 전체의 켜기/끄기는 별도 토글이 담당한다.
  const CLICK_MOVE_THRESHOLD = 4
  const startDrag = (e: React.PointerEvent) => {
    if (disabled) {
      if (disabledReason) setLimitHintVisible(true)
      return
    }
    e.preventDefault()
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const rawIndexFromClientX = (clientX: number) => {
      const inset = 8
      const usableWidth = Math.max(0, rect.width - inset * 2)
      const ratio = usableWidth > 0 ? Math.min(1, Math.max(0, (clientX - rect.left - inset) / usableWidth)) : 0
      return Math.round(ratio * sliderSteps)
    }
    const selectableIndexFromClientX = (clientX: number) => Math.min(rawIndexFromClientX(clientX), selectableMaxIndex)
    // 바깥쪽 뎁스는 현재 선택 가능한 상한에서 멈춘다.
    const dragIndexFromClientX = (clientX: number) => {
      const index = selectableIndexFromClientX(clientX)
      return Math.min(selectableMaxIndex, index)
    }
    const which: 'min' | 'max' = dragIndexFromClientX(e.clientX) <= (minIndex + maxIndex) / 2 ? 'min' : 'max'
    const startX = e.clientX
    let dragged = false
    const handleMove = (ev: PointerEvent) => {
      if (!dragged && Math.abs(ev.clientX - startX) < CLICK_MOVE_THRESHOLD) return
      if (!dragged) setIsDragging(true)
      dragged = true
      const index = dragIndexFromClientX(ev.clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    const handleUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
      setIsDragging(false)
      if (dragged) return
      // 움직이지 않고 뗐다 = 클릭. 가까운 핸들을 그 자리로 옮긴다.
      const index = dragIndexFromClientX(ev.clientX)
      if (which === 'min') onChange(Math.min(index, maxIndex), maxIndex)
      else onChange(minIndex, Math.max(index, minIndex))
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
  }

  // 데이터가 얕아서 steps가 minIndex/maxIndex(기본값 등으로 미리 정해진 값)보다 작아질 수 있다 —
  // 그대로 두면 핸들이 트랙 밖(100% 너머)으로 밀려나므로 표시 위치만 안전하게 클램프한다.
  const minPct = (Math.min(minIndex, selectableMaxIndex) / sliderSteps) * 100
  const maxPct = (Math.min(maxIndex, selectableMaxIndex) / sliderSteps) * 100
  const blockedStartPct = ((selectableMaxIndex + 0.5) / sliderSteps) * 100
  const labelSteps = Math.max(labels.length - 1, 1)
  const visibleReason = disabled ? disabledReason : limitReason

  return (
    <div
      className="relative isolate"
      onPointerEnter={e => {
        setHintPos(cursorHintFrom(e))
        if (disabled && disabledReason) setLimitHintVisible(true)
      }}
      onPointerMove={e => setHintPos(cursorHintFrom(e))}
      onPointerLeave={() => setLimitHintVisible(false)}
    >
      <div
        ref={trackRef}
        className={`relative h-4 w-full ${disabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'}`}
        onPointerDown={startDrag}
      >
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ui-border" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
          style={{ left: `calc(8px + ${minPct}% - ${minPct * 0.16}px)`, width: `calc(${maxPct - minPct}% - ${(maxPct - minPct) * 0.16}px)`, transition: slideTransition }}
        />
        {/* 두 핸들이 같은 칸에 모이면 원 두 개가 겹쳐 화살표가 뭉개진다. 그때는 바깥으로 벌어지는
            화살표 둘을 담은 알약 하나로 그려서, 모여 있어도 양방향으로 벌릴 수 있는 핸들임이 보이게 한다. */}
        {minPct === maxPct ? (
          <div
            aria-label={`${minAriaLabel} / ${maxAriaLabel}`}
            className={`${RANGE_HANDLE_CLASS} z-10 w-7 gap-2`}
            style={{ left: `calc(8px + ${minPct}% - ${minPct * 0.16}px)`, transition: slideTransition }}
          >
            <ChevronGlyph direction="left" />
            <ChevronGlyph direction="right" />
          </div>
        ) : (
          <>
            <div aria-label={minAriaLabel} className={`${RANGE_HANDLE_CLASS} z-10 w-4`} style={{ left: `calc(8px + ${minPct}% - ${minPct * 0.16}px)`, transition: slideTransition }}>
              <ChevronGlyph direction="left" outward />
            </div>
            <div aria-label={maxAriaLabel} className={`${RANGE_HANDLE_CLASS} z-20 w-4`} style={{ left: `calc(8px + ${maxPct}% - ${maxPct * 0.16}px)`, transition: slideTransition }}>
              <ChevronGlyph direction="right" outward />
            </div>
          </>
        )}
        {!disabled && selectableMaxIndex < sliderSteps && (
          <div
            className="absolute inset-y-0 right-0 z-30 cursor-not-allowed"
            style={{ left: `calc(8px + ${blockedStartPct}% - ${blockedStartPct * 0.16}px)` }}
            onPointerEnter={() => setLimitHintVisible(true)}
            onPointerLeave={() => setLimitHintVisible(false)}
            onPointerDown={e => {
              e.stopPropagation()
              setLimitHintVisible(true)
            }}
          />
        )}
      </div>
      <div className={disabled ? 'opacity-35' : ''}>
        <SliderTickLabels
          labels={labels}
          steps={labelSteps}
          highlightedRange={[minIndex, maxIndex]}
          blockedFromIndex={disabled && disabledReason ? 0 : !disabled && selectableMaxIndex < sliderSteps ? selectableMaxIndex + 1 : undefined}
          onBlockedHintChange={setLimitHintVisible}
        />
      </div>
      {limitHintVisible && hintPos && visibleReason && (disabled || selectableMaxIndex < sliderSteps) && (
        <CursorHintBubble hint={hintPos}>
          {visibleReason}
        </CursorHintBubble>
      )}
    </div>
  )
}

// 라벨 개수(=steps+1)가 슬라이더마다 다르므로, flex justify-between 대신 핸들과 똑같은 방식(각 tick의
// x% 위치에 절대 위치)으로 배치해야 라벨이 항상 그 tick과 x축이 맞는다 — 라벨 폭이 서로 달라도(예:
// "끄기" vs "중분류") 흔들리지 않는다. 양 끝 라벨도 가운데 글자가 핸들 중심 아래에 오도록 가운데 정렬하고,
// 바깥으로 나가는 절반은 설정 창의 좌우 여백(settings-control-inset)이 받아준다.
// inset=false면 양 끝 라벨을 핸들 중심이 아니라 슬라이더 줄(트랙)의 왼쪽·오른쪽 끝에 가운데 맞춘다(상위 업종 강조 개수 슬라이더만 쓴다).
function SliderTickLabels({
  labels,
  steps,
  inset = true,
  alignDecimalPoint = false,
  highlightedIndex,
  highlightedRange,
  blockedFromIndex,
  onBlockedHintChange,
}: {
  labels: string[]
  steps: number
  inset?: boolean
  // 소수점이 있는 라벨은 점의 중심을 눈금에 맞춘다.
  alignDecimalPoint?: boolean
  highlightedIndex?: number
  highlightedRange?: [number, number]
  blockedFromIndex?: number
  onBlockedHintChange?: (visible: boolean, index?: number) => void
}) {
  return (
    <div className={`relative mt-1 h-4 text-[13px]/4 text-ui-muted ${inset ? 'mx-2' : ''}`}>
      {labels.map((label, index) => {
        const decimalIndex = alignDecimalPoint ? label.indexOf('.') : -1
        const blocked = blockedFromIndex !== undefined && index >= blockedFromIndex
        const highlighted = highlightedIndex === index || (
          highlightedRange !== undefined && index >= highlightedRange[0] && index <= highlightedRange[1]
        )
        return (
          <span
            key={index}
            className={`absolute whitespace-nowrap transition-colors duration-300 ${blocked ? 'cursor-not-allowed text-ui-muted' : highlighted ? 'font-medium text-ui-white' : 'text-ui-muted'} ${
              '-translate-x-1/2'
            }`}
            style={{ left: `${(index / steps) * 100}%` }}
            onPointerEnter={blocked ? () => onBlockedHintChange?.(true, index) : undefined}
            onPointerLeave={blocked ? () => onBlockedHintChange?.(false) : undefined}
            onPointerDown={blocked ? () => onBlockedHintChange?.(true, index) : undefined}
          >
            {decimalIndex >= 0 ? (
              <>
                <span className="absolute right-full">{label.slice(0, decimalIndex)}</span>
                .
                <span className="absolute left-full">{label.slice(decimalIndex + 1)}</span>
              </>
            ) : label}
          </span>
        )
      })}
    </div>
  )
}

// 싱글 슬라이더의 실제 레일도 듀얼 슬라이더와 같은 양 끝 핸들 중심(좌우 8px 안쪽)에 맞춘다.
function SingleRangeInput({
  value,
  min,
  max,
  step,
  ariaLabel,
  onChange,
  disabled = false,
  ariaValueText,
  smooth = true,
}: {
  value: number
  min: number
  max: number
  step: number
  ariaLabel: string
  onChange: (value: number) => void
  disabled?: boolean
  ariaValueText?: string
  // false면 손잡이를 미끄러뜨리지 않고 브라우저 기본 손잡이를 그대로 쓴다 — 값이 끊김 없이 이어지는 슬라이더(박스 크기, 텍스트 표시 기준)는 끌 때 손잡이가 늦게 따라오지 않게 이렇게 둔다.
  smooth?: boolean
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100
  // 끌고 있는 동안(누른 채 움직일 때)은 손잡이가 손을 늦게 따라오지 않도록 아주 짧게, 눌러서 옮기거나 키보드로 옮길 때는 0.3초 동안 미끄러진다.
  const [isDragging, setIsDragging] = useState(false)
  const slide = `${isDragging ? 150 : 300}ms ease-out`
  const barTransition = smooth ? `width ${slide}` : undefined
  return (
    <div className={`relative h-4 ${disabled ? 'opacity-35' : ''}`}>
      <span aria-hidden="true" data-slider-track className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ui-border" />
      <span
        aria-hidden="true"
        className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand"
        style={{ width: `calc(8px + ${pct}% - ${pct * 0.16}px)`, transition: barTransition }}
      />
      {/* 눈에 보이는 손잡이 — 아래 input의 기본 손잡이는 투명하게 두고, 이 손잡이가 값 위치로 미끄러진다. */}
      {smooth && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 box-border h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand bg-brand-surface"
          style={{ left: `calc(8px + ${pct}% - ${pct * 0.16}px)`, transition: `left ${slide}` }}
        />
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
        onChange={e => onChange(Number(e.target.value))}
        onPointerMove={e => { if (e.buttons === 1) setIsDragging(true) }}
        onPointerUp={() => setIsDragging(false)}
        onPointerCancel={() => setIsDragging(false)}
        onBlur={() => setIsDragging(false)}
        disabled={disabled}
        className={`settings-single-slider absolute inset-0 block h-4 w-full disabled:cursor-not-allowed ${smooth ? '' : 'is-native-thumb'}`}
      />
    </div>
  )
}

// 핸들 하나로 딱 하나의 칸만 고르는 슬라이더 — RangeSlider와 달리 범위가 아니라 단일 값(예: 종목
// 박스 표시 내용)을 고를 때 쓴다. 눈금 라벨 배치 방식은 RangeSlider와 동일(라벨 폭과 무관하게 위치 고정).
function SingleValueSlider({
  index,
  labels,
  ariaLabel,
  onChange,
  disabled = false,
  maxSelectableIndex,
  blockedReason,
  labelsAtTrackEnds = false,
  alignDecimalPoint = false,
}: {
  index: number
  labels: string[]
  ariaLabel: string
  onChange: (index: number) => void
  disabled?: boolean
  // true면 양 끝 눈금 글자를 손잡이 중심이 아니라 슬라이더 줄의 양끝에 가운데 맞춘다(상위 업종 강조 개수).
  labelsAtTrackEnds?: boolean
  alignDecimalPoint?: boolean
  // 눈금은 전부 보여주되, 이 인덱스를 넘는 칸은 고를 수 없고 blockedReason을 말풍선으로 알려준다.
  maxSelectableIndex?: number
  blockedReason?: (blockedLabel: string) => ReactNode
}) {
  const steps = Math.max(labels.length - 1, 1)
  const selectableMax = Math.min(maxSelectableIndex ?? steps, steps)
  const isCapped = selectableMax < steps
  const [hintVisible, setHintVisible] = useState(false)
  const [hintPos, setHintPos] = useState<CursorHint | null>(null)
  const [blockedIndex, setBlockedIndex] = useState(steps)
  return (
    <div
      className="relative"
      onPointerEnter={e => setHintPos(cursorHintFrom(e))}
      onPointerMove={e => setHintPos(cursorHintFrom(e))}
      onPointerLeave={() => setHintVisible(false)}
    >
      <SingleRangeInput
        min={0}
        max={steps}
        step={1}
        value={index}
        ariaLabel={ariaLabel}
        onChange={next => {
          if (next > selectableMax) {
            setBlockedIndex(next)
            setHintVisible(true)
            // 이미 고를 수 있는 가장 끝 칸이면 값이 그대로라서 저장하지 않는다 — 저장하면 다른 분류에서 골라 둔 더 깊은 단계가 덮어써진다.
            if (index === selectableMax) return
          }
          onChange(Math.min(next, selectableMax))
        }}
        disabled={disabled}
      />
      <SliderTickLabels
        labels={labels}
        steps={steps}
        inset={!labelsAtTrackEnds}
        alignDecimalPoint={alignDecimalPoint}
        highlightedIndex={index}
        blockedFromIndex={isCapped ? selectableMax + 1 : undefined}
        onBlockedHintChange={isCapped ? (visible, blocked) => {
          setHintVisible(visible)
          if (blocked !== undefined) setBlockedIndex(blocked)
        } : undefined}
      />
      {hintVisible && hintPos && isCapped && blockedReason && (
        <CursorHintBubble hint={hintPos}>{blockedReason(labels[blockedIndex] ?? '')}</CursorHintBubble>
      )}
    </div>
  )
}

// 아래 섹션 컴포넌트들은 전부 페이지가 SettingsPanel의 children으로 직접 골라서 조립한다 — 페이지마다
// 유효한 옵션이 다 다른데(지도는 전부 유효, 섹터는 일부만, 요약/어드민은 전혀 없음), 옵션 하나를 켜고
// 끄는 스위치 하나로는 이 조합을 감당할 수 없기 때문. 새 페이지 전용 옵션이 생기면 그 페이지 파일에
// 새 섹션 컴포넌트를 하나 추가해서 끼워 넣기만 하면 되고, 여기 다른 섹션이나 SettingsPanel 껍데기
// 자체는 안 건드려도 된다.

// 그룹 페이지 등락률 평균 방식 — 시총 가중/동일 가중 중 하나를 고른다.
export type SectorStockScope = 'MAP' | 'ALL'

// 그룹 페이지 "집계 대상 종목" — 업종 평균과 종목 수에 어떤 종목을 넣을지 고른다.
// 맵 페이지 기준: 지도 설정창에서 제외한 업종·시가총액 구간을 그대로 따른다. 전종목: 제외 설정을 무시하고 전체 종목을 넣는다.
export function SettingsSectorStockScopeSection({
  scope,
  onChange,
}: {
  scope: SectorStockScope
  onChange: (scope: SectorStockScope) => void
}) {
  const options: { value: SectorStockScope; label: string }[] = [
    { value: 'MAP', label: '맵 페이지 기준' },
    { value: 'ALL', label: '전종목' },
  ]
  return (
    <div className="settings-first-depth-level text-sm">
      <span className="flex max-w-[16rem] items-center text-left text-[15px] font-medium leading-[22px] text-ui-white">
        <span className="settings-plain-title">집계 대상 종목</span>
      </span>
      <SettingDescription>업종 평균에 넣을 종목</SettingDescription>
      <div role="radiogroup" aria-label="집계 대상 종목" className="relative mt-4 grid max-w-[16rem] settings-control-inset grid-cols-2 gap-[6px]">
        <SlidingHighlight count={options.length} index={options.findIndex(option => option.value === scope)} className="rounded-[5px] border border-brand bg-brand-surface" />
        {options.map(option => {
          const selected = scope === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`relative z-10 min-h-[28px] rounded-[5px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium whitespace-nowrap transition-colors duration-[500ms] ${
                selected ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'
              }`}
            >
              {option.label}
              {/* 아이콘이 들어갈 자리(여백 4px + 16px)만큼 글자를 왼쪽으로 비켜 둬서, 아이콘이 글자 바로 옆에 붙어 보이게 한다. */}
              {option.value === 'ALL' && <span aria-hidden="true" className="ml-1 inline-block w-4" />}
            </button>
          )
        })}
        {/* 전종목 버튼 안쪽 오른쪽 — 버튼 안에 버튼을 넣을 수 없어 같은 자리에 겹쳐 두고, 눌러도 선택이 바뀌지 않는다. translate를 쓰면 안쪽의 fixed 말풍선이 이 칸 기준으로 위치가 틀어져 inset-y-0으로 가운데에 둔다. 어두운 미선택 칩에서는 아이콘을 밝게, 밝은 선택 채움에서는 진하게 표시하고 호버·포커스에도 대비를 유지한다. */}
        <span className={`pointer-events-none absolute inset-y-0 left-1/2 right-0.5 z-20 flex items-center justify-center text-[13px]/4 font-medium ${scope === 'ALL' ? '[&_button]:text-ui-white [&_button:hover]:text-ui-white [&_button:focus-visible]:text-ui-white' : '[&_button]:text-ui-text [&_button:hover]:text-ui-white [&_button:focus-visible]:text-ui-white'}`}>
          <span aria-hidden="true" className="invisible whitespace-nowrap">전종목</span>
          <span className="pointer-events-auto flex items-center">
            <SettingHelpBubble
              label="집계 대상 종목"
              description={<><b className="text-status-error-ink">전종목을 선택하면</b>{'\n'}맵 페이지 등락률과{'\n'}<b className="text-status-error-ink">다르게 집계</b>될 수 있습니다.</>}
            />
          </span>
        </span>
      </div>
    </div>
  )
}

// 그룹 페이지 "업종 분류 단계" — 막대 하나가 대분류인지 중분류인지 소분류인지 고른다.
// 분류 자체에 하위 단계가 없으면(거래소 분류 KRX·NXT) 대분류만 고를 수 있다. 저장된 값은 건드리지 않고 화면에서만 막는다.
export function SettingsGroupDepthSection({
  depth,
  onChange,
  selectableDepth,
  lockedMessage,
}: {
  depth: number
  onChange: (depth: number) => void
  selectableDepth: number
  // 막힌 단계에 올렸을 때 보여 줄 문구 — 없으면 "데이터가 없어 비활성화"로 안내한다. 데이터가 있는데도 화면 정책으로 잠근 곳(홈)이 쓴다.
  lockedMessage?: ReactNode
}) {
  return (
    <div className="settings-first-depth-level text-sm">
      <span className="flex max-w-[16rem] items-center text-left text-[15px] font-medium leading-[22px] text-ui-white">
        <span className="settings-plain-title">업종 분류 단계</span>
      </span>
      <SettingDescription>그래프에 표시할 업종 분류의 단계</SettingDescription>
      <div className="settings-slider-control mt-[18px]">
        <SingleValueSlider
          index={Math.min(depth, selectableDepth) - 1}
          labels={DEPTH_LABELS}
          ariaLabel="그래프 업종 분류 단계"
          onChange={index => onChange(index + 1)}
          maxSelectableIndex={selectableDepth - 1}
          blockedReason={label => lockedMessage ?? <>현재 {label} 데이터가 없어<br />비활성화되어 있습니다.</>}
        />
      </div>
    </div>
  )
}

export function SettingsAverageModeSection({
  avgChangeRateUseSimple,
  onChange,
  enabled,
  onToggle,
  toggleDisabled = false,
}: {
  avgChangeRateUseSimple: boolean
  onChange: (useSimple: boolean) => void
  enabled: boolean
  onToggle: () => void
  toggleDisabled?: boolean
}) {
  const options = [
    { value: false, label: '시총 가중' },
    { value: true, label: '동일 가중' },
  ]
  return (
    <div className="settings-first-depth-level text-sm">
      <div className="flex max-w-[16rem] items-center justify-between text-left text-[15px] font-medium leading-[22px]">
        <span className={`settings-plain-title ${enabled ? 'text-ui-white' : 'text-ui-muted'}`}>등락률 기준</span>
        <ToggleSwitch checked={enabled} onChange={onToggle} label="등락률 그래프" hideLabel disabled={toggleDisabled} />
      </div>
      <div className={enabled ? '' : 'opacity-35'}>
        <SettingDescription>업종 등락률 계산 기준</SettingDescription>
        <div role="radiogroup" aria-label="등락률 기준" aria-disabled={!enabled} className="relative mt-4 grid max-w-[16rem] settings-control-inset grid-cols-2 gap-[6px]">
          <SlidingHighlight count={options.length} index={options.findIndex(option => option.value === avgChangeRateUseSimple)} className="rounded-[5px] border border-brand bg-brand-surface" />
          {options.map(option => {
            const selected = avgChangeRateUseSimple === option.value
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(option.value)}
                disabled={!enabled}
                className={`relative z-10 min-h-[28px] rounded-[5px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium whitespace-nowrap transition-colors duration-[500ms] ${
                  selected ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 그룹 페이지 "N분 전 대비"의 비교 시점 — 15/30/60/120분 중 하나를 슬라이더로 고른다.
const BEFORE_MINUTES_OPTIONS = [15, 30, 60, 120]

export function SettingsBeforeMinutesSection({
  beforeMinutes,
  onChange,
  enabled,
  onToggle,
  disabled = false,
}: {
  beforeMinutes: number
  onChange: (minutes: number) => void
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  // URL 파라미터로 옵션에 없는 값(예: 10)이 들어와도 슬라이더는 가장 가까운 칸을 가리킨다.
  const index = BEFORE_MINUTES_OPTIONS.reduce(
    (best, minutes, i) =>
      Math.abs(minutes - beforeMinutes) < Math.abs(BEFORE_MINUTES_OPTIONS[best] - beforeMinutes) ? i : best,
    0,
  )
  return (
    <div className="settings-second-depth-metric relative mt-6 text-sm">
      <div className="flex max-w-[16rem] items-center justify-between text-left text-[15px] font-medium leading-[22px]">
        <span className={`flex items-center gap-1 ${enabled ? 'text-ui-white' : 'text-ui-muted'}`}>
          <span className="settings-plain-title">비교 시점</span>
          {disabled && <SettingHelpBubble label="비교 시점" description="기간 등락률을 보는 동안에는 N분 전 대비를 사용할 수 없습니다." />}
        </span>
        <ToggleSwitch checked={enabled} onChange={onToggle} label="비교 그래프" hideLabel disabled={disabled} />
      </div>
      <div className={enabled ? '' : 'opacity-35'}>
        <SettingDescription>현재 등락률과 비교할 시점</SettingDescription>
        <div className="settings-slider-control mt-[18px]">
          <SingleValueSlider
            index={index}
            labels={BEFORE_MINUTES_OPTIONS.map(minutes => `${minutes}분`)}
            ariaLabel="비교 시점(분 전)"
            onChange={i => onChange(BEFORE_MINUTES_OPTIONS[i])}
            disabled={disabled || !enabled}
          />
        </div>
      </div>
    </div>
  )
}

function SettingsTaxonomySelector({
  taxonomy,
  onSelectTaxonomy,
  atBottom = false,
  snapshotTime,
}: {
  taxonomy: TaxonomyKey
  onSelectTaxonomy: (taxonomy: TaxonomyKey) => void
  atBottom?: boolean
  snapshotTime?: string | null
}) {
  // KRX와 NXT는 "거래소" 한 칸으로 합쳤고, 지금 어느 쪽 종목을 보여줄지는 시간대가 정한다. 내 분류는 로그인이 필요하다(고르면 로그인 창이 뜬다).
  const options: { key: TaxonomyKey; label: string }[] = [
    { key: 'MARKETRY', label: TAXONOMY_NAMES.MARKETRY.tab },
    { key: 'KRX', label: '거래소' },
    { key: 'MINE', label: TAXONOMY_NAMES.MINE.tab },
  ]
  const isExchange = taxonomy === 'KRX' || taxonomy === 'NXT'
  const isSelected = (key: TaxonomyKey) => (key === 'KRX' ? isExchange : taxonomy === key)

  return (
    <div data-map-select-top-line={atBottom || undefined} style={atBottom ? { backgroundColor: TAXONOMY_BACKGROUND_COLOR } : undefined} className={`${atBottom ? 'shrink-0 border-t border-ui-border px-4 py-3' : 'mb-6 pt-3 pb-6'} text-ui-white`}>
      <p data-map-select-title className="font-roboto-latin flex h-6 items-center whitespace-nowrap text-lg font-bold leading-none">
        {/* 발표 자료의 제목 강조처럼 앞에 세로 막대를 하나 둔다. 색은 홈페이지 메인색(청록)이다. */}
        <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-brand" />
        {TAXONOMY_SELECT_TITLE}
      </p>
      <div role="radiogroup" aria-label={TAXONOMY_SELECT_TITLE} className="relative mt-2 grid grid-cols-3 gap-[6px]">
        <SlidingHighlight count={options.length} index={options.findIndex(option => isSelected(option.key))} className="rounded-[5px] border border-brand bg-brand-surface" />
        {options.map(option => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={isSelected(option.key)}
            onClick={() => !isSelected(option.key) && onSelectTaxonomy(option.key)}
            className={`relative z-10 min-h-[34px] rounded-[5px] border-0 bg-transparent px-0.5 py-1 text-sm font-medium whitespace-nowrap transition-colors duration-[500ms] ${
              isSelected(option.key) ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {/* 업데이트 시각이 없어도(올린 MARKETRY가 아직 없을 때 등) 줄은 그대로 둬서 다른 분류와 모양이 달라지지 않게 한다. 시각 글자만 같은 폭으로 자리를 잡고 숨긴다. */}
      {atBottom && (
        <p className={`${FONT_BAR_TIME_SHAPE} mt-2 flex items-center justify-center gap-1.5 whitespace-nowrap text-xs font-medium text-ui-text`}>
          <span className="flex items-center">
            업데이트
            <SettingHelpBubble
              label="업데이트"
              // 말풍선마다 주어를 빨간 굵은 글씨로 강조한다(누적/별도 말풍선의 전일·당일과 같은 모양). 조사(가)는 강조하지 않는다.
              description={
                isExchange ? (
                  <>
                    <b className="text-status-error-ink">키움증권</b>에서 받은{'\n'}종목·업종 정보를 서버에{'\n'}마지막으로 동기화한 시각입니다.{'\n\n'}시세 갱신 시각이나 거래소의{'\n'}공식 분류 변경 시각과는 다릅니다.
                  </>
                ) : taxonomy === 'MINE' ? (
                  <>
                    <b className="text-status-error-ink">내가</b> 종목·업종 정보를{'\n'}마지막으로 수정한 시각입니다.
                  </>
                ) : (
                  <>
                    <b className="text-status-error-ink">MARKETRY</b>가 종목·업종 정보를{'\n'}마지막으로 수정한 시각입니다.
                  </>
                )
              }
            />
          </span>
          <span className={snapshotTime ? undefined : 'invisible'}>{toSnapshotDateLabel(snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
          <span className={snapshotTime ? undefined : 'invisible'}>{toSnapshotTimeOnlyLabel(snapshotTime ?? MARKET_MAP_SNAPSHOT_PLACEHOLDER_ISO)}</span>
        </p>
      )}
    </div>
  )
}

function SettingsAverageModeSelector({
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
}: {
  avgChangeRateUseSimple: boolean
  onToggleAvgChangeRateUseSimple: () => void
}) {
  const options = [
    { value: false, label: '시총 가중' },
    { value: true, label: '동일 가중' },
  ]

  return (
    <div className="settings-first-stock-size mb-6 pt-3 pb-6 text-ui-white">
      <p className="flex items-center text-[15px]">
        <span className="settings-section-num">등락률 평균</span>
        <SettingHelpBubble label="등락률 평균" description={"업종 등락률 계산에 적용할\n평균 방식을 선택합니다."} />
      </p>
      <div role="radiogroup" aria-label="등락률 평균" className="relative mt-3 grid grid-cols-2 gap-[6px]">
        <SlidingHighlight count={options.length} index={options.findIndex(option => option.value === avgChangeRateUseSimple)} className="rounded-[5px] border border-brand bg-brand-surface" />
        {options.map(option => (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={avgChangeRateUseSimple === option.value}
            onClick={() => avgChangeRateUseSimple !== option.value && onToggleAvgChangeRateUseSimple()}
            className={`relative z-10 min-h-[28px] rounded-[5px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium whitespace-nowrap transition-colors duration-[500ms] ${
              avgChangeRateUseSimple === option.value ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsStockSizeSelector({
  marketCapRatio,
  onChangeMarketCapRatio,
}: {
  marketCapRatio: number
  onChangeMarketCapRatio: (value: number) => void
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  if (bookmark.mode === 'bookmark' && !bookmark.ids.includes('boxSize')) return null
  return (
    <div className={`settings-first-stock-size text-ui-white ${bookmark.mode === 'bookmark' ? bookmarkItemClass(bookmark, 'boxSize') : 'mb-6 pt-3 pb-6'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <SettingTitle bookmarkId="boxSize" help className="text-[15px]">박스 크기</SettingTitle>
          <SettingHelpBubble bookmarkId="boxSize" label="박스 크기" description={"박스 면적은 시가총액^(비율÷100)으로 계산합니다.\n0%는 모든 종목을 같은 크기로 표시합니다.\n50%는 시가총액의 제곱근 비율로 표시합니다.\n100%는 시가총액에 비례해 표시합니다."} />
        </div>
        <span className="text-sm text-ui-muted">{marketCapRatio}%</span>
      </div>
      <SettingDescription>시가총액이 박스 크기에 반영되는 정도</SettingDescription>
      <div className="settings-slider-control mt-[35px]">
        <SingleRangeInput
          min={0}
          max={100}
          step={1}
          value={marketCapRatio}
          smooth={false}
          ariaLabel="박스 크기 시가총액 비율"
          ariaValueText={`${marketCapRatio}%`}
          onChange={onChangeMarketCapRatio}
        />
        <SliderTickLabels labels={['동일 크기', '시총 비례']} steps={1} inset />
      </div>
    </div>
  )
}

export function SettingsSectorLevelSection({
  maxDepth,
  sectorLevelEnabled,
  onToggleSectorLevel,
  availableMaxDepth,
  taxonomy,
  onChangeMaxDepth,
  activeDepthMetric,
  onChangeActiveDepthMetric,
  depthMetricEnabled,
  onToggleDepthMetric,
  depthMetricMinIndex,
  depthMetricMaxIndex,
  onChangeDepthMetricRange,
  stockLabelModeIndex,
  stockLabelEnabled,
  onToggleStockLabel,
  onChangeStockLabelModeIndex,
  decimalPlacesIndex,
  onChangeDecimalPlacesIndex,
  showDecimalPlaces = false,
  showDivider = false,
  showTaxonomy = true,
  showStockDisplay = true,
}: {
  // "업종 분류 탭" 위에 구분선(border-t)을 그릴지 — 스티키 커스텀모드 블록(또는 동일 가중) 바로 다음에
  // 올 때는 그 자체로 이미 구분되므로 false로 끈다. "종목 박스"는 "업종 분류 탭" 바로 다음이라 항상 그린다.
  showDivider?: boolean
  // null이면 제한 없음(=availableMaxDepth 전체 다 보여줌). 슬라이더가 다룰 수 있는 실제 상한은
  // 지금 트리(exclude/tier 필터링까지 반영된)의 최대 뎁스라 따로 내려받는다.
  maxDepth: number | null
  sectorLevelEnabled: boolean
  onToggleSectorLevel: () => void
  availableMaxDepth: number
  // 거래소(KRX·NXT) 분류는 대분류만 있어서 중·소분류는 고를 수 없다. MARKETRY만 하위 분류를 가진다.
  taxonomy?: TaxonomyKey
  onChangeMaxDepth: (value: number) => void
  // 그룹 탭에 표시할 네 항목 중 하나만 고른다.
  activeDepthMetric: DepthMetric
  onChangeActiveDepthMetric: (metric: DepthMetric) => void
  // 그룹 탭 표시 항목 전체의 표시 여부.
  depthMetricEnabled: boolean
  onToggleDepthMetric: () => void
  // 인덱스는 뎁스에 직접 대응(0=대분류, 1=중분류, ...) — 선택한 모든 항목에 공통으로 적용된다.
  depthMetricMinIndex: number
  depthMetricMaxIndex: number
  onChangeDepthMetricRange: (minIndex: number, maxIndex: number) => void
  // 종목 박스에 이름만(1)/등락률만(2)/둘 다(3) 보여줄지. 표시 여부는 별도 토글로 제어한다.
  stockLabelModeIndex: number
  stockLabelEnabled: boolean
  onToggleStockLabel: () => void
  onChangeStockLabelModeIndex: (index: number) => void
  // 종목 박스가 전체 트리맵 넓이에서 이 비중(%) 미만이면 종목명/등락률을 표시하지 않는다.
  // 등락률(%) 표시 소수점 자릿수(0=정수, 1=소수 1자리, 2=소수 2자리).
  decimalPlacesIndex: number
  onChangeDecimalPlacesIndex: (index: number) => void
  // true면 "종목 박스" 그룹에 "등락률 소수점" 슬라이더를 같이 그린다 — 지도 페이지에서 실제로 트리맵
  // 등락률(%) 표시에 쓰이는 설정이라 지도 페이지에서만 켠다(섹터는 그래프 자체 소수점 포맷을 따로
  // 쓰므로 기본 false로 숨긴다).
  showDecimalPlaces?: boolean
  // 업종 설정과 종목 박스 표기를 서로 다른 사이드바 탭에서 보여줄 수 있다.
  showTaxonomy?: boolean
  showStockDisplay?: boolean
}) {
  // 설정에서 선택할 수 있는 최소 단계는 대/중/소분류까지 보장한다. 실제 데이터가 얕으면 해당 단계의
  // 화면 결과만 비어 있을 뿐, 사용자가 미리 설정해 둔 값을 UI가 임의로 막거나 지우지는 않는다.
  const depthLabelCount = Math.max(availableMaxDepth, DEPTH_LABELS.length)
  // 분류 자체에 하위 단계가 없으면(거래소 분류 KRX·NXT) 그 단계는 고를 수 없다. MARKETRY와 내 분류(MINE)는 대·중·소분류 트리라 고를 수 있다.
  // 저장된 값은 건드리지 않고 화면에서만 막는다.
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : depthLabelCount
  const depthValue = Math.min(maxDepth ?? depthLabelCount, selectableDepth)
  const depthMetricMaxSelectableIndex = Math.max(0, Math.min(selectableDepth, maxDepth ?? selectableDepth) - 1)
  const isDepthMetricDisabled = !sectorLevelEnabled
  const depthMetricLabels = Array.from({ length: depthLabelCount }, (_, index) => DEPTH_LABELS[index] ?? `${index + 1}차 분류`)
  // 레벨 값은 1=대분류, 2=중분류, 3=소분류. 슬라이더 인덱스와 1만큼 차이 난다.
  // 선택값은 저장한 범위를 그대로 유지하되, 현재 업종 단계를 넘는 부분만 화면에서 잘라 보여준다.
  const depthMetricSliderMinIndex = Math.min(depthMetricMinIndex, depthMetricMaxSelectableIndex)
  const depthMetricSliderMaxIndex = Math.min(depthMetricMaxIndex, depthMetricMaxSelectableIndex)
  const isDepthMetricRangeDisabled = isDepthMetricDisabled || !depthMetricEnabled
  const isDecimalPlacesDisabled = !stockLabelEnabled || stockLabelModeIndex === 1
  const [depthMetricSectionHint, setDepthMetricSectionHint] = useState<CursorHint | null>(null)
  const [depthRangeSectionHint, setDepthRangeSectionHint] = useState<CursorHint | null>(null)
  const [decimalPlacesHint, setDecimalPlacesHint] = useState<CursorHint | null>(null)
  const bookmark = useContext(SettingsBookmarkContext)
  const inBookmarkTab = bookmark.mode === 'bookmark'
  const hideItem = (id: SettingsBookmarkId) => inBookmarkTab && !bookmark.ids.includes(id)
  const itemClass = (id: SettingsBookmarkId) => bookmarkItemClass(bookmark, id)
  const bookmarkableIds: SettingsBookmarkId[] = [
    ...(showTaxonomy ? (['depthLevel', 'depthMetric', 'depthRange'] as const) : []),
    ...(showStockDisplay ? (['boxLabel'] as const) : []),
    ...(showStockDisplay && showDecimalPlaces ? (['decimalPlaces'] as const) : []),
  ]
  if (inBookmarkTab && bookmarkableIds.every(hideItem)) return null

  return (
    <div className="text-ui-white">
      {showTaxonomy && <div className={showDivider ? 'mt-6 pt-8' : inBookmarkTab ? '' : 'pt-3'}>
        <div>
          <div className={`settings-first-depth-level text-sm ${itemClass('depthLevel')}`}>
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-ui-white">
                <SettingTitle bookmarkId="depthLevel" className="text-[15px]" help>업종 분류 깊이</SettingTitle>
                <SettingHelpBubble
                  bookmarkId="depthLevel"
                  label="업종 분류 깊이"
                  description={<>선택한 단계까지 업종을 세분화합니다.<br />끄면 업종 구분 없이 종목만 표시하고,<br /><span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthMetric')}) 업종 지표</span>와<br /><span className="inline-block whitespace-nowrap font-bold">{settingNumber('topPick')}) 상위 업종 강조</span>도<br />함께 비활성화됩니다.</>}
                />
              </span>
              <ToggleSwitch
                checked={sectorLevelEnabled}
                onChange={onToggleSectorLevel}
                label="업종 분류 깊이 사용"
                hideLabel
                compact
              />
            </div>
            <SettingDescription dimmed={!sectorLevelEnabled}>선택한 단계까지 업종을 세분화해 표시</SettingDescription>
            <div className={`settings-control-inset mt-[9.5px] ${sectorLevelEnabled ? '' : 'opacity-35'}`}>
              <DepthStairSelect
                depth={depthValue}
                labels={depthMetricLabels}
                onChange={index => onChangeMaxDepth(index + 1)}
                disabled={!sectorLevelEnabled}
                maxSelectableIndex={selectableDepth - 1}
              />
            </div>
          </div>
          <div className={`settings-second-depth-metric relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('depthMetric')}`}>
            <div className={isDepthMetricDisabled ? 'opacity-35' : ''}>
              <div className="flex max-w-[16rem] items-center justify-between">
                <span className="flex items-center text-left text-ui-white">
                  <SettingTitle bookmarkId="depthMetric" className="text-[15px]">업종 지표</SettingTitle>
                </span>
                <ToggleSwitch
                  checked={depthMetricEnabled}
                  onChange={onToggleDepthMetric}
                  label="업종 지표 사용"
                  hideLabel
                  compact
                  disabled={isDepthMetricDisabled}
                />
              </div>
              <SettingDescription dimmed={!depthMetricEnabled}>업종명 옆에 표시할 값</SettingDescription>
              <SettingsDropdown
                options={GROUP_TAB_METRIC_OPTIONS}
                value={activeDepthMetric}
                onChange={onChangeActiveDepthMetric}
                ariaLabel="업종 지표"
                badge="업종명"
                outlinedChevron
                disabled={isDepthMetricDisabled || !depthMetricEnabled}
                className={`mt-[9.5px] max-w-[16rem] settings-control-inset ${depthMetricEnabled ? '' : 'opacity-35'}`}
              />
              {/* 업종 지표 버튼이 지도에서 종목 상자 위(업종 머리글)에 놓인다는 것을 보여 주는 가짜 상자 — 누를 수 없는 그림이라 회색 선으로만 그린다. */}
              <div aria-hidden="true" className={`settings-control-inset pointer-events-none max-w-[16rem] ${depthMetricEnabled ? '' : 'opacity-35'}`}>
                <div className="relative h-[62px] rounded-b-[5px] border-x-2 border-b-2 border-ui-control">
                  <span className="absolute inset-y-0 left-[42%] border-l-2 border-ui-control" />
                  <span className="absolute left-[42%] right-0 top-1/2 border-t-2 border-ui-control" />
                  <span className="absolute left-0 top-[58%] w-[42%] border-t-2 border-ui-control" />
                  <span className="absolute bottom-0 left-[20%] top-[58%] border-l-2 border-ui-control" />
                  <span className="absolute left-[70%] top-0 h-1/2 border-l-2 border-ui-control" />
                  <span className="absolute left-[70%] right-0 top-1/4 border-t-2 border-ui-control" />
                  <span className="absolute left-[85%] top-0 h-1/4 border-l-2 border-ui-control" />
                  <span className="absolute left-[85%] top-1/4 h-1/4 border-l-2 border-ui-control" />
                  <span className="absolute bottom-0 left-[64%] top-1/2 border-l-2 border-ui-control" />
                  <span className="absolute bottom-0 left-[79%] top-1/2 border-l-2 border-ui-control" />
                  <span className="absolute left-[64%] right-0 top-[75%] border-t-2 border-ui-control" />
                </div>
              </div>
            </div>
            {isDepthMetricDisabled && (
              <div
                className="absolute inset-0 z-10 cursor-not-allowed"
                onPointerEnter={e => setDepthMetricSectionHint(cursorHintFrom(e))}
                onPointerMove={e => setDepthMetricSectionHint(cursorHintFrom(e))}
                onPointerLeave={() => setDepthMetricSectionHint(null)}
                onPointerDown={e => {
                  e.preventDefault()
                  setDepthMetricSectionHint(cursorHintFrom(e))
                }}
              />
            )}
            {isDepthMetricDisabled && depthMetricSectionHint && (
              <CursorHintBubble hint={depthMetricSectionHint}>
                <span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthLevel')}) 업종 분류 깊이</span> 토글을 켜면<br />활성화됩니다.
              </CursorHintBubble>
            )}
          </div>
          <div
            aria-disabled={isDepthMetricRangeDisabled}
            className={`settings-third-depth-range relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('depthRange')} ${isDepthMetricRangeDisabled ? 'cursor-not-allowed' : ''}`}
          >
            <span className={`flex items-center text-left text-[15px] text-ui-white ${isDepthMetricRangeDisabled ? 'opacity-35' : ''}`}>
              <SettingTitle bookmarkId="depthRange">지표 표시 단계</SettingTitle>
            </span>
            <div className={isDepthMetricRangeDisabled ? 'opacity-35' : ''}>
              <SettingDescription>지표를 표시할 업종 단계 범위</SettingDescription>
            </div>
            <div className={`settings-control-inset mt-[9.5px] ${isDepthMetricRangeDisabled ? 'opacity-35' : ''}`}>
              <DepthStairRange
                minIndex={depthMetricSliderMinIndex}
                maxIndex={depthMetricSliderMaxIndex}
                labels={depthMetricLabels}
                maxSelectableIndex={depthMetricMaxSelectableIndex}
                valueLabel={GROUP_TAB_METRIC_OPTIONS.find(option => option.key === activeDepthMetric)?.label}
                blockedHint={selectableDepth < depthLabelCount
                  ? '거래소 분류는\n대분류만 제공합니다.'
                  : `**${settingNumber('depthLevel')}) 업종 분류 깊이**에서\n더 깊은 업종 단계를 선택하면\n활성화됩니다.`}
                onChange={onChangeDepthMetricRange}
                disabled={isDepthMetricRangeDisabled}
              />
            </div>
            {isDepthMetricRangeDisabled && (
              <div
                className="absolute inset-0 z-10 cursor-not-allowed"
                onPointerEnter={e => setDepthRangeSectionHint(cursorHintFrom(e))}
                onPointerMove={e => setDepthRangeSectionHint(cursorHintFrom(e))}
                onPointerLeave={() => setDepthRangeSectionHint(null)}
                onPointerDown={e => {
                  e.preventDefault()
                  setDepthRangeSectionHint(cursorHintFrom(e))
                }}
              />
            )}
            {isDepthMetricRangeDisabled && depthRangeSectionHint && (
              <CursorHintBubble hint={depthRangeSectionHint}>
                {!sectorLevelEnabled
                  ? <><span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthLevel')}) 업종 분류 깊이</span> 토글을 켜면<br />활성화됩니다.</>
                  : <><span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthMetric')}) 업종 지표</span> 토글을 켜면<br />활성화됩니다.</>}
              </CursorHintBubble>
            )}
          </div>
        </div>
      </div>}
      {/* 종목 박스 탭의 박스 크기 다음에 종목 표기, 등락률 소수점을
          같은 번호 위계로 이어서 표시한다. */}
      {showStockDisplay && <div className={showTaxonomy ? 'mt-6 pt-8' : 'pt-0'}>
        <div>
          <div className={`settings-second-stock-label text-sm ${inBookmarkTab ? '' : 'mt-2'} ${itemClass('boxLabel')}`}>
            <div className="flex max-w-[16rem] items-center justify-between">
              <span className="flex items-center text-left text-ui-white">
                <SettingTitle bookmarkId="boxLabel" className="text-[15px]">박스 내 표기</SettingTitle>
              </span>
              <ToggleSwitch
                checked={stockLabelEnabled}
                onChange={onToggleStockLabel}
                label="박스 내 표기 사용"
                hideLabel
                compact
              />
            </div>
            <div className={stockLabelEnabled ? '' : 'opacity-35'}>
              <SettingDescription>박스 안에 표시할 내용</SettingDescription>
            </div>
            <div className={`settings-control-inset mt-[9.5px] max-w-[16rem] ${stockLabelEnabled ? '' : 'opacity-35'}`}>
              {/* 2-2) 업종 지표처럼 업종 머리글(가짜 줄) 아래 종목 상자 안에 버튼이 놓인 모양 — 누를 수 없는 그림이다. */}
              <div aria-hidden="true" className="pointer-events-none flex h-[25px] items-center rounded-t-[5px] bg-ui-control pl-[2.5px]">
                <span className="whitespace-nowrap rounded-[3px] bg-ui-panel px-1.5 text-[12px] font-bold leading-[20px] text-ui-white">업종명</span>
              </div>
              <div className="h-[62px] px-px pb-px pt-[2px]">
            <div role="radiogroup" aria-label="박스 내 표기" className="relative grid h-full w-full grid-cols-3 gap-[2px]">
              <SlidingHighlight square bottomRadius={5} gap={2} count={STOCK_LABEL_MODE_LABELS.length} index={stockLabelModeIndex - 1} className="border border-brand bg-brand-surface" />
              {STOCK_LABEL_MODE_LABELS.map((label, index) => {
                const value = index + 1
                const selected = stockLabelModeIndex === value
                return (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!stockLabelEnabled}
                    onClick={() => onChangeStockLabelModeIndex(value)}
                    className={`relative z-10 h-full rounded-none ${index === 0 ? 'rounded-bl-[5px]' : index === STOCK_LABEL_MODE_LABELS.length - 1 ? 'rounded-br-[5px]' : ''} border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium transition-colors duration-[500ms] disabled:cursor-not-allowed ${
                      selected ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'
                    }`}
                  >
                    {label === '모두' ? (
                      <span className="flex flex-col items-center ">
                        <span>종목명</span>
                        <span>등락률</span>
                      </span>
                    ) : label}
                  </button>
                )
              })}
            </div>
              </div>
            </div>
          </div>
          {showDecimalPlaces && (
            <div
              aria-disabled={isDecimalPlacesDisabled || undefined}
              className={`settings-fourth-decimal-places relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${itemClass('decimalPlaces')} ${isDecimalPlacesDisabled ? 'cursor-not-allowed' : ''}`}
              onPointerEnter={isDecimalPlacesDisabled ? e => setDecimalPlacesHint(cursorHintFrom(e)) : undefined}
              onPointerMove={isDecimalPlacesDisabled ? e => setDecimalPlacesHint(cursorHintFrom(e)) : undefined}
              onPointerLeave={() => setDecimalPlacesHint(null)}
              onPointerDown={isDecimalPlacesDisabled ? e => {
                e.preventDefault()
                setDecimalPlacesHint(cursorHintFrom(e))
              } : undefined}
            >
              <div className={isDecimalPlacesDisabled ? 'opacity-35' : ''}>
              <span className="flex max-w-[16rem] items-center text-left text-[15px] text-ui-white">
                <SettingTitle bookmarkId="decimalPlaces">등락률 소수점</SettingTitle>
              </span>
              <SettingDescription>종목 등락률의 소수점 자릿수</SettingDescription>
              {/* 3-2)와 같은 가짜 종목 상자 — 세 칸이 0·1·2자리 눈금이고, 슬라이더 손잡이가 각 칸 가운데에 멈춘다. */}
              <div className="settings-control-inset mt-[9.5px] max-w-[16rem]">
                <div aria-hidden="true" className="pointer-events-none flex h-[25px] items-center rounded-t-[5px] bg-ui-control pl-[2.5px]">
                  <span className="whitespace-nowrap rounded-[3px] bg-ui-panel px-1.5 text-[12px] font-bold leading-[20px] text-ui-white">업종명</span>
                </div>
                <div className="relative h-[62px]">
                  <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 top-[2px] grid grid-cols-3 gap-[2px]">
                    <span className="rounded-bl-[5px] bg-ui-control" />
                    <span className="bg-ui-control" />
                    <span className="rounded-br-[5px] bg-ui-control" />
                  </div>
                  <div
                    className="absolute top-[13px] [&_[data-slider-track]]:bg-ui-background"
                    style={{ left: 'calc((100% - 4px) / 6 - 8px)', width: 'calc((100% - 4px) * 2 / 3 + 4px + 16px)' }}
                  >
                    <SingleValueSlider
                      index={decimalPlacesIndex}
                      labels={DECIMAL_PLACES_LABELS}
                      alignDecimalPoint
                      ariaLabel="등락률 소수점 자릿수"
                      onChange={onChangeDecimalPlacesIndex}
                      disabled={isDecimalPlacesDisabled}
                    />
                  </div>
                </div>
              </div>
              </div>
              {isDecimalPlacesDisabled && decimalPlacesHint && (
                <CursorHintBubble hint={decimalPlacesHint}>
                  {!stockLabelEnabled ? (
                    <><span className="inline-block whitespace-nowrap font-bold">{settingNumber('boxLabel')}) 박스 내 표기</span> 토글을 켜면<br />활성화됩니다.</>
                  ) : (
                    <><span className="inline-block whitespace-nowrap font-bold">{settingNumber('boxLabel')}) 박스 내 표기</span>에서<br />등락률 또는 종목명+등락률을 선택하면<br />활성화됩니다.</>
                  )}
                </CursorHintBubble>
              )}
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}

// 관리자 페이지 미사용 탭으로 옮긴 종목 정보 설정. 기존 설정 키와 지도 동작은 유지한다.
export function SettingsStockPopupSection({
  stockPopupOnHover,
  onChangeStockPopupOnHover,
}: {
  stockPopupOnHover: boolean
  onChangeStockPopupOnHover: (onHover: boolean) => void
}) {
  return (
    <div className="text-sm text-ui-white">
      <span className="flex max-w-[16rem] items-center text-left text-[15px] text-ui-white">
        <span className="settings-plain-title">종목 정보</span>
        <SettingHelpBubble label="종목 정보" description={"업종 정보는 우클릭으로만\n열 수 있습니다."} />
      </span>
      <SettingDescription>종목 정보를 여는 방식</SettingDescription>
      <div
        role="radiogroup"
        aria-label="종목 정보 여는 방식"
        className="relative mt-[18px] grid max-w-[16rem] settings-control-inset grid-cols-2 gap-[6px]"
      >
        <SlidingHighlight count={2} index={stockPopupOnHover ? 1 : 0} className="rounded-[5px] border border-brand bg-brand-surface" />
        {[
          { label: '우클릭', onHover: false },
          { label: '마우스 올리기', onHover: true },
        ].map(option => {
          const selected = stockPopupOnHover === option.onHover
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChangeStockPopupOnHover(option.onHover)}
              className={`relative z-10 min-h-[28px] rounded-[5px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium transition-colors duration-[500ms] ${
              selected ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'
            }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 시가총액(원)을 "200조"·"5,000억"처럼 읽기 쉬운 단위로 적는다.
function toWonLabel(won: number): string {
  if (won >= 1e12) return `${(won / 1e12).toLocaleString('ko-KR')}조`
  return `${(won / 1e8).toLocaleString('ko-KR')}억`
}

// 관리자 페이지 미사용 탭의 "텍스트 표시 기준" — 지도 설정창 종목 박스 탭에서 옮겨 왔다. 값은 서버에 저장하지 않고 이 브라우저에만 둔다(utils/browserSetting.ts).
export function SettingsTextThresholdSection({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="h-[160px] text-sm">
      <div className="flex max-w-[16rem] items-center justify-between">
        <span className="flex items-center text-left text-[15px] text-ui-white">
          <span className="settings-plain-title">텍스트 표시 기준</span>
          <SettingHelpBubble label="텍스트 표시 기준" description={"기준 퍼센트는 지도 전체 면적 대비\n종목 박스 면적입니다."} />
        </span>
        <span className="text-ui-muted">{value.toFixed(3)}%</span>
      </div>
      <SettingDescription>작은 박스의 글자를 숨기는 기준</SettingDescription>
      <div className="settings-slider-control mt-[18px]">
        <SingleRangeInput min={0.01} max={0.3} step={0.001} value={value} smooth={false} ariaLabel="텍스트 표시 기준" onChange={onChange} />
      </div>
    </div>
  )
}

export function SettingsMarketValueSection({
  tiers,
  tierRangeMinIndex,
  tierRangeMaxIndex,
  onChangeTierRange,
  showDivider = true,
}: {
  isCustom: boolean
  // 오름차순(소→초) 정렬된 시가총액 구간 정의 — GET /map/value-tiers 조회 결과(useMarketValueTiers).
  // 아직 로딩 전이면 빈 배열.
  tiers: MarketValueTierItem[]
  // tiers 배열 기준 인덱스. 이 구간(포함) 밖의 시가총액 등급은 마켓맵에서 제외된다.
  tierRangeMinIndex: number
  tierRangeMaxIndex: number
  onChangeTierRange: (minIndex: number, maxIndex: number) => void
  // 위에 구분선(border-t)을 그릴지 — 스티키 커스텀모드 블록 바로 다음에 올 때(지도 페이지)는
  // false로 꺼서 이중 구분선을 피한다.
  showDivider?: boolean
}) {
  // tiers/tierRangeMinIndex·MaxIndex는 오름차순(소형주→초대형주) 기준을 그대로 유지하고, 화면에
  // 그릴 때만 좌우를 뒤집는다(초대형주가 왼쪽) — 저장값/다른 화면(섹터 랭킹)과 공유하는 인덱스
  // 의미는 안 바뀐다.
  const bookmark = useContext(SettingsBookmarkContext)
  if (bookmark.mode === 'bookmark' && !bookmark.ids.includes('marketValueRange')) return null
  const itemClass = bookmarkItemClass(bookmark, 'marketValueRange')
  const tierSteps = Math.max(tiers.length - 1, 1)
  const tierDisplayLabels = [...tiers].reverse().map(tier => tier.label)
  // 큰 등급부터 "등급: 이상 ~ 미만" 한 줄씩 — 구간 경계는 서버가 정한 등급별 하한값(thresholdValue)이고, 위 등급의 하한이 이 등급의 상한이다.
  const tierRangeLines =
    tiers.length === 0
      ? null
      : [...tiers]
          .reverse()
          .map((tier, index, descending) => {
            const upper = index === 0 ? null : descending[index - 1].thresholdValue
            const lower = tier.thresholdValue
            const range = lower === 0 ? `${toWonLabel(upper ?? 0)} 미만` : upper === null ? `${toWonLabel(lower)} 이상` : `${toWonLabel(lower)} 이상 ~ ${toWonLabel(upper)} 미만`
            return `${tier.label}: ${range}`
          })
          .join('\n')
  const tierDisplayMinIndex = tierSteps - tierRangeMaxIndex
  const tierDisplayMaxIndex = tierSteps - tierRangeMinIndex

  return (
    <div className={`settings-market-value text-ui-white ${itemClass} ${bookmark.mode === 'bookmark' ? '' : showDivider ? 'mt-6 pt-8' : 'pt-3'}`}>
      <p className="flex items-center text-[15px]">
        {/* 순서는 제목 → 물음표 → 북마크 — SettingTitle이 북마크를 제목 바로 뒤에 붙이므로 help로 북마크를 빼고 맨 끝에 직접 둔다. */}
        <SettingTitle bookmarkId="marketValueRange" help>시가총액 범위</SettingTitle>
        {tierRangeLines && <SettingHelpBubble label="시가총액 구간" description={tierRangeLines} />}
        <BookmarkButton id="marketValueRange" label="시가총액 범위" />
      </p>
      <SettingDescription>지도에 포함할 종목의 시총 구간</SettingDescription>
      <div className="settings-subsection-list mt-[35px] text-sm">
        <div className="settings-slider-control">
          <RangeSlider
            minIndex={tierDisplayMinIndex}
            maxIndex={tierDisplayMaxIndex}
            steps={tierSteps}
            labels={tierDisplayLabels}
            minAriaLabel="최소 시가총액 구간"
            maxAriaLabel="최대 시가총액 구간"
            onChange={(newDisplayMin, newDisplayMax) => {
              onChangeTierRange(tierSteps - newDisplayMax, tierSteps - newDisplayMin)
            }}
            disabled={tiers.length === 0}
          />
        </div>
      </div>
    </div>
  )
}

const DIRECTION_OPTIONS: { value: StockChangeFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'rising', label: '상승' },
  { value: 'falling', label: '하락' },
]

// 관리자 페이지 미사용 탭의 "업종 등락 방향" — 지도 설정창 종목 구성 탭에서 옮겨 왔다. 항목 높이 160px, 제목 번호는 settings-plain-content가 매긴다.
// 값은 서버에 저장하지 않고 이 브라우저에만 둔다(utils/browserSetting.ts).
export function SettingsSectorChangeSection({
  value,
  onChange,
  depth,
  onChangeDepth,
  maxSelectableDepth,
  noDataLimited = false,
}: {
  value: SectorChangeFilter
  onChange: (value: SectorChangeFilter) => void
  depth: number
  onChangeDepth: (depth: number) => void
  maxSelectableDepth: number
  // 분류에 하위 단계 데이터가 없어 막힌 경우(KRX·NXT) — 안내 문구가 달라진다.
  noDataLimited?: boolean
}) {
  return (
    <div className="settings-second-sector-change h-[160px] text-sm text-ui-white">
      <p className="flex items-center text-[15px]">
        <span className="settings-plain-title">업종 등락 방향</span>
      </p>
      <SettingDescription>상승·하락 업종만 표시</SettingDescription>
      <DepthTextSelect
        depth={depth}
        onChange={onChangeDepth}
        maxSelectableDepth={maxSelectableDepth}
        noDataLimited={noDataLimited}
        ariaLabel="업종 등락 방향 업종 단계"
        className="mt-2 justify-center"
      />
      <div role="radiogroup" aria-label="업종 등락 방향 필터" className="relative mt-2 grid max-w-[16rem] settings-control-inset grid-cols-3 gap-[6px]">
        <SlidingHighlight count={DIRECTION_OPTIONS.length} index={DIRECTION_OPTIONS.findIndex(option => option.value === value)} className="rounded-[5px] border border-brand bg-brand-surface" />
        {DIRECTION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`relative z-10 min-h-[25px] rounded-[5px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium transition-colors duration-[500ms] ${value === option.value ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsStockChangeSection({
  value,
  onChange,
}: {
  value: StockChangeFilter
  onChange: (value: StockChangeFilter) => void
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  return (
    <div className={`settings-third-stock-change text-ui-white ${bookmark.mode === 'bookmark' ? '' : 'mt-4 pt-6'} ${bookmarkItemClass(bookmark, 'stockChange')}`}>
      <p className="flex items-center text-[15px]">
        <SettingTitle bookmarkId="stockChange">종목 등락 방향</SettingTitle>
      </p>
      <SettingDescription>상승·하락 종목만 표시</SettingDescription>
      <div role="radiogroup" aria-label="종목 등락 방향 필터" className="relative mt-[40.5px] grid max-w-[16rem] settings-control-inset grid-cols-3 gap-[6px]">
        <SlidingHighlight count={DIRECTION_OPTIONS.length} index={DIRECTION_OPTIONS.findIndex(option => option.value === value)} className="rounded-[5px] border border-brand bg-brand-surface" />
        {DIRECTION_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`relative z-10 min-h-[25px] rounded-[5px] border-0 bg-transparent px-1 py-1 text-[13px]/4 font-medium transition-colors duration-[500ms] ${value === option.value ? 'text-ui-white' : 'text-ui-white hover:text-ui-white settings-chip-hover'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function SettingsExcludeSection({
  sectorFilterEnabled,
  onToggleSectorFilter,
  excludedSectors,
  onRemoveExcludedSector,
  afterStockChange = false,
}: {
  // 개별 섹터를 켜고 끄는 토글이 아니라, "섹터 제외를 적용할지 말지" 자체를 한 번에 켜고 끄는 스위치.
  // 어떤 섹터를 제외 목록에 넣을지는 마켓맵에서 우클릭으로 추가/이 목록에서 X로 제거하는 것으로만 관리한다.
  sectorFilterEnabled: boolean
  onToggleSectorFilter: () => void
  excludedSectors: ExcludedSector[]
  onRemoveExcludedSector: (sectorId: number) => void
  afterStockChange?: boolean
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  const number = bookmark.mode === 'bookmark' ? bookmark.numbers.excludeSector : undefined
  return (
    <div className={`${afterStockChange ? 'settings-fourth-exclude' : 'settings-second-exclude'} text-ui-white ${bookmark.mode === 'bookmark' ? '' : 'mt-4 pt-6'} ${bookmarkItemClass(bookmark, 'excludeSector')}`}>
      <div className="text-sm">
        <ToggleSwitch
          checked={sectorFilterEnabled}
          onChange={onToggleSectorFilter}
          label="제외 업종"
          forceLabelWhite
          labelClassName={`text-[15px] settings-section-num ${number ? 'settings-bookmark-num' : ''}`}
          labelDataNum={number}
          // 라벨과 보조 콘텐츠 사이 gap-2(8px)를 -ml-2로 되돌려, 북마크가 다른 항목 제목처럼 글자 바로 옆(4px)에 붙게 한다.
          labelSuffix={<span className="-ml-2 flex items-center"><BookmarkButton id="excludeSector" label="제외 업종" /></span>}
        />
        <SettingDescription dimmed={!sectorFilterEnabled}>업종을 우클릭하면 제외 가능</SettingDescription>
        <div
          inert={!sectorFilterEnabled}
          className={`settings-control-inset settings-exclude-list mt-[7px] flex flex-col gap-1 overflow-y-auto ${sectorFilterEnabled ? '' : 'opacity-35'} ${bookmark.mode === 'bookmark' ? 'max-h-14' : 'max-h-40'}`}
        >
            {excludedSectors.map(sector => (
              // 지도 위쪽 이동 경로의 되돌아가기 버튼과 같은 모양 — 이름 앞에 되돌아가기 표시가 붙은 한 버튼이다.
              <button
                key={sector.sectorId}
                type="button"
                onClick={async () => {
                  if (!await appConfirm(`[${sector.sectorName}]\n맵으로 복원하시겠습니까?`, { title: '업종 복원' })) return
                  onRemoveExcludedSector(sector.sectorId)
                }}
                aria-label={`${sector.sectorName} 맵에 다시 표시`}
                data-hint="맵에 다시 표시"
                className="flex h-5 w-full shrink-0 cursor-pointer items-center justify-start gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-left text-[13px] font-bold text-ui-white transition-colors hover:bg-[var(--accent)]/35"
              >
                <ReturnArrowIcon strokeWidth={2.3} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{sector.sectorName}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}

export function SettingsTopPickSection({
  sectorLevelEnabled,
  availableMaxDepth,
  taxonomy,
  topPickDepth,
  topPickCount,
  topPickEnabled,
  onToggleTopPick,
  topPickMaxSelectableDepth,
  onChangeTopPickDepth,
  onChangeTopPickCount,
}: {
  sectorLevelEnabled: boolean
  availableMaxDepth: number
  taxonomy?: TaxonomyKey
  topPickDepth: number
  topPickCount: number
  topPickEnabled: boolean
  onToggleTopPick: () => void
  topPickMaxSelectableDepth: number
  onChangeTopPickDepth: (depth: number) => void
  onChangeTopPickCount: (count: number) => void
}) {
  const depthLabelCount = Math.max(availableMaxDepth, DEPTH_LABELS.length)
  const selectableDepth = taxonomy === 'KRX' || taxonomy === 'NXT' ? 1 : depthLabelCount
  const depthMetricLabels = Array.from({ length: depthLabelCount }, (_, index) => DEPTH_LABELS[index] ?? `${index + 1}차 분류`)
  const isTopPickDisabled = !sectorLevelEnabled
  const [topPickSectionHint, setTopPickSectionHint] = useState<CursorHint | null>(null)
  const bookmark = useContext(SettingsBookmarkContext)
  const inBookmarkTab = bookmark.mode === 'bookmark'
  if (inBookmarkTab && !bookmark.ids.includes('topPick')) return null

  return (
    <div className={`settings-second-top-pick relative text-sm ${inBookmarkTab ? '' : 'mt-6'} ${bookmarkItemClass(bookmark, 'topPick')}`}>
      <div className={isTopPickDisabled ? 'opacity-35' : ''}>
        <div className="flex max-w-[16rem] items-center justify-between">
          <span className="flex items-center text-left text-ui-white">
            <SettingTitle bookmarkId="topPick" className="text-[15px]" help>상위 업종 강조</SettingTitle>
            <SettingHelpBubble
              bookmarkId="topPick"
              label="상위 업종 강조"
              description={<><span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthMetric')}) 업종 지표</span>에서<br />동일 가중 등락률을 선택하면<br />동일 가중 등락률로,<br />나머지 지표를 선택하면<br />시총 가중 등락률로 순위를 매깁니다.</>}
            />
          </span>
          <ToggleSwitch
            checked={topPickEnabled}
            onChange={onToggleTopPick}
            label="상위 업종 강조 사용"
            hideLabel
            compact
            disabled={isTopPickDisabled}
          />
        </div>
        <div className="settings-top-pick-count-row flex items-start justify-between">
          <SettingDescription dimmed={!topPickEnabled}>등락률 상위 업종을 강조</SettingDescription>
          <SettingsDropdown
            options={TOP_PICK_COUNT_OPTIONS}
            value={String(topPickCount) as '1' | '2' | '3'}
            onChange={key => onChangeTopPickCount(Number(key))}
            ariaLabel="상위 업종 강조 개수"
            disabled={isTopPickDisabled || !topPickEnabled}
            compact
            outlinedChevron
            className={`mt-1 w-[42px] shrink-0 ${topPickEnabled ? '' : 'opacity-35'}`}
          />
        </div>
        <div className={`settings-slider-control mt-[7.5px] ${topPickEnabled ? '' : 'opacity-35'} ${isTopPickDisabled || !topPickEnabled ? 'pointer-events-none' : ''}`}>
          <div role="radiogroup" aria-label="상위 업종 강조 단계" className="relative" style={{ height: stairHeight(depthLabelCount) }}>
            <StairRows
              railWidth={0}
              labels={depthMetricLabels}
              litFrom={0}
              litTo={depthLabelCount - 1}
              maxSelectableIndex={Math.min(topPickMaxSelectableDepth, selectableDepth) - 1}
              blockedHint={label => selectableDepth < depthLabelCount
                ? `현재 분류에는\n${label} 단계가 없습니다.`
                : `**${settingNumber('depthLevel')}) 업종 분류 깊이**에서\n더 깊은 업종 단계를 선택하면\n활성화됩니다.`}
              selectedIndex={topPickDepth}
              onPick={onChangeTopPickDepth}
              disabled={isTopPickDisabled || !topPickEnabled}
            />
          </div>
        </div>
      </div>
      {isTopPickDisabled && (
        <div
          className="absolute inset-0 z-10 cursor-not-allowed"
          onPointerEnter={e => setTopPickSectionHint(cursorHintFrom(e))}
          onPointerMove={e => setTopPickSectionHint(cursorHintFrom(e))}
          onPointerLeave={() => setTopPickSectionHint(null)}
          onPointerDown={e => {
            e.preventDefault()
            setTopPickSectionHint(cursorHintFrom(e))
          }}
        />
      )}
      {isTopPickDisabled && topPickSectionHint && (
        <CursorHintBubble hint={topPickSectionHint}>
          <span className="inline-block whitespace-nowrap font-bold">{settingNumber('depthLevel')}) 업종 분류 깊이</span> 토글을 켜면<br />활성화됩니다.
        </CursorHintBubble>
      )}
    </div>
  )
}

const COLOR_OFF_NOTICE_MS = 2000

export function SettingsColorSection({
  colorScaleDraft,
  colorCustomOn,
  onChangeColorCustomOn,
  onResetColorScale,
  isResettingColorScale,
  colorEditorProps,
}: {
  isCustom: boolean
  // 마켓맵 등락률 컬러 스케일 draft(및 그 setter) — null이면 아직 서버 조회 전. 실제 트리맵/범례에
  // 쓰이는 값과 동일한 참조라, 여기서 편집하는 즉시 지도 색이 실시간으로 바뀐다(별도 미리보기 불필요).
  // admin이 아니거나 아직 로딩 전이면 이 섹션 자체가 안 보인다.
  colorScaleDraft: ColorScaleConfig | null
  // "색상 커스텀 모드" 토글 — 순수 로컬(세션스토리지) 상태. draft(=저장 대상)와는 분리돼 있어서
  // 껐다 켜도 draft에 저장해둔 값은 건드리지 않는다.
  colorCustomOn: boolean
  onChangeColorCustomOn: (on: boolean) => void
  onResetColorScale: () => void
  isResettingColorScale: boolean
  colorEditorProps?: ColorThresholdEditorProps | null
}) {
  // 색상 설정은 비로그인에게도 보인다 — 기본 색상(공개 /map/scale)으로 시작해서 바꿀 수 있고, 비로그인의
  // 변경은 서버에 저장되지 않고 이 탭의 세션에만 남는다(다른 화면 설정과 같다).
  const runWithFeedback = useContext(SettingsFeedbackContext)
  // 커스텀을 끌 때 색상 칸에 포개서 잠깐 띄우는 안내 — 눌러야 사라지는 창이 아니라 일정 시간 뒤 스스로 사라진다.
  const [colorOffNoticeVisible, setColorOffNoticeVisible] = useState(false)
  useEffect(() => {
    if (!colorOffNoticeVisible) return
    const timer = window.setTimeout(() => setColorOffNoticeVisible(false), COLOR_OFF_NOTICE_MS)
    return () => window.clearTimeout(timer)
  }, [colorOffNoticeVisible])
  if (colorScaleDraft === null) return null

  return (
    <div className="settings-third-color pt-3 text-ui-white">
      {/* "색상 커스텀 모드" 토글을 별도 줄로 두지 않고, 제목 바로 우측에 스위치만 붙인다. 초기화 버튼(26px)은 위아래 여백을 -2px씩 줘서 줄 높이를 다른 항목의 제목 줄(22px)과 같게 둔다 — 그래야 메뉴를 바꿔도 제목·토글 위치가 같다. */}
      <div className="flex items-center justify-between">
        <p className="flex items-center text-[15px]">
          <span className="settings-section-num">등락률 색상</span>
          <button
            type="button"
            aria-label="초기화"
            data-hint="기본값으로 초기화"
            onClick={async () => { if (await appConfirm('등락률 색상을 기본값으로 초기화하시겠습니까?', { title: '색상 초기화' })) runWithFeedback(onResetColorScale) }}
            disabled={isResettingColorScale}
            className="ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-muted hover:text-brand focus-visible:text-brand disabled:cursor-wait disabled:opacity-70"
          >
            <RefreshIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </p>
        <div className="flex items-center gap-3">
          <ToggleSwitch
            checked={colorCustomOn}
            onChange={() => {
              onChangeColorCustomOn(!colorCustomOn)
              setColorOffNoticeVisible(colorCustomOn)
            }}
            label="색상 범위 커스텀"
            hideLabel
          />
        </div>
      </div>
      <SettingDescription dimmed={!colorCustomOn}>등락률 구간별 종목 박스 색상</SettingDescription>
      {/* 맨 위 9칸 색상바는 9칸이 설정창 폭에 들어가지 않아 지웠다(칸 선택은 아래 막대의 손잡이·0% 표식·상승/하락 선택으로 한다). 지도 하단 범례 바는 그대로다. */}
      <div className="relative mt-[11.5px]">
        {colorEditorProps && (
          <div className={colorCustomOn ? '' : 'opacity-35'} inert={!colorCustomOn}>
            <TreemapColorThresholdEditorPanel {...colorEditorProps} />
          </div>
        )}
        {!colorCustomOn && colorOffNoticeVisible && (
          <span
            role="status"
            // 하락/보합/상승 버튼 줄 한가운데(버튼 높이 26px의 절반)에 둔다 — 막대의 선택 배지와 눈금 글자를 가리지 않는다.
            className={`pointer-events-none absolute left-1/2 top-[13px] z-50 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap ${HINT_BUBBLE_CLASS}`}
          >
            기본 색상이 적용됩니다.
          </span>
        )}
      </div>
    </div>
  )
}

// 선택지는 상단바 시간대 점과 같은 값을 쓰도록 utils/accentPalette에 둔다.
const STRONG_INDUSTRY_COLOR_OPTIONS = ACCENT_PALETTE

export function SettingsStrongIndustryColorSection({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) {
  const bookmark = useContext(SettingsBookmarkContext)
  // 색을 고르면 지도 전체가 다시 그려져 선택 링이 늦게 보이므로, 링은 누른 즉시 따로 보여 주고 지도 색 반영은 한 프레임 뒤로 미룬다(이 값은 외부 저장소라 startTransition으로는 미뤄지지 않는다).
  const [pendingColor, setPendingColor] = useState<{ value: string; base: string } | null>(null)
  if (bookmark.mode === 'bookmark' && !bookmark.ids.includes('strongColor')) return null
  const selectedColor = pendingColor && pendingColor.base === color.toLowerCase() ? pendingColor.value : color.toLowerCase()
  const pick = (value: string) => {
    setPendingColor({ value, base: color.toLowerCase() })
    requestAnimationFrame(() => setTimeout(() => onChange(value), 0))
  }
  return (
    <div className={`settings-first-strong-color text-ui-white ${bookmark.mode === 'bookmark' ? bookmarkItemClass(bookmark, 'strongColor') : 'pt-3'}`}>
      <p className="flex items-center text-[15px]">
        <SettingTitle bookmarkId="strongColor" help>강조 색상</SettingTitle>
        <SettingHelpBubble
          bookmarkId="strongColor"
          label="강조 색상"
          description={<>지도 내 업종명(대분류)과<br /><span className="inline-block whitespace-nowrap font-bold">{settingNumber('topPick')}) 상위 업종 강조</span>의 색상을 설정합니다.</>}
        />
      </p>
      <SettingDescription>업종명과 상위 업종의 강조 색상</SettingDescription>
      {/* 색 동그라미 줄은 다른 슬라이더와 같은 폭(.settings-slider-control)에 양 끝을 맞춘다. 8칸이 들어가도록 동그라미는 22px이다. */}
      <div className="settings-slider-control mt-[42px] flex justify-between">
        {STRONG_INDUSTRY_COLOR_OPTIONS.map(option => (
          <span key={option.value} className="group relative inline-flex">
            <button
              type="button"
              aria-label={`${option.label} 색상 선택`}
              aria-pressed={selectedColor === option.value}
              // 마우스·터치는 누르는 순간 바로 고르고(떼기를 기다리지 않는다), 키보드(Enter/Space)는 click(detail 0)으로 고른다.
              onPointerDown={event => { if (event.button === 0) pick(option.value) }}
              onClick={event => { if (event.detail === 0) pick(option.value) }}
              style={{ backgroundColor: option.value }}
              className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-ui-white/35 p-0"
            >
              {selectedColor === option.value && (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-auto h-3 w-3" fill="none" stroke={hexToHsl(option.value).l > 45 ? 'var(--ui-surface)' : 'var(--ui-white)'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7" />
                </svg>
              )}
            </button>
            <span
              role="tooltip"
              className={`pointer-events-none invisible absolute bottom-full left-1/2 z-50 mb-1 -translate-x-1/2 whitespace-nowrap ${HINT_BUBBLE_CLASS} opacity-0 transition-opacity group-hover:visible group-hover:opacity-100`}
            >
              {option.label}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

interface Props {
  // 헤더에 그대로 표시 — NavSubBar 탭 이름과 동일한 문구(MAP, GROUP 등)를 각 페이지가 그대로 넘겨준다. 안 넘기면 "설정".
  // 생략하면 페이지 이름 없이 "설정"만 표시한다(페이지 이름을 반복하는 동어 반복을 피하고 싶은 페이지용).
  pageLabel?: string
  // 설정 저장·초기화 기능을 제공하는 페이지에서만 헤더 버튼을 표시한다.
  showPreferenceActions?: boolean
  // 탭 없이 패널 본문에 바로 그리는 내용 — 설정 항목이 한두 개뿐인 페이지(그룹)용. 탭 분류(children의
  // SettingsPanelGroup)와 같이 쓰지 않는다.
  plainContent?: ReactNode
  sectionOrder?: readonly SettingsPanelSectionId[]
  taxonomyAtBottom?: boolean
  // Basis 줄이 없는 페이지(관리자)에서 좌우 이동 탭을 다른 페이지와 같은 높이에 둔다.
  fixedSideTab?: boolean
  // 설정창 헤더 오른쪽 끝에 놓을 표시(관리자 페이지의 경고 표시 등).
  headerRight?: ReactNode
  // 하단 Basis 선택 아래에 표시할 종목 분류 최종 변경 시각(지도 상단 표기와 같은 형식).
  snapshotTime?: string | null
  // 사이드바 열림 상태는 페이지가 관리한다.
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  // 분류 체계 선택의 탭은 페이지가 정하고, 박스 크기 선택은 종목 박스 탭에 배치한다.
  taxonomySection?: 'favorites' | 'industry'
  isCustom?: boolean
  onToggleCustom?: () => void
  // 지도의 Basis 선택(KRX / NXT / MARKETRY) — 주면 선택 탭이 이 값을 쓰고, 안 주면 isCustom으로 KRX/MARKETRY만 고른다.
  taxonomy?: TaxonomyKey
  onSelectTaxonomy?: (taxonomy: TaxonomyKey) => void
  avgChangeRateUseSimple?: boolean
  onToggleAvgChangeRateUseSimple?: () => void
  // 지도 페이지의 박스 면적 시가총액 반영 비율(0=동일 크기, 100=시가총액 비례).
  boxSizeMarketCapRatio?: number
  onChangeBoxSizeMarketCapRatio?: (value: number) => void
  // 지도 페이지의 현재/전체 종목 수를 제목 바로 옆에 표시한다.
  stockCountLabel?: string
  // 북마크 기능 — 둘 다 넘긴 페이지에서만 항목 옆 북마크 버튼과 북마크 탭 내용이 동작한다.
  bookmarks?: readonly string[]
  onToggleBookmark?: (id: SettingsBookmarkId) => void
  // 비로그인이면 북마크 탭을 누를 때 탭을 열지 않고 이 함수(로그인 팝업)를 부른다.
  bookmarkLoginRequired?: boolean
  onRequestLogin?: () => void
  // 설정창이 화면 왼쪽에 붙어 있는지와 좌우 이동 함수 — onToggleSide를 넘긴 페이지에서만 헤더에 이동 화살표를 보인다.
  isOnLeft?: boolean
  onToggleSide?: () => void
  // 실제로 보여줄 옵션 섹션들 — 페이지가 자기한테 유효한 Settings*Section만 골라 조립한다.
  // 아무것도 안 넘기면(요약/어드민처럼 이 설정이 전혀 적용 안 되는 페이지) 헤더만 있는 빈 사이드바가 된다.
  children?: ReactNode
}

// 팝업이 아니라 실제 렌더링 영역을 왼쪽으로 밀어내는 도킹형 사이드바 — 헤더 + 스크롤 바디만 그리는
// 껍데기고, 실제 옵션 내용은 전부 위 Settings*Section들을 children으로 조립해서 채운다.
function isSettingsPanelGroup(node: ReactNode): node is ReactElement<SettingsPanelGroupProps> {
  return isValidElement<SettingsPanelGroupProps>(node) && node.type === SettingsPanelGroup
}

export default function SettingsPanel({
  pageLabel,
  showPreferenceActions = true,
  sectionOrder,
  taxonomyAtBottom = false,
  fixedSideTab = false,
  headerRight,
  snapshotTime,
  taxonomySection = 'industry',
  isOpen,
  isCustom,
  onToggleCustom,
  taxonomy,
  onSelectTaxonomy,
  avgChangeRateUseSimple,
  onToggleAvgChangeRateUseSimple,
  boxSizeMarketCapRatio,
  onChangeBoxSizeMarketCapRatio,
  stockCountLabel,
  bookmarks,
  onToggleBookmark,
  bookmarkLoginRequired = false,
  onRequestLogin,
  isOnLeft = false,
  onToggleSide,
  plainContent,
  children,
}: Props) {
  const isLoggedIn = useIsLoggedIn()
  const { commitPreferences, isLoaded: preferencesLoaded } = useCustomPreferences()
  const hasDrafts = useHasDrafts()
  const [isPreferenceFeedbackActive, setIsPreferenceFeedbackActive] = useState(false)
  const preferenceFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (preferenceFeedbackTimerRef.current !== null) clearTimeout(preferenceFeedbackTimerRef.current)
  }, [])
  const runPreferenceAction = (action: () => void) => {
    if (preferenceFeedbackTimerRef.current !== null) return
    // 설정 반영은 즉시 실행하고, 로딩 화면만 공통 시간 동안 유지한다.
    setIsPreferenceFeedbackActive(true)
    preferenceFeedbackTimerRef.current = setTimeout(() => {
      preferenceFeedbackTimerRef.current = null
      setIsPreferenceFeedbackActive(false)
    }, REFRESH_FEEDBACK_MIN_DURATION_MS)
    action()
  }
  // 로그인 사용자는 서버 저장값이 오기 전까지 설정창 값을 흐리게 두고 조작을 막는다(기본값이 저장값처럼 보이는 것을 막기 위해).
  // 서버가 끝내 응답하지 않으면 SETTINGS_LOAD_WAIT_MS 뒤에는 풀어 준다.
  const [loadWaitExpired, setLoadWaitExpired] = useState(false)
  const waitingForPreferences = isLoggedIn && !preferencesLoaded && !loadWaitExpired
  useEffect(() => {
    if (!isLoggedIn || preferencesLoaded) return
    const timer = setTimeout(() => setLoadWaitExpired(true), SETTINGS_LOAD_WAIT_MS)
    return () => clearTimeout(timer)
  }, [isLoggedIn, preferencesLoaded])
  // 좌우 이동 탭은 "Basis" 줄(앞에 색 막대가 있는 줄)의 높이에 맞춘다. 그 줄이 없으면 가운데에 둔다.
  const outerRef = useRef<HTMLDivElement>(null)
  const sideTabRef = useRef<HTMLButtonElement>(null)
  // 설정창 안 내용(분류 선택 줄의 위치, 창 높이)이 바뀔 수 있어 그릴 때마다 다시 잰다. 전체화면처럼 다시 그리지 않고 크기만 바뀌는 경우는
  // 크기 변화를 지켜보다가 다시 잰다.
  useLayoutEffect(() => {
    alignSideTab(outerRef.current, sideTabRef.current, fixedSideTab)
  })
  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const realign = () => alignSideTab(outerRef.current, sideTabRef.current, fixedSideTab)
    const observer = new ResizeObserver(realign)
    observer.observe(outer)
    window.addEventListener('resize', realign)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', realign)
    }
  })
  const [activeSection, setActiveSection] = useState<SettingsPanelSectionId>(sectionOrder?.[0] ?? 'composition')
  // 닫힐 때 사라지는 모습을 보여주려고, isOpen이 꺼져도 닫기 애니메이션이 끝날 때까지는 화면에 남겨 둔다.
  // animated는 열림 상태가 한 번이라도 바뀐 뒤에만 켜서, 페이지를 처음 열 때 이미 열려 있는 설정창은 애니메이션 없이 보인다.
  const [mounted, setMounted] = useState(isOpen)
  const [animated, setAnimated] = useState(false)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen)
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen)
    setAnimated(true)
    if (isOpen) setMounted(true)
  }
  useEffect(() => {
    if (isOpen || !mounted) return
    const timer = window.setTimeout(() => setMounted(false), SIDEBAR_ANIMATION_MS)
    return () => window.clearTimeout(timer)
  }, [isOpen, mounted])
  const childNodes = Children.toArray(children)
  const sectionContent = new Map<SettingsPanelSectionId, ReactNode[]>()
  const addSectionContent = (section: SettingsPanelSectionId, content: ReactNode) => {
    const existing = sectionContent.get(section) ?? []
    existing.push(content)
    sectionContent.set(section, existing)
  }

  for (const node of childNodes) {
    if (!isSettingsPanelGroup(node)) continue
    addSectionContent(node.props.section, node.props.children)
  }

  // 기존 페이지에서 아직 group wrapper를 붙이지 않은 아이들은 종목 구성 탭에 넣어 이전 호출부도
  // 계속 표시한다. 각 페이지 통합이 끝나면 모든 설정이 명시적인 group 아래에 놓인다.
  const ungroupedNodes = childNodes.filter(node => !isSettingsPanelGroup(node))
  if (ungroupedNodes.length > 0) addSectionContent('composition', ungroupedNodes)
  const hasTaxonomySelector = Boolean(taxonomy && onSelectTaxonomy) || (typeof isCustom === 'boolean' && Boolean(onToggleCustom))
  const selectedTaxonomy: TaxonomyKey = taxonomy ?? (isCustom ? 'MARKETRY' : 'KRX')
  const handleSelectTaxonomy = onSelectTaxonomy ?? (() => onToggleCustom?.())
  const hasStockSizeSelector = typeof avgChangeRateUseSimple === 'boolean' && Boolean(onToggleAvgChangeRateUseSimple)
  const hasBoxSizeRatioSlider = typeof boxSizeMarketCapRatio === 'number' && Boolean(onChangeBoxSizeMarketCapRatio)

  const availableSections = SETTINGS_SECTIONS.filter(section => sectionContent.has(section.id))
  if (sectionOrder) {
    availableSections.sort((a, b) => sectionOrder.indexOf(a.id) - sectionOrder.indexOf(b.id))
  }
  const selectedSection = availableSections.find(section => section.id === activeSection) ?? availableSections[0]
  const isNonScrollingSection = !taxonomyAtBottom && (selectedSection?.id === 'industry' || selectedSection?.id === 'colors')

  // 북마크 탭에는 원래 위치 번호(탭 번호-항목 번호)를 보여준다. 항목 번호는 각 탭에서 항상 고정된 자리다.
  const bookmarkContext: SettingsBookmarkContextValue = {
    enabled: Boolean(onToggleBookmark),
    mode: selectedSection?.id === 'favorites' ? 'bookmark' : 'source',
    ids: bookmarks ?? [],
    firstId: BOOKMARK_ORDER.find(id => (bookmarks ?? []).includes(id)),
    numbers: Object.fromEntries(
      (Object.keys(SETTING_ITEM_POSITIONS) as SettingsBookmarkId[]).map(id => [id, settingNumber(id)]),
    ),
    onToggle: id => onToggleBookmark?.(id),
  }

  // 닫혀있을 땐 아예 렌더링하지 않는다(트리거 버튼은 더 이상 이 컴포넌트가 아니라 호출부가 따로 그린다).
  if (!isOpen && !mounted) return null
  const sideName = isOnLeft ? 'left' : 'right'
  const animationClass = !animated ? '' : isOpen ? `settings-panel-enter-${sideName}` : `settings-panel-leave-${sideName} pointer-events-none`

  // 바꾼 값은 임시값이라 저장을 눌러야 서버에 올라간다. 초기화는 임시값을 버리고 저장값으로 돌아간다. 비로그인은 저장할 곳이 없어 로그인 창을 띄운다.
  // 오른쪽으로 3px 당겨(-mr-[3px]) 저장 아이콘이 위쪽 상단 바의 설정 아이콘과 같은 세로줄에 오게 한다.
  const preferenceActions = showPreferenceActions ? (
    <div className="-mr-[3px] ml-auto flex shrink-0 items-center gap-1">
      <button type="button" aria-label="초기화" data-hint="저장값으로 되돌리기" disabled={isPreferenceFeedbackActive} onClick={async () => {
          if (hasDrafts && await appConfirm('기존 저장값으로 되돌리시겠습니까?', { title: '되돌리기' })) runPreferenceAction(discardDrafts)
        }} className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50">
        <HistoryIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="저장"
        // 비로그인도 같은 툴팁이 뜨고, 누르면 로그인 창이 열린다.
        data-hint="변경값으로 저장하기"
        disabled={isPreferenceFeedbackActive}
        onClick={async () => {
          if (!isLoggedIn) { onRequestLogin?.(); return }
          if (!hasDrafts) return
          if (!preferencesLoaded) {
            appAlert('저장된 설정을 아직 불러오지 못했습니다.\n잠시 후 다시 시도해 주세요.', { title: '불러오기 실패' })
            return
          }
          if (!await appConfirm('지금 변경사항을 저장하시겠습니까?', { title: '저장하기' })) return
          // 저장에 실패하면 임시값은 그대로 남아 있으니 알리고, 사용자가 다시 저장하게 한다.
          runPreferenceAction(() => {
            commitDrafts(commitPreferences).catch(() => appAlert('저장하지 못했습니다.\n변경한 값은 그대로 남아 있으니 잠시 후 다시 저장해 주세요.', { title: '저장 실패' }))
          })
        }}
        className="group relative flex h-6 w-6 items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none transition-colors hover:text-brand focus-visible:text-brand disabled:opacity-50"
      >
        {hasDrafts && <span aria-hidden="true" className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-brand" />}
        {/* 좌우 대칭 디스켓 — 위쪽 셔터와 아래쪽 라벨이 가운데에 있고 접힌 모서리가 없다. 오른쪽 위 청록 점(변경 있음)과 겹치는 모양이 없다. */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM7 3v5h10V3M7 21v-8h10v8" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  ) : null

  return (
    // 바깥 감싸개: 지도 쪽 가장자리 가운데에 튀어나오는 좌우 이동 탭을 패널(overflow-hidden) 밖에 그리려고 둔다. 슬라이드 애니메이션도 여기에 붙는다.
    <div ref={outerRef} data-settings-panel-shell className={`relative z-20 flex shrink-0 ${animationClass}`}>
    {onToggleSide && (
      <button
        type="button"
        onClick={onToggleSide}
        aria-label={isOnLeft ? '설정창을 오른쪽으로 이동' : '설정창을 왼쪽으로 이동'}
        data-hint={isOnLeft ? '설정창을 오른쪽으로 이동' : '설정창을 왼쪽으로 이동'}
        ref={sideTabRef}
        style={{ backgroundColor: TAXONOMY_BACKGROUND_COLOR }}
        className={`absolute top-1/2 z-10 flex h-8 w-[14px] -translate-y-1/2 items-center justify-center border border-ui-border p-0 text-ui-muted hover:text-brand focus-visible:text-brand ${
          isOnLeft ? '-right-[13px] rounded-r-lg border-l-0' : '-left-[13px] rounded-l-lg border-r-0'
        }`}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
          <path
            d={isOnLeft ? 'M13.5 3v10M2 8h9M7.5 4.5 11 8l-3.5 3.5' : 'M2.5 3v10M14 8H5M8.5 4.5 5 8l3.5 3.5'}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    )}
    <div
      data-settings-panel
      className="relative tabular-nums select-none flex w-72 shrink-0 flex-col overflow-hidden rounded-md border border-ui-border bg-ui-panel"
      style={{ '--accent': 'var(--panel-gray)', '--accent-hover': 'var(--ui-white)', '--accent-light': 'var(--panel-gray)' } as CSSProperties}
    >
      {/* 지도 최상단 종목 박스에 맞춘 헤더 높이를 유지하고 내용은 세로 중앙에 둔다. */}
      <div className="flex shrink-0 items-center border-b border-ui-border px-4 py-[10.25px]">
        <div className="flex min-w-0 items-center gap-2">
          <p className="font-roboto-latin flex h-7 min-w-[72.75px] items-center whitespace-nowrap text-lg font-bold leading-none text-ui-white">
            {/* 제목 칸 최소 폭은 가장 긴 제목(Custom)에 맞춘 값이라 Map·Group에서도 옆의 종목/업종 배지가 같은 자리에 온다. */}
            {/* 아래 Basis 제목 앞의 막대와 같은 모양·같은 자리(왼쪽 여백 16px)다. */}
            <span aria-hidden="true" className="mr-[6px] inline-block h-5 w-1 shrink-0 rounded-sm bg-brand" />
            {pageLabel ?? '설정'}
          </p>
          {stockCountLabel && (
            <span className="flex h-7 w-[7rem] shrink-0 items-center whitespace-nowrap text-sm leading-none text-ui-muted">
              <CountLabelWithBadge label={stockCountLabel} alignEnd />
            </span>
          )}
        </div>
        {preferenceActions}
        {headerRight && <div className="-mr-[3px] ml-auto flex shrink-0 items-center">{headerRight}</div>}
      </div>
      {availableSections.length > 0 && (
      <nav role="tablist" aria-label={pageLabel ? `${pageLabel} 설정 분류` : '설정 분류'} className="flex h-[68px] shrink-0 items-stretch border-b border-ui-border bg-ui-panel px-1">
          {availableSections.map(section => {
            const selected = section.id === selectedSection?.id
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`settings-panel-${section.id}`}
                id={`settings-tab-${section.id}`}
                onClick={() => {
                  // 비로그인이 북마크 탭을 누르면 탭을 열지 않고 바로 로그인 팝업을 띄운다.
                  if (section.id === 'favorites' && bookmarkLoginRequired && onRequestLogin) onRequestLogin()
                  else setActiveSection(section.id)
                }}
                className={`group relative box-border flex h-full min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 border-0 bg-transparent px-1 pt-2 pb-3 text-[12px] leading-tight transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent)] ${
                  selected ? 'text-brand' : 'text-ui-muted hover:text-brand'
                }`}
              >
                <SettingsSectionIcon icon={section.icon} />
                <span className="max-w-full truncate font-bold">{section.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-2 bottom-0 h-0.5 bg-brand transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}
                />
              </button>
            )
          })}
        </nav>
      )}
      {/* 로딩은 헤더·탭과 하단 업종 분류 사이의 설정 본문 영역만 덮는다. */}
      <div aria-busy={isPreferenceFeedbackActive || undefined} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="contents" inert={isPreferenceFeedbackActive || undefined}>
      {plainContent && (
        <div data-align-second-heading className="settings-section-list settings-plain-content settings-panel-tab-content min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-8 text-sm">
          {plainContent}
        </div>
      )}
      {!plainContent && availableSections.length === 0 && <div className="min-h-0 flex-1" />}
      <SettingsFeedbackContext.Provider value={runPreferenceAction}>
      <SettingsBookmarkContext.Provider value={bookmarkContext}>
      {selectedSection && (
        <div
          role="tabpanel"
          id={`settings-panel-${selectedSection.id}`}
          aria-labelledby={`settings-tab-${selectedSection.id}`}
          data-align-second-heading={(taxonomyAtBottom && selectedSection.id !== 'favorites') || undefined}
          aria-busy={waitingForPreferences || undefined}
          inert={waitingForPreferences || undefined}
          className={`${waitingForPreferences ? 'opacity-35 transition-opacity' : ''} settings-section-list settings-panel-tab-content min-h-0 flex-1 px-4 text-sm ${selectedSection.id === 'favorites' ? 'settings-bookmark-tab' : ''} ${
            isNonScrollingSection ? 'overflow-y-clip pb-2' : 'overflow-y-auto pb-8'
          }`}
        >
          {!taxonomyAtBottom && selectedSection.id === taxonomySection && hasTaxonomySelector && (
            <SettingsTaxonomySelector taxonomy={selectedTaxonomy} onSelectTaxonomy={handleSelectTaxonomy} />
          )}
          {selectedSection.id === 'stockDisplay' && hasBoxSizeRatioSlider ? (
            <SettingsStockSizeSelector
              marketCapRatio={boxSizeMarketCapRatio!}
              onChangeMarketCapRatio={onChangeBoxSizeMarketCapRatio!}
            />
          ) : selectedSection.id === 'stockDisplay' && hasStockSizeSelector ? (
            <SettingsAverageModeSelector
              avgChangeRateUseSimple={avgChangeRateUseSimple!}
              onToggleAvgChangeRateUseSimple={onToggleAvgChangeRateUseSimple!}
            />
          ) : null}
          {/* 북마크 항목 한 칸(160px)과 같은 높이 안에서 글자를 세로 가운데에 둔다. 탭 위 여백(20px)은 .settings-bookmark-tab이 준다. */}
          {selectedSection.id === 'favorites' && bookmarkContext.enabled && bookmarkContext.ids.length === 0 && (
            <p className="flex h-[160px] items-center justify-center text-center text-xs font-medium leading-relaxed text-ui-text">
              북마크한 항목이 없습니다.
            </p>
          )}
          {sectionContent.get(selectedSection.id)?.map((content, index) => <Fragment key={index}>{content}</Fragment>)}
        </div>
      )}
      </SettingsBookmarkContext.Provider>
      </SettingsFeedbackContext.Provider>
      </div>
      {isPreferenceFeedbackActive && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ui-panel">
          <Spinner showLogo className="aspect-square w-4/5 shrink-0" />
        </div>
      )}
      </div>
      {taxonomyAtBottom && hasTaxonomySelector && (
        <>
          <SettingsTaxonomySelector taxonomy={selectedTaxonomy} onSelectTaxonomy={handleSelectTaxonomy} atBottom snapshotTime={snapshotTime} />
        </>
      )}
    </div>
    </div>
  )
}
