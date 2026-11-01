import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragMoveEvent, type DragOverEvent } from '@dnd-kit/core'
import type { SectorItem } from '@/types/api'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useHeatmapCustom'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { sectorCollisionDetection } from '@/utils/dndCollision'
import { toCount, toJoEokDecimal } from '@/utils/format'
import { PROTECTED_SECTOR_TEXT_CLASS, getProtectedSectorDeleteMessage, getProtectedSectorHint, isProtectedSectorName, placeProtectedSectorsLast } from '@/utils/protectedSector'
import { EMPTY_SECTOR_STATS, sectorNamesByDepth, type SectorStats } from '@/utils/sectorOrder'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { SearchBar, SortLabel, type SortDirection } from '@/components/ReadOnlyTaxonomySheet'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'
import ChangeHistoryControls from '@/components/ChangeHistoryControls'
import EmptyMessage, { EMPTY_SEARCH_MESSAGE } from '@/components/EmptyMessage'
import { CloseIcon, EditIcon, NestIntoIcon, PlusIcon, TrashIcon } from '@/components/icons/AppIcons'
import { STOCK_HEADER_ROW_PX } from '@/utils/stockTableColumns'
import ColumnFilterButton from '@/components/ColumnFilterButton'
import ScrollArea from '@/components/ScrollArea'
import { compareKoreanText } from '@/utils/koreanSort'

interface Props {
  sectors: SectorItem[]
  settingsActionsTarget?: HTMLElement | null
  // 검색창을 그릴 윗줄의 자리(왼쪽 제목 박스 옆).
  toolbarContainer?: HTMLElement | null
  // 검색창 옆에 두던 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
  // 업종 번호별 시가총액 합·종목 수(지도 데이터의 전체 종목 기준) — 열의 기본 순서와 숫자 칸에 쓴다.
  sectorStats?: SectorStats
}

// 업종 열의 정렬 기준 — 기본은 시가총액 합이 큰 순서이고, 아랫줄 머리글을 눌러 바꾼다(열마다 따로).
type SectorSortKey = 'name' | 'marketValue' | 'stockCount'
type SectorSort = { key: SectorSortKey; direction: SortDirection }
const DEFAULT_SECTOR_SORT: SectorSort = { key: 'marketValue', direction: 'desc' }
// 표 머리글(58px)을 반으로 나눈 한 줄의 높이 — 윗줄은 분류 이름·필터, 아랫줄은 업종·시가총액 합·종목 수 정렬이다.
const HEADER_HALF_PX = STOCK_HEADER_ROW_PX / 2
// 한 열 안의 세 칸(업종·시가총액 합·종목 수) 폭 비율 — 머리글 아랫줄과 본문이 같이 쓴다.
const SECTOR_COLUMN_WIDTHS = ['50%', '25%', '25%'] as const

// 섹터 깊이 상한(최상위=0) — 4단계(0~3)까지만 허용하고 5단계 섹터는 만들지 못하게 한다. 나중에 한 단계 더
// 늘릴 때는 이 값만 바꾸면 추가 버튼과 드래그 이동 제한이 같이 따라간다.
const MAX_SECTOR_DEPTH = 3

// 업종 경로의 구분 표시 — 글자가 작은 '›' 대신 읽기 쉬운 '>'를 쓴다(금융 > 은행). 경로를 만들고 다시 나눌 때 같은 값을 쓴다.
const SECTOR_PATH_SEPARATOR = ' > '
// 보호 업종(신규 상장·거래 정지·미분류) — 삭제·이름 변경·이동·하위 업종 만들기가 막히고, 대분류에만 있다(서버도 막는다).
const isProtectedSector = (sector: SectorItem) => sector.parentId === null && isProtectedSectorName(sector.name)
const MAX_SECTOR_LEVELS = MAX_SECTOR_DEPTH + 1
// "하위 업종 추가" 아이콘은 대분류·중분류(깊이 0·1)에만 보여 준다 — 소분류 이하에는 더 만들지 않는다. 이미 있는 4단계 업종은 그대로 둔다.
const ADD_CHILD_MAX_PARENT_DEPTH = 1

// 섹터 이름 글자 수 상한(공백 포함) — 대/중/소분류 구분 없이 통일한다. 이미 이 길이를 넘는 이름은 그대로
// 표시되고, 이름을 고칠 때만 제한이 걸린다.
const MAX_SECTOR_NAME_LENGTH = 12

// 업종명 입력칸 — 글자 수 상한에 닿으면 칸 아래에 이유를 알려 준다(상한을 넘는 글자는 조용히 잘리므로).
function SectorNameInput({ wrapperClassName = '', onChange, onFocus, onBlur, ...props }: ComponentProps<'input'> & { wrapperClassName?: string }) {
  const [focused, setFocused] = useState(false)
  const atLimit = typeof props.value === 'string' && props.value.length >= MAX_SECTOR_NAME_LENGTH
  return (
    <span className={`relative ${wrapperClassName}`}>
      <input
        type="text"
        maxLength={MAX_SECTOR_NAME_LENGTH}
        {...props}
        // 한글처럼 글자를 조합하며 치는 입력은 maxLength를 넘는 한 글자가 조합 중에 잠깐 보인다 — 넘는 순간 바로 잘라 낸다.
        onChange={e => {
          if (e.target.value.length > MAX_SECTOR_NAME_LENGTH) e.target.value = e.target.value.slice(0, MAX_SECTOR_NAME_LENGTH)
          onChange?.(e)
        }}
        onFocus={e => { setFocused(true); onFocus?.(e) }}
        onBlur={e => { setFocused(false); onBlur?.(e) }}
        // 한글을 치는 중(마지막 글자가 아직 조합 중)에 누른 엔터는 글자를 확정할 뿐이다 — 이때 추가·이름 변경으로 넘기면 "반도체"와 남은 "체"가 따로 만들어진다.
        onKeyDown={e => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return
          props.onKeyDown?.(e)
        }}
      />
      {focused && atLimit && (
        <span role="status" className={`pointer-events-none absolute left-0 top-full z-50 mt-1 whitespace-nowrap ${HINT_BUBBLE_CLASS}`}>
          최대 {MAX_SECTOR_NAME_LENGTH}자까지 입력할 수 있습니다.
        </span>
      )}
    </span>
  )
}

type Row =
  | { type: 'sector'; item: SectorItem; siblingIndex: number }
  | { type: 'add-child'; parentId: number; parentPath: string[]; depth: number }

// 업종 화면 변경 내역 — 이동·이름 바꾸기를 되돌리고 다시 적용한다(추가·삭제는 아직 기록하지 않는다).
type SectorHistoryAction =
  | { id: string; type: 'reparent'; sectorId: number; name: string; fromParentId: number | null; toParentId: number | null }
  | { id: string; type: 'rename'; sectorId: number; before: string; after: string }
type SectorHistoryInput = SectorHistoryAction extends infer A ? (A extends { id: string } ? Omit<A, 'id'> : never) : never
const SECTOR_HISTORY_LIMIT = 9
const DRAG_CONTROL_CLASS = 'cursor-grab touch-none rounded-sm border-0 bg-brand-surface text-ui-white transition-colors hover:bg-brand-surface-hover focus-visible:bg-brand-surface-hover focus-visible:outline-none'

// 번호 칸 — 업종은 끌어서 다른 업종 위에 놓으면 그 안으로 이동한다(업종 순서는 항상 가나다 순이라 바꾸지 못한다).
const NUMBER_BADGE_CLASS = 'mr-[10px] inline-flex h-6 w-8 shrink-0 items-center justify-end p-0 pr-1 text-sm leading-none font-medium tabular-nums'
// 번호 대신 아이콘이 들어갈 때의 배지 — 크기·색은 같고 아이콘만 가로·세로 가운데에 놓는다.
const ICON_BADGE_CLASS = 'mr-[10px] inline-flex h-6 w-8 shrink-0 items-center justify-center p-0'

// 다른 업종을 끄는 동안 배지 색 — 놓을 수 있는 줄은 회색(예전 "여기" 배지 색), 지금 그 위에 올라간 줄은 청록으로 채우고, 놓을 수 없는 줄은 같은 외곽선에 더 어두운 바탕과 흐린 글자다.
const DROP_BADGE_CLASS = {
  target: 'rounded-sm border border-[var(--ui-muted)] bg-[var(--ui-control)] text-ui-white',
  over: 'rounded-sm border border-transparent bg-[var(--brand)] text-ui-background',
  blocked: 'rounded-sm border border-[var(--ui-muted)] bg-[var(--ui-panel)] text-ui-muted',
} as const

// dropState — 다른 업종을 끄는 동안 번호 대신 아이콘을 보여 준다: 놓을 수 있는 줄은 하위로 넣는 아이콘(over는 그 위에 올라간 줄), 놓을 수 없는 줄은 ✕이다.
function DraggableNumberBadge({ sectorId, parentId, children, dropState = null, locked = false }: { sectorId: number; parentId: number | null; children: React.ReactNode; dropState?: 'target' | 'over' | 'blocked' | null; locked?: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `sector-move-${sectorId}`,
    data: { sectorId, parentId },
    disabled: locked,
  })
  // 보호 업종은 옮길 수 없으니 끌 수 있는 버튼이 아니라 번호만 보여 준다(다른 업종을 끄는 동안에는 ✕/아이콘 배지가 그대로 뜬다).
  if (locked && !dropState) {
    return <span className={`${NUMBER_BADGE_CLASS} rounded-sm bg-brand-surface text-ui-white`}>{children}</span>
  }
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      data-hint="끌어서 다른 업종 하위로 이동"
      aria-label={dropState === 'blocked' ? '이동할 수 없는 위치' : dropState ? '여기로 이동' : undefined}
      className={dropState ? `${ICON_BADGE_CLASS} touch-none ${DROP_BADGE_CLASS[dropState]}` : `${NUMBER_BADGE_CLASS} ${DRAG_CONTROL_CLASS}`}
    >
      {dropState === 'blocked' ? <CloseIcon className="h-4 w-4" /> : dropState ? <NestIntoIcon className="h-4 w-4" /> : children}
    </button>
  )
}

// 열 머리글 — 번호 칸을 끄는 동안 대분류 머리글에 놓으면 그 업종이 최상위(대분류)가 되고, 중·소분류 머리글에 놓으면 지금 열려 있는 대분류·중분류의 하위가 된다(같은 위치이거나 깊이 한도를 넘으면 ✕). 끄는 중이 아닐 때는 보통 머리글이다.
function ColumnDropHeader({ depth, className, children, style }: { depth: number; className: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const { setNodeRef } = useDroppable({ id: `sector-drop-header-${depth}`, data: { headerDepth: depth } })
  return (
    <div ref={setNodeRef} className={className} style={style}>
      {children}
    </div>
  )
}

// 다른 섹터가 이 섹터 위로 드롭되면 그 자식으로 재배정되는 드롭존. 행 전체를 감싼다.
function DroppableSectorRow({
  sectorId,
  className,
  onClick,
  style,
  children,
}: {
  sectorId: number
  className: string
  onClick?: React.MouseEventHandler<HTMLTableRowElement>
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  const { setNodeRef } = useDroppable({
    id: `sector-drop-${sectorId}`,
    data: { sectorId },
  })
  return (
    <tr ref={setNodeRef} data-sector-row={sectorId} className={className} onClick={onClick} style={style}>
      {children}
    </tr>
  )
}

export default function AdminSectorTable({ sectors, settingsActionsTarget, toolbarContainer, onCountLabelChange, sectorStats = EMPTY_SECTOR_STATS }: Props) {
  const [query, setQuery] = useState('')
  const [sortByDepth, setSortByDepth] = useState<Record<number, SectorSort | undefined>>({})
  // 머리글 필터 목록의 보기 순서 — 가나다 순(기본) 또는 시가총액 합 순.
  const [sectorFilterMode, setSectorFilterMode] = useState<'alpha' | 'cap'>('alpha')
  const [excludedByDepth, setExcludedByDepth] = useState<Record<number, ReadonlySet<string>>>({})
  const [undoStack, setUndoStack] = useState<SectorHistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<SectorHistoryAction[]>([])
  const historyCounter = useRef(0)
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null)
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null)
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [childNameByParent, setChildNameByParent] = useState<Record<number, string>>({})
  // 펼침과 무관하게 "지금 이 섹터 밑에 추가 입력줄을 보여줄지"만 따로 관리 — 한 번에 하나만 연다.
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  // 이름 변경 입력칸을 엔터·Esc·바깥 클릭 중 한 번만 닫게 하는 표시 — 엔터로 저장한 뒤 칸이 사라지며 바깥 클릭 저장이 한 번 더 도는 것을 막는다.
  const renameClosingRef = useRef(false)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [draggedSector, setDraggedSector] = useState<SectorItem | null>(null)
  // 번호 칸을 끌어 다른 분류로 옮기는 중인지(끌 수 있는 것은 번호 칸뿐이다), 그리고 지금 놓으면 들어갈 업종.
  const isMoveDrag = draggedSector !== null
  // 이동하거나 새로 만든 업종 — 다음 조작 전까지 배경색으로 표시하고, 목록이 다시 그려진 뒤 화면 안으로 스크롤한다.
  const [recentlyChangedSectorId, setRecentlyChangedSectorId] = useState<number | null>(null)
  const [recentChangeType, setRecentChangeType] = useState<'신규' | '이동' | null>(null)
  const scrollToRecentChangeRef = useRef(false)
  const [moveOverId, setMoveOverId] = useState<number | null>(null)
  // 지금 커서가 올라가 있는 열 머리글(0=대분류·1=중분류·2=소분류) — 놓을 수 있는 머리글일 때만 값이 있다.
  const [moveOverHeader, setMoveOverHeader] = useState<number | null>(null)
  // 끌고 있는 줄의 크기와, 번호 칸(끄는 대상) 기준 줄 왼쪽 위 모서리 위치 — 미리보기가 원래 줄을 오차 없이 그대로 덮도록 같은 크기·같은 자리에서 그린다.
  const [draggedRow, setDraggedRow] = useState<{ width: number; height: number; offsetX: number; offsetY: number } | null>(null)

  // MARKETRY·거래소 업종 표와 같은 순환 — 오름차순 → 내림차순 → 기본(시가총액 합 큰 순)으로 돌아간다.
  const toggleSort = (depth: number, key: SectorSortKey) => setSortByDepth(previous => {
    const current = previous[depth]
    if (!current || current.key !== key) return { ...previous, [depth]: { key, direction: 'asc' } }
    if (current.direction === 'asc') return { ...previous, [depth]: { key, direction: 'desc' } }
    return { ...previous, [depth]: undefined }
  })
  const toggleDepthFilter = (depth: number, value: string) => setExcludedByDepth(previous => {
    const next = new Set(previous[depth] ?? [])
    if (next.has(value)) next.delete(value)
    else next.add(value)
    return { ...previous, [depth]: next }
  })
  const createSector = useCreateSector()
  const renameSector = useRenameSector()
  const { remove } = useSectorDeleteFlow()
  const reparentSector = useReparentSector()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasChildren = (id: number) => sectors.some(c => c.parentId === id)

  const isDescendant = (sector: SectorItem, ancestorId: number): boolean => {
    let current: SectorItem | undefined = sector
    while (current && current.parentId !== null) {
      if (current.parentId === ancestorId) return true
      const parentId: number = current.parentId
      current = sectors.find(c => c.id === parentId)
    }
    return false
  }

  const getMoveCandidates = (moved: SectorItem) => {
    const subtreeHeight = sectors
      .filter(c => c.depth > moved.depth && isDescendant(c, moved.id))
      .reduce((max, c) => Math.max(max, c.depth - moved.depth), 0)
    return sectors.filter(candidate =>
      !isProtectedSector(candidate) &&
      candidate.id !== moved.id &&
      !isDescendant(candidate, moved.id) &&
      candidate.id !== moved.parentId &&
      // 소분류(깊이 2) 이하에는 더 넣지 않는다 — 옮긴 뒤 가장 깊은 업종도 소분류(깊이 2)를 넘지 않아야 한다.
      candidate.depth <= ADD_CHILD_MAX_PARENT_DEPTH &&
      candidate.depth + 1 + subtreeHeight <= ADD_CHILD_MAX_PARENT_DEPTH + 1,
    )
  }

  // 번호 배지를 끌면 옮길 업종이 정해지고, 놓을 수 있는 줄(번호 자리가 아이콘 배지로 바뀐다)이나 대분류 머리글에 놓으면 확인 뒤 옮긴다.
  // 줄을 누르면 평소처럼 펼쳐지므로(선택 변경) 다른 가지의 업종도 찾아가서 고를 수 있다.
  const getSectorPath = (sector: SectorItem) => {
    const path = [sector.name]
    let current = sector
    while (current.parentId !== null) {
      const parent = sectors.find(item => item.id === current.parentId)
      if (!parent) break
      path.unshift(parent.name)
      current = parent
    }
    return path.join(SECTOR_PATH_SEPARATOR)
  }

  // 이동 확인 문구 — 대상이 없으면 최상위로 옮기는 것이다.
  const moveMessage = (name: string, target: SectorItem | null) =>
    `[${name}]\n${target ? `[${getSectorPath(target)}] 하위로` : '최상위로'} 이동하시겠습니까?`

  // 변경 내역 — 새 변경을 쌓으면 다시 적용 목록은 비운다.
  const pushHistory = (action: SectorHistoryInput) => {
    historyCounter.current += 1
    setUndoStack(previous => [...previous, { ...action, id: String(historyCounter.current) } as SectorHistoryAction].slice(-SECTOR_HISTORY_LIMIT))
    setRedoStack([])
  }
  const applyHistoryAction = (action: SectorHistoryAction, direction: 'before' | 'after') => {
    if (action.type === 'reparent') {
      reparentSector.mutate({ id: action.sectorId, parentId: direction === 'before' ? action.fromParentId : action.toParentId }, { onSuccess: () => triggerHighlight(action.sectorId) })
    } else {
      renameSector.mutate({ id: action.sectorId, name: direction === 'before' ? action.before : action.after }, { onSuccess: () => triggerHighlight(action.sectorId) })
    }
  }
  // 맨 위(다음 차례)부터 고른 항목까지 순서대로 처리한다 — 한 단계만 하려면 인덱스가 맨 끝이다.
  const undoUntil = (index: number) => {
    const applied = undoStack.slice(index).reverse()
    for (const action of applied) applyHistoryAction(action, 'before')
    setUndoStack(undoStack.slice(0, index))
    setRedoStack(previous => [...previous, ...applied])
  }
  const redoUntil = (index: number) => {
    const applied = redoStack.slice(index).reverse()
    for (const action of applied) applyHistoryAction(action, 'after')
    setRedoStack(redoStack.slice(0, index))
    setUndoStack(previous => [...previous, ...applied])
  }
  const handleUndo = () => { if (undoStack.length > 0) undoUntil(undoStack.length - 1) }
  const handleRedo = () => { if (redoStack.length > 0) redoUntil(redoStack.length - 1) }
  const describeHistoryAction = (action: SectorHistoryAction) => {
    const nameOf = (id: number | null) => (id === null ? '최상위' : (sectors.find(item => item.id === id)?.name ?? '(삭제됨)'))
    if (action.type === 'reparent') return `${action.name}: ${nameOf(action.fromParentId)} → ${nameOf(action.toParentId)} 이동`
    return `${action.before} → ${action.after} 이름 변경`
  }
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        if (event.shiftKey) handleRedo()
        else handleUndo()
      } else if (key === 'y') {
        event.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 되돌리기·다시 적용 목록이 바뀔 때마다 새 처리 함수로 다시 등록한다(handleUndo·handleRedo는 매 렌더 새 함수라 deps에 넣지 않는다)
  }, [undoStack, redoStack])

  const toggleAddChild = (id: number) => {
    const parent = sectors.find(c => c.id === id)
    if (parent && parent.depth >= MAX_SECTOR_DEPTH) {
      appAlert(`업종은 ${MAX_SECTOR_LEVELS}단계까지만 만들 수 있습니다.`, { title: '추가 제한' })
      return
    }
    if (parent?.depth === 0) { setSelectedMajorId(id); setSelectedMiddleId(null) }
    if (parent?.depth === 1) setSelectedMiddleId(id)
    setAddingChildFor(prev => (prev === id ? null : id))
  }

  const triggerHighlight = (id: number) => {
    setHighlightedId(id)
    setTimeout(() => setHighlightedId(current => (current === id ? null : current)), 2000)
  }

  const markRecentChange = (id: number, type: '신규' | '이동') => {
    setRecentlyChangedSectorId(id)
    setRecentChangeType(type)
    scrollToRecentChangeRef.current = true
  }

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    // 서버가 거절하거나 실패하면(안내창이 뜬다) 입력했던 이름을 칸에 되돌려 다시 입력하지 않게 한다.
    createSector.mutate({ name: trimmed, parentId: null }, {
      onSuccess: created => triggerHighlight(created.id),
      onError: () => setNewName(trimmed),
    })
    setNewName('')
  }

  const handleCreateChild = (parentId: number) => {
    const parent = sectors.find(c => c.id === parentId)
    if (parent && parent.depth >= MAX_SECTOR_DEPTH) return
    const trimmed = (childNameByParent[parentId] ?? '').trim()
    if (!trimmed) return
    createSector.mutate({ name: trimmed, parentId }, {
      onSuccess: created => {
        markRecentChange(created.id, '신규')
        triggerHighlight(created.id)
        setChildNameByParent(prev => ({ ...prev, [parentId]: '' }))
        setAddingChildFor(current => current === parentId ? null : current)
      },
      onError: () => setChildNameByParent(prev => ({ ...prev, [parentId]: trimmed })),
    })
  }

  const startRename = (sector: SectorItem) => {
    renameClosingRef.current = false
    setRenamingId(sector.id)
    setRenameValue(sector.name)
  }

  const cancelRename = () => {
    renameClosingRef.current = true
    setRenamingId(null)
  }

  const submitRename = (sector: SectorItem) => {
    if (renameClosingRef.current) return
    renameClosingRef.current = true
    const trimmed = renameValue.trim()
    setRenamingId(null)
    if (!trimmed || trimmed === sector.name) return
    renameSector.mutate({ id: sector.id, name: trimmed }, {
      onSuccess: () => {
        triggerHighlight(sector.id)
        pushHistory({ type: 'rename', sectorId: sector.id, before: sector.name, after: trimmed })
      },
      // 실패하면 이름 입력칸을 입력했던 이름 그대로 다시 열어 고쳐서 다시 저장하게 한다.
      onError: () => {
        renameClosingRef.current = false
        setRenamingId(sector.id)
        setRenameValue(trimmed)
      },
    })
  }

  // 검색 중에는 이름이 맞는 섹터와 그 조상만 남기고 전부 펼쳐서 보여준다(KRX 시트의 검색과 같은 느낌).
  const trimmedQuery = query.trim()
  const viewSectors = useMemo(() => {
    if (!trimmedQuery) return sectors
    const keep = new Set<number>()
    const byId = new Map(sectors.map(c => [c.id, c]))
    for (const sector of sectors) {
      if (!sector.name.includes(trimmedQuery)) continue
      let current: SectorItem | undefined = sector
      while (current && !keep.has(current.id)) {
        keep.add(current.id)
        current = current.parentId === null ? undefined : byId.get(current.parentId)
      }
    }
    return sectors.filter(c => keep.has(c.id))
  }, [sectors, trimmedQuery])
  // 대·중·소분류별 개수 — 각 열 머리글에 따로 적는다(검색 중에는 맞는 업종과 그 상위 업종만 센다).
  const sectorCounts = [
    viewSectors.filter(sector => sector.depth === 0).length,
    viewSectors.filter(sector => sector.depth === 1).length,
    // 3단계 이하의 하위 업종도 소분류에 포함해 전체 개수가 항상 합산되게 한다.
    viewSectors.filter(sector => sector.depth >= 2).length,
  ]
  // 가장 깊이 선택된 열 — 이 열의 머리글만 강조색으로 칠하고 화살표를 붙인다.
  const activeColumn = selectedMiddleId !== null ? 2 : selectedMajorId !== null ? 1 : 0
  // 설정창 머리글 개수는 대분류만 센다 — MARKETRY·거래소(읽기 전용 표)와 같은 기준이다. 중·소분류 개수는 위 열 머리글에 따로 적혀 있다.
  const topLevelTotal = sectors.filter(sector => sector.depth === 0).length
  useReportCountLabel(`${toCount(sectorCounts[0])}/${toCount(topLevelTotal)}업종`, onCountLabelChange)
  const depthOptions = sectorNamesByDepth(sectors, sectorStats).map(names => [...new Set(names)])
  const sortSiblings = (items: SectorItem[], depth: number) => {
    const { key, direction } = sortByDepth[depth] ?? DEFAULT_SECTOR_SORT
    const sign = direction === 'asc' ? 1 : -1
    const valueOf = (item: SectorItem) => sectorStats.get(item.id)?.[key === 'stockCount' ? 'stockCount' : 'marketValue'] ?? 0
    const sorted = [...items].sort((a, b) => {
      const diff = key === 'name' ? compareKoreanText(a.name, b.name) : valueOf(a) - valueOf(b)
      return diff === 0 ? compareKoreanText(a.name, b.name) || a.id - b.id : sign * diff
    })
    // 보호 업종은 정렬 방향과 상관없이 항상 맨 아래(신규 상장 → 거래 정지 → 미분류)에 둔다.
    return placeProtectedSectorsLast(sorted, item => (item.parentId === null ? item.name : ''))
  }
  const rootSectors = sortSiblings(viewSectors.filter(c => c.parentId === null && !excludedByDepth[0]?.has(c.name)), 0)
  // 검색 중에는 열린 길과 상관없이 맞는 중·소분류(와 그 상위 업종)를 모두 나열한다 — 서로 다른 대분류 아래에 맞는 업종이 있어도 가려지지 않는다.
  // 열린 길의 줄만 청록으로 칠해 구분하고, 다른 길의 줄을 누르면 그 길이 열린다.
  const isSearching = trimmedQuery !== ''
  // 대분류 순서대로 그 아래 중분류를, 중분류 순서대로 그 아래 소분류를 묶어서 나열한다(각 묶음 안은 열 머리글의 정렬을 따른다).
  // 그래야 중·소분류 칸의 위아래 순서가 왼쪽 칸의 상위 업종 순서와 어긋나지 않는다.
  const childrenOf = (parentId: number, depth: number) => sortSiblings(viewSectors.filter(c => c.parentId === parentId && !excludedByDepth[depth]?.has(c.name)), depth)
  const middleSectors = isSearching
    ? rootSectors.flatMap(root => childrenOf(root.id, 1))
    : selectedMajorId === null ? [] : childrenOf(selectedMajorId, 1)
  const smallSectors = isSearching
    ? middleSectors.flatMap(middle => childrenOf(middle.id, 2))
    : selectedMiddleId === null ? [] : childrenOf(selectedMiddleId, 2)
  // 필터나 검색으로 선택 경로가 감춰지면 다음 열도 함께 닫는다. 숨겨진 부모의 자식만 남아
  // 맥락 없이 보이거나, 필터를 푼 뒤 오래된 선택이 다시 나타나는 일을 막는다.
  useEffect(() => {
    const majorIsVisible = selectedMajorId === null || viewSectors.some(sector => sector.id === selectedMajorId && sector.parentId === null && !excludedByDepth[0]?.has(sector.name))
    if (!majorIsVisible) {
      setSelectedMajorId(null)
      setSelectedMiddleId(null)
      setSelectedSectorId(null)
      setAddingChildFor(null)
      return
    }
    const middleIsVisible = selectedMiddleId === null || viewSectors.some(sector => sector.id === selectedMiddleId && sector.parentId === selectedMajorId && !excludedByDepth[1]?.has(sector.name))
    if (!middleIsVisible) {
      setSelectedMiddleId(null)
      setSelectedSectorId(null)
      setAddingChildFor(null)
    }
  }, [viewSectors, excludedByDepth, selectedMajorId, selectedMiddleId])
  // 검색어가 바뀌면 맞는 업종까지 가는 길을 자동으로 연다 — 소분류를 검색해도 대분류만 보이고 중·소분류 칸이 비어 있던 문제를 막는다.
  // 길이 여러 갈래면 화면 순서상 첫 갈래만 열고, 나머지는 눌러서 연다. 검색어가 같은 동안에는 직접 고른 선택을 건드리지 않는다.
  const searchOpenedQueryRef = useRef('')
  useEffect(() => {
    if (!trimmedQuery) {
      searchOpenedQueryRef.current = ''
      return
    }
    if (searchOpenedQueryRef.current === trimmedQuery || rootSectors.length === 0) return
    searchOpenedQueryRef.current = trimmedQuery
    const visibleChildren = (parentId: number, depth: number) => sortSiblings(viewSectors.filter(c => c.parentId === parentId && !excludedByDepth[depth]?.has(c.name)), depth)
    const major = rootSectors.find(root => visibleChildren(root.id, 1).length > 0)
    const middle = major ? visibleChildren(major.id, 1).find(child => visibleChildren(child.id, 2).length > 0) : undefined
    setSelectedMajorId(major?.id ?? null)
    setSelectedMiddleId(middle?.id ?? null)
    setSelectedSectorId(null)
    setAddingChildFor(null)
  }, [trimmedQuery, rootSectors, viewSectors, excludedByDepth])
  const makeRows = (items: SectorItem[], parentId: number | null): Row[] => {
    const rows: Row[] = items.map((item, index) => ({ type: 'sector', item, siblingIndex: index + 1 }))
    if (parentId !== null && addingChildFor === parentId) {
      const parent = sectors.find(item => item.id === parentId)
      if (parent) rows.push({ type: 'add-child', parentId, parentPath: getSectorPath(parent).split(SECTOR_PATH_SEPARATOR), depth: parent.depth + 1 })
    }
    return rows
  }
  const columnRows = [makeRows(rootSectors, null), makeRows(middleSectors, selectedMajorId), makeRows(smallSectors, selectedMiddleId)]

  const rootIndexById = new Map<number, number>()
  rootSectors.forEach((c, i) => rootIndexById.set(c.id, i + 1))

  // 번호 칸을 끌 때 놓을 수 있는 업종 — ↪ 이동과 같은 규칙이다: 자기와 그 하위, 지금 부모는 안 되고, 옮긴 뒤 가장 깊은 업종이 소분류를 넘지 않아야 한다.
  // 그래서 소분류를 대분류 줄에 바로 놓아 중분류로 올리거나, 중분류를 다른 중분류에 놓아 소분류로 내릴 수도 있고, 대분류도 다른 대분류 안으로 넣을 수 있다. 맨 위(대분류)로 올릴 때는 대분류 열 머리글에 놓는다.
  const isMoveDropTarget = (dragged: SectorItem | null, target: SectorItem) => {
    if (!dragged) return false
    return getMoveCandidates(dragged).some(candidate => candidate.id === target.id)
  }
  // 열 머리글에 놓으면 들어갈 부모 — 대분류 머리글은 최상위(null), 중·소분류 머리글은 지금 열려 있는 대분류·중분류다. 놓을 수 없으면 undefined다.
  // 중·소분류 머리글은 줄에 놓는 것과 같은 규칙(isMoveDropTarget)을 따라서, 같은 위치이거나 깊이 한도를 넘으면 ✕다.
  const getHeaderDropParent = (dragged: SectorItem | null, depth: number): SectorItem | null | undefined => {
    if (!dragged) return undefined
    if (depth === 0) return dragged.parentId !== null ? null : undefined
    const openId = depth === 1 ? selectedMajorId : selectedMiddleId
    const parent = openId === null ? undefined : sectors.find(item => item.id === openId)
    return parent && isMoveDropTarget(dragged, parent) ? parent : undefined
  }
  const isHeaderDropTarget = (dragged: SectorItem | null, depth: number) => getHeaderDropParent(dragged, depth) !== undefined
  // 끄는 중 지금 놓으면 들어갈 줄(또는 열 머리글)을 표시한다. 대상 줄이 그대로여도 마우스가 줄 안에서 움직이면 다시 계산해야 해서 onDragOver와 onDragMove 둘 다 쓴다.
  const updateDragTarget = (event: DragOverEvent | DragMoveEvent) => {
    const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
    const targetData = event.over?.data.current as { sectorId: number } | undefined
    const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
    const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
    setMoveOverId(draggedItem && targetItem && isMoveDropTarget(draggedItem, targetItem) ? targetItem.id : null)
    const headerDepth = (event.over?.data.current as { headerDepth?: number } | undefined)?.headerDepth
    setMoveOverHeader(headerDepth !== undefined && isHeaderDropTarget(draggedItem ?? null, headerDepth) ? headerDepth : null)
  }

  const moveByDrag = async (dragged: SectorItem, target: SectorItem | null) => {
    if (!await appConfirm(moveMessage(dragged.name, target), { title: '업종 이동' })) return
    reparentSector.mutate({ id: dragged.id, parentId: target ? target.id : null }, {
      onSuccess: () => {
        // 보낸 업종(target)을 선택한 상태로 만들어 그 하위 목록이 열리게 하고, 새로 들어온 업종에 표시를 남긴다. 최상위로 올렸다면 그 업종 자신을 선택한다.
        const chain: SectorItem[] = []
        for (let current: SectorItem | undefined = target ?? undefined; current; current = current.parentId === null ? undefined : sectors.find(item => item.id === current!.parentId)) chain.unshift(current)
        setSelectedMajorId(target ? (chain[0]?.id ?? null) : dragged.id)
        setSelectedMiddleId(target ? (chain[1]?.id ?? null) : null)
        setSelectedSectorId(target ? target.id : dragged.id)
        markRecentChange(dragged.id, '이동')
        triggerHighlight(dragged.id)
        pushHistory({ type: 'reparent', sectorId: dragged.id, name: dragged.name, fromParentId: dragged.parentId, toParentId: target ? target.id : null })
      },
    })
  }
  useEffect(() => {
    if (!scrollToRecentChangeRef.current || recentlyChangedSectorId === null) return
    const row = document.querySelector(`[data-sector-row="${recentlyChangedSectorId}"]`)
    if (!row) return
    scrollToRecentChangeRef.current = false
    row.scrollIntoView({ block: 'nearest' })
  }, [recentlyChangedSectorId, sectors, selectedMajorId, selectedMiddleId])

  const renderRow = (row: Row) => {
    if (row.type === 'add-child') {
      const parentId = row.parentId
      const chainLabel = `[${row.parentPath.join(SECTOR_PATH_SEPARATOR)}]`
      return (
        <tr key={`add-child-${parentId}`}>
          <td colSpan={3} className="py-0.5 text-left" style={{ paddingLeft: '14px' }}>
            {/* 입력 글자의 시작선을 생성 후 업종명과 맞춘다. input 내부 여백(8px)만큼 입력칸 자체는 왼쪽에서 시작한다. */}
            <div className="group/create flex items-center gap-2 pl-7">
              <SectorNameInput
                wrapperClassName="inline-flex"
                autoFocus
                value={childNameByParent[parentId] ?? ''}
                onChange={e => setChildNameByParent(prev => ({ ...prev, [parentId]: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateChild(parentId)
                  if (e.key === 'Escape') setAddingChildFor(null)
                }}
                placeholder={`${row.depth === 1 ? '중분류' : '소분류'} 추가`}
                data-hint={`${chainLabel} 하위 업종 추가`}
                aria-label={`${chainLabel} 하위 업종명`}
                className="h-7 w-40 rounded-md border-0 bg-[var(--ui-panel)] px-2 text-sm font-medium text-ui-white outline-none focus:placeholder:text-transparent placeholder:text-ui-muted focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
              />
            </div>
          </td>
        </tr>
      )
    }

    const sector = row.item
    const isRoot = sector.parentId === null
    const expandable = isRoot || hasChildren(sector.id)
    const itemNumber = isRoot
      ? `${rootIndexById.get(sector.id) ?? row.siblingIndex}.`
      : sector.depth >= 2
        ? `(${row.siblingIndex})`
        : `${row.siblingIndex})`
    const isRenaming = renamingId === sector.id
    // 줄 어디를 눌러도(이름 글자뿐 아니라 빈 곳, 번호 칸 포함) 선택한다. 순서 이동 손잡이와 이름 바꾸기 입력창은 제외한다.
    const selectSector = () => {
      setRecentlyChangedSectorId(null)
      setSelectedSectorId(sector.id)
      if (isSearching && sector.depth >= 1) {
        // 검색 중에는 다른 길의 줄도 보이므로, 누른 줄의 상위 업종까지 함께 열어 그 길로 옮겨 간다.
        const parent = sectors.find(item => item.id === sector.parentId)
        if (sector.depth === 1) { setSelectedMajorId(sector.parentId); setSelectedMiddleId(current => current === sector.id && selectedMajorId === sector.parentId ? null : sector.id) }
        else { setSelectedMajorId(parent?.parentId ?? null); setSelectedMiddleId(sector.parentId) }
        return
      }
      if (sector.depth === 0) { setSelectedMajorId(current => current === sector.id ? null : sector.id); setSelectedMiddleId(null) }
      if (sector.depth === 1) setSelectedMiddleId(current => current === sector.id ? null : sector.id)
    }
    // 선택한 경로(대·중·소분류에서 고른 업종)의 줄은 종목 표의 선택된 줄과 같은 청록 배경으로 칠한다.
    const isOnSelectedPath = selectedSectorId === sector.id || selectedMajorId === sector.id || selectedMiddleId === sector.id
    // 끄는 동안 놓을 수 있는 줄은 번호 자리의 아이콘 배지로 구분하므로 줄마다 선을 긋지 않는다. 지금 커서가 올라간 한 줄만 줄 전체 높이(29px)로 청록으로 채운다(세 칸에 걸쳐 한 줄처럼 이어진다).
    const rowBgClass = `${isMoveDrag && moveOverId === sector.id ? 'bg-[var(--brand)]/50' : ''} ${isOnSelectedPath ? 'bg-[var(--brand)]/20 group-hover:bg-[var(--brand)]/35' : recentlyChangedSectorId === sector.id ? 'bg-[var(--brand)]/20 group-hover:bg-[var(--brand)]/35' : 'group-hover:bg-[var(--brand)]/10'}`
    const stat = sectorStats.get(sector.id)
    return (
      <DroppableSectorRow
        key={sector.id}
        sectorId={sector.id}
        className={`group ${isRenaming ? '' : 'cursor-pointer'} ${draggedSector?.id === sector.id ? 'opacity-35' : ''} ${highlightedId === sector.id ? 'animate-row-blink' : ''}`}
        onClick={event => {
          if (isRenaming || (event.target as HTMLElement).closest('[data-no-row-select]')) return
          selectSector()
        }}
      >
        <td className={`relative py-0.5 text-left ${rowBgClass}`} style={{ paddingLeft: '8px' }}>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center">
              {isRenaming ? (
                <>
                  {/* 번호 배지는 그대로 두고(끌 수 없다) 그 뒤에 입력칸을 놓는다. 입력 글자의 시작선을 업종명과 맞추려고 입력 내부 여백(8px)만큼 칸이 왼쪽에서 시작하고, 오른쪽은 시가총액 합 칸과의 세로선을 넘지 않게 8px 띄운다. */}
                  <DraggableNumberBadge sectorId={sector.id} parentId={sector.parentId} locked>{itemNumber}</DraggableNumberBadge>
                  <SectorNameInput
                    wrapperClassName="-ml-2 mr-2 flex min-w-0 flex-1"
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') submitRename(sector)
                      if (e.key === 'Escape') cancelRename()
                    }}
                    // 입력칸 바깥을 누르면 지금 이름으로 저장하고 닫는다(안 바뀌었거나 비었으면 그냥 닫는다).
                    onBlur={() => submitRename(sector)}
                    aria-label={`${sector.name} 이름`}
                    className="h-6 min-w-0 flex-1 rounded-md border-0 bg-[var(--ui-panel)] px-2 text-sm font-medium text-ui-white outline-none focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
                  />
                </>
              ) : (
                <>
                  <DraggableNumberBadge
                    sectorId={sector.id}
                    parentId={sector.parentId}
                    dropState={isMoveDrag && draggedSector?.id !== sector.id ? (isMoveDropTarget(draggedSector, sector) ? (moveOverId === sector.id ? 'over' : 'target') : 'blocked') : null}
                    locked={isProtectedSector(sector)}
                  >{itemNumber}</DraggableNumberBadge>
                  <button
                    type="button"
                    data-hint={isProtectedSector(sector) ? getProtectedSectorHint(sector.name) : undefined}
                    aria-expanded={expandable ? (sector.depth === 0 ? selectedMajorId === sector.id : selectedMiddleId === sector.id) : undefined}
                    className={`truncate border-0 bg-transparent p-0 text-left text-sm ${isProtectedSector(sector) ? PROTECTED_SECTOR_TEXT_CLASS : 'text-ui-white'}`}
                  >
                    {sector.name}
                  </button>
                  {/* 선택한 항목은 하위 업종 추가·이름 변경·삭제 아이콘을 보여 준다. 업종명을 덜 가리도록 업종 칸의 오른쪽 끝(시가총액 합 칸과의 세로선)에 바짝 붙이고 여백을 줄였다. 옆 칸 숫자를 덮지 않는다. 번호 칸을 끄는 중에는 숨긴다. */}
                  {selectedSectorId === sector.id && !isMoveDrag && (
                    <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-1">
                      {sector.depth <= ADD_CHILD_MAX_PARENT_DEPTH && !isProtectedSector(sector) && (
                        <button type="button" data-no-row-select data-hint="하위 업종 추가" aria-label={`${sector.name} 하위 업종 추가`} onClick={() => toggleAddChild(sector.id)} className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none hover:text-[var(--brand)]">
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      )}
                      {!isProtectedSector(sector) && (
                        <button type="button" data-no-row-select data-hint="이름 변경" aria-label={`${sector.name} 이름 변경`} onClick={() => startRename(sector)} className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-ui-text outline-none hover:text-[var(--brand)]">
                          <EditIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        data-no-row-select
                        data-hint="삭제"
                        aria-label={`${sector.name} 삭제`}
                        onClick={() => {
                          if (isProtectedSector(sector)) {
                            void appAlert(`[${sector.name}]\n${getProtectedSectorDeleteMessage(sector.name)}`, { title: '삭제 불가' })
                            return
                          }
                          remove(sector.id, sector.name)
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-[#BC2F2F] outline-none hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#BC2F2F]"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          {/* 방금 추가·이동한 업종 표시 — 번호 배지 위에 같은 자리·같은 크기로 포갠다. 눌러도 아래 번호 배지를 그대로 끌 수 있게 클릭은 통과시킨다. */}
          {!isRenaming && recentlyChangedSectorId === sector.id && recentChangeType && (
            <span className="pointer-events-none absolute left-2 top-1/2 inline-flex h-6 w-8 -translate-y-1/2 items-center justify-center rounded-sm border border-[var(--ui-muted)] bg-[var(--ui-control)] text-sm font-bold leading-none text-ui-white">
              {recentChangeType}
            </span>
          )}
        </td>
        <td className={`py-0.5 pr-3 text-right text-sm text-ui-muted ${rowBgClass}`}>{toJoEokDecimal((stat?.marketValue ?? 0) / 100_000_000)}</td>
        <td className={`py-0.5 pr-3 text-right text-sm text-ui-muted ${rowBgClass}`}>{toCount(stat?.stockCount ?? 0)}</td>
      </DroppableSectorRow>
    )
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={sectorCollisionDetection}
      onDragOver={updateDragTarget}
      onDragMove={updateDragTarget}
      onDragStart={event => {
        setRecentlyChangedSectorId(null)
        setMoveOverId(null)
        setMoveOverHeader(null)
        const dragData = event.active.data.current as { sectorId: number } | undefined
        setDraggedSector(dragData ? (sectors.find(c => c.id === dragData.sectorId) ?? null) : null)
        const grabbed = event.activatorEvent.target as HTMLElement | null
        const badgeRect = grabbed?.closest('button')?.getBoundingClientRect()
        const rowRect = grabbed?.closest('tr')?.getBoundingClientRect()
        setDraggedRow(badgeRect && rowRect ? { width: rowRect.width, height: rowRect.height, offsetX: rowRect.left - badgeRect.left, offsetY: rowRect.top - badgeRect.top } : null)
      }}
      onDragEnd={event => {
        setDraggedSector(null)
        setDraggedRow(null)
        const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
        const targetData = event.over?.data.current as { sectorId: number } | undefined
        const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
        const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
        setMoveOverId(null)
        const droppedHeaderDepth = (event.over?.data.current as { headerDepth?: number } | undefined)?.headerDepth
        setMoveOverHeader(null)
        if (draggedItem && droppedHeaderDepth !== undefined) {
          const headerParent = getHeaderDropParent(draggedItem, droppedHeaderDepth)
          if (headerParent !== undefined) void moveByDrag(draggedItem, headerParent)
        }
        else if (draggedItem && targetItem && isMoveDropTarget(draggedItem, targetItem)) void moveByDrag(draggedItem, targetItem)
      }}
      onDragCancel={() => {
        setMoveOverId(null)
        setMoveOverHeader(null)
        setDraggedSector(null)
        setDraggedRow(null)
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {toolbarContainer && createPortal(
          <SearchBar
            inline
            query={query}
            onChange={setQuery}
            placeholder="업종 검색"
            ariaLabel="업종 검색"
          />,
          toolbarContainer,
        )}
        <div className="relative grid min-h-0 flex-1 grid-cols-3 overflow-hidden border border-ui-border select-none [&_input]:select-text">
          {(['대분류', '중분류', '소분류'] as const).map((label, index) => (
            <div key={label} className="flex min-h-0 min-w-0 flex-col">
              {(() => {
                const headerClass = `flex shrink-0 flex-col bg-[var(--ui-panel)] text-sm font-bold shadow-[inset_0_-1px_0_var(--ui-border)] ${index < 2 ? 'border-r border-ui-white/20' : ''}`
                const depth = index
                const excluded = excludedByDepth[depth] ?? new Set<string>()
                const { key: sortKey, direction: sortDirection } = sortByDepth[depth] ?? DEFAULT_SECTOR_SORT
                // 끄는 동안에만 보이는 배지 — 분류 이름 바로 왼쪽에 업종명 앞 번호 배지와 같은 크기·간격(10px)으로 붙고, 이름 자리(가운데)에는 영향을 주지 않는다.
                const headerDropState = isMoveDrag ? (isHeaderDropTarget(draggedSector, depth) ? (moveOverHeader === depth ? 'over' : 'target') : 'blocked') : null
                // 윗줄 — 분류 이름과 개수, 검색 필터.
                const topRow = (
                  <div className={`relative flex items-center justify-center gap-2 ${index === activeColumn ? 'text-[var(--brand)]' : 'text-ui-white'} ${moveOverHeader === depth ? 'bg-[color-mix(in_srgb,var(--brand)_50%,var(--ui-background))]' : ''}`} style={{ height: HEADER_HALF_PX }}>
                    <span className="relative">
                      {headerDropState && (
                        <span aria-hidden="true" className={`${ICON_BADGE_CLASS} absolute right-full top-1/2 -translate-y-1/2 ${DROP_BADGE_CLASS[headerDropState]}`}>
                          {headerDropState === 'blocked' ? <CloseIcon className="h-4 w-4" /> : <NestIntoIcon className="h-4 w-4" />}
                        </span>
                      )}
                      {`${label} (${toCount(sectorCounts[index])})`}
                    </span>
                    <ColumnFilterButton
                      label={label}
                      isProtected={depth === 0 ? isProtectedSectorName : undefined}
                      getOptions={() => depthOptions[depth]}
                      optionOrder={depthOptions[depth]}
                      excluded={excluded}
                      onToggle={value => toggleDepthFilter(depth, value)}
                      onSelectAll={() => setExcludedByDepth(previous => ({ ...previous, [depth]: new Set() }))}
                      onSelectNone={values => setExcludedByDepth(previous => ({ ...previous, [depth]: new Set(values) }))}
                      orderMode={{ value: sectorFilterMode, onChange: setSectorFilterMode }}
                    />
                  </div>
                )
                // 아랫줄 — MARKETRY·거래소 업종 표와 같은 업종 / 시가총액 합 / 종목 수 정렬 머리글.
                const bottomRow = (
                  <div className="flex border-t border-ui-border text-ui-white" style={{ height: HEADER_HALF_PX }}>
                    {([['name', '업종'], ['marketValue', '시가총액 합'], ['stockCount', '종목 수']] as const).map(([key, text], cell) => (
                      <div key={key} className="flex items-center justify-center whitespace-nowrap" style={{ width: SECTOR_COLUMN_WIDTHS[cell] }}>
                        <SortLabel label={text} active={sortKey === key && !(isSearching && depth > 0)} direction={sortDirection} onClick={() => toggleSort(depth, key)} />
                      </div>
                    ))}
                  </div>
                )
                return (
                  <ColumnDropHeader depth={depth} className={headerClass} style={{ height: STOCK_HEADER_ROW_PX }}>{topRow}{bottomRow}</ColumnDropHeader>
                )
              })()}
              <ScrollArea overlay scrollLabel={`${label} 업종 목록`} className={`min-h-0 flex-1 ${index < 2 ? 'border-r border-ui-border' : ''}`}>
                <table className="nes-table is-dark custom-page-table custom-sector-table w-full table-fixed text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-ui-border [&_td]:border-r-0"><colgroup>{SECTOR_COLUMN_WIDTHS.map(width => <col key={width + index} style={{ width }} />)}</colgroup><tbody>{columnRows[index].map(renderRow)}</tbody></table>
              </ScrollArea>
            </div>
          ))}
          {/* 업종이 하나도 없으면 거래소·MARKETRY 표와 같은 안내 글을 가운데에 보여준다. */}
          {viewSectors.length === 0 && sectors.length > 0 && <EmptyMessage message={EMPTY_SEARCH_MESSAGE} topClass="top-7" />}
        </div>
      </div>
      {/* 커서를 따라다니는 드래그 미리보기 — 끌고 있는 줄을 원래 폭의 한 줄 그대로(손잡이·번호·이름) 청록 배경에 그림자를 줘서 들어 올린 것처럼 보여 준다. */}
      <DragOverlay>
        {draggedSector && (() => {
          const position = columnRows[Math.min(draggedSector.depth, 2)].flatMap(row => (row.type === 'sector' && row.item.id === draggedSector.id ? [row.siblingIndex] : []))[0] ?? 0
          const number = draggedSector.parentId === null ? `${position}.` : draggedSector.depth >= 2 ? `(${position})` : `${position})`
          return (
            <div
              style={{ width: draggedRow?.width, height: draggedRow?.height, marginLeft: draggedRow?.offsetX, marginTop: draggedRow?.offsetY, paddingLeft: '8px' }}
              className="flex items-center bg-[var(--brand-surface)] py-0.5 text-sm text-ui-white shadow-xl"
            >
              <span aria-hidden="true" className={`${NUMBER_BADGE_CLASS} ${DRAG_CONTROL_CLASS}`}>{number}</span>
              <span className="truncate">{draggedSector.name}</span>
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
    {settingsActionsTarget && createPortal(
      <>
      <section aria-label="업종 추가" className="settings-item settings-custom-control">
        <h2 className="settings-plain-title mb-3 text-[15px] font-medium leading-[22px] text-ui-white">업종 추가</h2>
        <p className="settings-description m-0 mt-1 max-w-full text-xs/4 font-medium text-ui-muted">업종명을 입력한 뒤 엔터</p>
        <div className="flex min-w-0 max-w-full settings-control-inset items-center gap-2">
          <SectorNameInput
            wrapperClassName="flex min-w-0 flex-1"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="업종을 추가하세요"
            aria-label="최상위 업종명"
            className={`h-[25px] min-w-0 flex-1 rounded-[5px] border border-transparent bg-[var(--ui-control)] px-2 text-[13px]/4 font-medium text-ui-white outline-none focus:placeholder:text-transparent placeholder:text-ui-text focus:border-[var(--brand)] ${sectors.length === 0 ? 'animate-input-attention' : ''}`}
          />
        </div>
      </section>
      {/* 변경 내역 — 종목 화면과 같은 부품이다. */}
      <section aria-label="변경 내역" className="settings-item settings-custom-control relative before:absolute before:-top-3 before:left-0 before:right-0 before:border-t before:border-ui-white/10 before:content-['']">
        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-ui-white">변경 내역</h2>
        <ChangeHistoryControls
          undoStack={undoStack}
          redoStack={redoStack}
          describe={describeHistoryAction}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onUndoItem={id => undoUntil(undoStack.findIndex(action => action.id === id))}
          onRedoItem={id => redoUntil(redoStack.findIndex(action => action.id === id))}
        />
      </section>
      </>,
      settingsActionsTarget,
    )}
    </>
  )
}
