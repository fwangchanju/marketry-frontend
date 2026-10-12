import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useReportCountLabel } from '@/hooks/useReportCountLabel'
import { createPortal } from 'react-dom'
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragMoveEvent, type DragOverEvent, type Modifier } from '@dnd-kit/core'
import type { SectorItem } from '@/types/api'
import { useCreateSector, useRenameSector, useReparentSector } from '@/hooks/useMarketMapCustom'
import { useSectorDeleteFlow } from '@/hooks/useSectorDeleteFlow'
import { halfOverlapCollisionDetection } from '@/utils/dndCollision'
import { toCount } from '@/utils/format'
import { loadSectorOrder, orderSectors, SECTOR_ORDER_STORAGE_KEY, type SectorOrder } from '@/utils/sectorOrder'
import { appAlert, appConfirm } from '@/utils/appDialogBus'
import { SearchBar } from '@/components/ReadOnlyTaxonomySheet'
import { HINT_BUBBLE_CLASS, HINT_BUBBLE_COLOR_CLASS } from '@/components/hintBubbleStyle'
import ChangeHistoryControls from '@/components/ChangeHistoryControls'
import EmptyMessage, { EMPTY_DATA_MESSAGE, EMPTY_SEARCH_MESSAGE } from '@/components/EmptyMessage'
import { EditIcon, PlusIcon, TrashIcon } from '@/components/icons/MarketMapIcons'

interface Props {
  sectors: SectorItem[]
  settingsActionsTarget?: HTMLElement | null
  // 검색창 옆에 두던 개수를 받아 갈 곳 — 페이지가 설정창 머리글에 그려 준다.
  onCountLabelChange?: (label: string | undefined) => void
}

// 섹터 깊이 상한(최상위=0) — 4단계(0~3)까지만 허용하고 5단계 섹터는 만들지 못하게 한다. 나중에 한 단계 더
// 늘릴 때는 이 값만 바꾸면 추가 버튼과 드래그 이동 제한이 같이 따라간다.
const MAX_SECTOR_DEPTH = 3

// 신규 종목이 자동 배정되는 최상위 업종 — 삭제할 수 없다(서버도 막는다).
const NEW_LISTING_SECTOR_NAME = '신규 상장'
const NEW_LISTING_DELETE_MESSAGE = '신규 상장시 자동 분류되는 항목이라 삭제가 불가능합니다.'
const isProtectedSector = (sector: SectorItem) => sector.parentId === null && sector.name === NEW_LISTING_SECTOR_NAME
const MAX_SECTOR_LEVELS = MAX_SECTOR_DEPTH + 1
// "세부 업종 추가" 아이콘은 대분류·중분류(깊이 0·1)에만 보여 준다 — 소분류 이하에는 더 만들지 않는다. 이미 있는 4단계 업종은 그대로 둔다.
const ADD_CHILD_MAX_PARENT_DEPTH = 1

// 섹터 이름 글자 수 상한(공백 포함) — 대/중/소분류 구분 없이 통일한다. 이미 이 길이를 넘는 이름은 그대로
// 표시되고, 이름을 고칠 때만 제한이 걸린다.
const MAX_SECTOR_NAME_LENGTH = 12

// 업종 이름 입력칸 — 글자 수 상한에 닿으면 칸 아래에 이유를 알려 준다(상한을 넘는 글자는 조용히 잘리므로).
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
      />
      {focused && atLimit && (
        <span role="status" className={`pointer-events-none absolute left-0 top-full z-50 mt-1 whitespace-nowrap ${HINT_BUBBLE_CLASS}`}>
          최대 {MAX_SECTOR_NAME_LENGTH}자까지 입력할 수 있습니다.
        </span>
      )}
    </span>
  )
}

// 상단바 우측 아이콘(NavBarPageActions)과 같은 모양 — 회색 아이콘, hover 때 강조색.
const ICON_BUTTON_CLASS =
  'flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-400 outline-none hover:text-[var(--brand)]'

type Row =
  | { type: 'sector'; item: SectorItem; siblingIndex: number }
  | { type: 'add-child'; parentId: number; parentPath: string[]; depth: number }

// 업종 화면 변경 내역 — 이동·이름 바꾸기·순서 바꾸기를 되돌리고 다시 적용한다(추가·삭제는 아직 기록하지 않는다).
type SectorHistoryAction =
  | { id: string; type: 'reparent'; sectorId: number; name: string; fromParentId: number | null; toParentId: number | null }
  | { id: string; type: 'rename'; sectorId: number; before: string; after: string }
  | { id: string; type: 'reorder'; parentId: number | null; beforeIds: number[]; afterIds: number[] }
type SectorHistoryInput = SectorHistoryAction extends infer A ? (A extends { id: string } ? Omit<A, 'id'> : never) : never
const SECTOR_HISTORY_LIMIT = 50

function DraggableSectorHandle({
  sectorId,
  parentId,
  enabled,
}: {
  sectorId: number
  parentId: number | null
  enabled: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sector-drag-${sectorId}`,
    data: { sectorId, parentId },
    disabled: !enabled,
  })
  return <button ref={setNodeRef} {...listeners} {...attributes} data-no-row-select type="button" disabled={!enabled} aria-label="업종 순서 이동" title={enabled ? '드래그해 순서 이동' : '사용자 지정 정렬에서 순서를 이동할 수 있습니다'} className={`mr-1 flex h-6 w-6 shrink-0 touch-none items-center justify-center border-0 bg-transparent text-gray-400 hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40 ${isDragging ? 'opacity-30' : ''}`}><span aria-hidden="true" className="text-xl leading-none">⠿</span></button>
}

// 끄는 중 마우스의 세로 위치 — 손잡이를 열 안으로 가두는 제한(keepInColumnVertically) 때문에 손잡이 위치는 맨 위·맨 아래에서 멈추므로,
// 놓을 자리가 대상 줄의 위쪽 절반인지 아래쪽 절반인지는 마우스 위치로 가린다(그래야 맨 위·맨 아래 자리까지 갈 수 있다).
const draggedPointerY = (event: { activatorEvent: Event; delta: { y: number } }) => {
  const start = (event.activatorEvent as PointerEvent).clientY
  return Number.isFinite(start) ? start + event.delta.y : null
}

// ⠿ 손잡이로 순서를 바꿀 때는 옆으로 새지 않고 위아래로만, 그 열 안에서만 움직이게 한다. 번호 칸으로 다른 분류로 옮길 때(mode: 'move')는 자유롭게 움직인다.
const keepInColumnVertically: Modifier = ({ transform, active, draggingNodeRect, scrollableAncestorRects }) => {
  if ((active?.data.current as { mode?: string } | undefined)?.mode === 'move') return transform
  const column = scrollableAncestorRects[0]
  if (!draggingNodeRect || !column) return { ...transform, x: 0 }
  const minY = column.top - draggingNodeRect.top
  const maxY = column.top + column.height - draggingNodeRect.top - draggingNodeRect.height
  return { ...transform, x: 0, y: Math.min(Math.max(transform.y, minY), Math.max(minY, maxY)) }
}

// 번호 칸 — 업종은 끌어서 다른 업종 위에 놓으면 그 안으로 이동한다(순서 바꾸기는 왼쪽 ⠿ 손잡이).
const NUMBER_BADGE_CLASS = 'mr-2 inline-flex h-5 w-8 shrink-0 items-center justify-end rounded-sm border border-gray-400 bg-zinc-700 p-0 pr-1 text-sm leading-none font-bold text-gray-300 tabular-nums'

function DraggableNumberBadge({ sectorId, parentId, onPress, onClickBadge, children }: { sectorId: number; parentId: number | null; onPress: () => void; onClickBadge: () => void; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sector-move-${sectorId}`,
    data: { sectorId, parentId, mode: 'move' },
  })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onPointerDown={event => {
        listeners?.onPointerDown?.(event)
        onPress()
      }}
      onClick={onClickBadge}
      type="button"
      title="끌어서 다른 업종 안으로 이동"
      className={`${NUMBER_BADGE_CLASS} cursor-grab touch-none ${isDragging ? 'opacity-40' : ''}`}
    >
      {children}
    </button>
  )
}

// 대분류 열 머리글 — 번호 칸을 끄는 동안 여기에 놓으면 그 업종이 최상위(대분류)가 된다. 끄는 중이 아닐 때는 보통 머리글이다.
function RootDropHeader({ className, isActive, isOver, children }: { className: string; isActive: boolean; isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: 'sector-drop-root', data: { root: true } })
  return (
    <div ref={setNodeRef} className={`${className} relative ${isActive ? 'ring-1 ring-inset ring-[var(--brand)]/70' : ''} ${isActive && isOver ? 'bg-[var(--brand)]/45' : ''}`}>
      {children}
      {isActive && (
        <span aria-hidden="true" className={`pointer-events-none absolute right-2 top-1/2 h-5 -translate-y-1/2 rounded border border-[var(--brand)] px-2 text-xs font-bold leading-[18px] ${isOver ? 'bg-[var(--brand)] text-black' : 'bg-transparent text-[var(--brand)]'}`}>
          여기 (최상위)
        </span>
      )}
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

export default function AdminSectorTable({ sectors, settingsActionsTarget, onCountLabelChange }: Props) {
  const [query, setQuery] = useState('')
  const [sectorOrder, setSectorOrder] = useState<SectorOrder>(loadSectorOrder)
  const [undoStack, setUndoStack] = useState<SectorHistoryAction[]>([])
  const [redoStack, setRedoStack] = useState<SectorHistoryAction[]>([])
  const historyCounter = useRef(0)
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null)
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null)
  const [selectedSectorId, setSelectedSectorId] = useState<number | null>(null)
  const [dropIndicator, setDropIndicator] = useState<{ sectorId: number; position: 'before' | 'after' } | null>(null)
  const [newName, setNewName] = useState('')
  const [childNameByParent, setChildNameByParent] = useState<Record<number, string>>({})
  // 펼침과 무관하게 "지금 이 섹터 밑에 추가 입력줄을 보여줄지"만 따로 관리 — 한 번에 하나만 연다.
  const [addingChildFor, setAddingChildFor] = useState<number | null>(null)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingSectorId, setMovingSectorId] = useState<number | null>(null)
  const [highlightedId, setHighlightedId] = useState<number | null>(null)
  const [draggedSector, setDraggedSector] = useState<SectorItem | null>(null)
  // 번호 칸을 끌어 다른 분류로 옮기는 중인지, 그리고 지금 놓으면 들어갈 업종.
  const [isMoveDrag, setIsMoveDrag] = useState(false)
  // 번호 칸을 누르면 "끌어서 보낼 수 있다"는 안내를 띄운다 — 끄는 동안이나, 끌지 않고 눌렀다면 잠깐(3초) 보인다.
  const [badgeHint, setBadgeHint] = useState(false)
  // 끌어서 다른 업종 안으로 방금 옮긴 업종 — 다음 조작 전까지 눈에 띄는 표시를 남긴다. 목록이 새로 그려진 뒤 화면 안으로 스크롤한다.
  const [movedSectorId, setMovedSectorId] = useState<number | null>(null)
  const scrollToMovedRef = useRef(false)
  const badgeHintTimer = useRef<number | undefined>(undefined)
  // 손잡이로 끌 때 띄우는 안내를 메인 영역(왼쪽 끝~설정창 시작점)의 가로·세로 가운데에 놓기 위한 기준.
  const mainAreaRef = useRef<HTMLDivElement>(null)
  const [hintPosition, setHintPosition] = useState<{ x: number; y: number } | null>(null)
  const [moveOverId, setMoveOverId] = useState<number | null>(null)
  const [moveOverRoot, setMoveOverRoot] = useState(false)
  // 끌고 있는 줄의 폭과, 손잡이(끄는 대상) 기준 줄 왼쪽 끝 위치 — 미리보기를 줄 전체 폭으로, 원래 줄과 같은 왼쪽 위치에서 그린다.
  const [draggedRow, setDraggedRow] = useState<{ width: number; offsetX: number; height: number } | null>(null)

  const createSector = useCreateSector()
  const renameSector = useRenameSector()
  const { remove } = useSectorDeleteFlow()
  const reparentSector = useReparentSector()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const hasChildren = (id: number) => sectors.some(c => c.parentId === id)
  // 바로 아래 세부 항목 수 — 검색으로 일부만 보이는 중에도 실제 개수를 보여준다.
  const childCountByParent = useMemo(() => {
    const counts = new Map<number, number>()
    for (const sector of sectors) {
      if (sector.parentId !== null) counts.set(sector.parentId, (counts.get(sector.parentId) ?? 0) + 1)
    }
    return counts
  }, [sectors])

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
      candidate.id !== moved.id &&
      !isDescendant(candidate, moved.id) &&
      candidate.id !== moved.parentId &&
      // 소분류(깊이 2) 이하에는 더 넣지 않는다 — 옮긴 뒤 가장 깊은 업종도 소분류(깊이 2)를 넘지 않아야 한다.
      candidate.depth <= ADD_CHILD_MAX_PARENT_DEPTH &&
      candidate.depth + 1 + subtreeHeight <= ADD_CHILD_MAX_PARENT_DEPTH + 1,
    )
  }

  // 이동 모드 — ↪를 누르면 옮길 업종이 정해지고, 표에서 도착할 상위 업종 줄의 "여기" 버튼을 누르면 확인 뒤 옮긴다.
  // 줄을 누르면 평소처럼 펼쳐지므로(선택 변경) 다른 가지의 업종도 찾아가서 고를 수 있다.
  const movingSector = movingSectorId === null ? null : (sectors.find(item => item.id === movingSectorId) ?? null)
  const moveTargetIds = new Set(movingSector ? getMoveCandidates(movingSector).map(item => item.id) : [])
  const cancelMove = () => setMovingSectorId(null)
  const confirmMove = async (target: SectorItem | null) => {
    if (!movingSector) return
    const destination = target ? getSectorPath(target) : '최상위'
    if (!await appConfirm(`${movingSector.name}\n${destination} 안으로 이동하시겠습니까?`)) return
    const moved = movingSector
    reparentSector.mutate({ id: moved.id, parentId: target ? target.id : null }, {
      onSuccess: () => {
        setMovingSectorId(null)
        pushHistory({ type: 'reparent', sectorId: moved.id, name: moved.name, fromParentId: moved.parentId, toParentId: target ? target.id : null })
      },
    })
  }
  useEffect(() => {
    if (movingSectorId === null) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMovingSectorId(null)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [movingSectorId])

  const getSectorPath = (sector: SectorItem) => {
    const path = [sector.name]
    let current = sector
    while (current.parentId !== null) {
      const parent = sectors.find(item => item.id === current.parentId)
      if (!parent) break
      path.unshift(parent.name)
      current = parent
    }
    return path.join(' › ')
  }

  const persistSiblingOrder = (parentId: number | null, ids: number[]) => {
    setSectorOrder(previous => {
      const next = { ...previous, [String(parentId)]: ids }
      localStorage.setItem(SECTOR_ORDER_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }
  const updateSiblingOrder = (parentId: number | null, nextSiblings: SectorItem[]) => persistSiblingOrder(parentId, nextSiblings.map(item => item.id))

  // 변경 내역 — 새 변경을 쌓으면 다시 적용 목록은 비운다.
  const pushHistory = (action: SectorHistoryInput) => {
    historyCounter.current += 1
    setUndoStack(previous => [...previous, { ...action, id: String(historyCounter.current) } as SectorHistoryAction].slice(-SECTOR_HISTORY_LIMIT))
    setRedoStack([])
  }
  const applyHistoryAction = (action: SectorHistoryAction, direction: 'before' | 'after') => {
    if (action.type === 'reparent') {
      reparentSector.mutate({ id: action.sectorId, parentId: direction === 'before' ? action.fromParentId : action.toParentId }, { onSuccess: () => triggerHighlight(action.sectorId) })
    } else if (action.type === 'rename') {
      renameSector.mutate({ id: action.sectorId, name: direction === 'before' ? action.before : action.after }, { onSuccess: () => triggerHighlight(action.sectorId) })
    } else {
      persistSiblingOrder(action.parentId, direction === 'before' ? action.beforeIds : action.afterIds)
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
    if (action.type === 'rename') return `${action.before} → ${action.after} 이름 변경`
    return `${nameOf(action.parentId)} 안 순서 변경`
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
      appAlert(`업종은 ${MAX_SECTOR_LEVELS}단계까지만 만들 수 있습니다.`)
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
      onSuccess: created => triggerHighlight(created.id),
      onError: () => setChildNameByParent(prev => ({ ...prev, [parentId]: trimmed })),
    })
    setChildNameByParent(prev => ({ ...prev, [parentId]: '' }))
  }

  const startRename = (sector: SectorItem) => {
    setRenamingId(sector.id)
    setRenameValue(sector.name)
  }

  const cancelRename = () => setRenamingId(null)

  const submitRename = (sector: SectorItem) => {
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
    // 3단계 이하의 세부 업종도 소분류에 포함해 전체 개수가 항상 합산되게 한다.
    viewSectors.filter(sector => sector.depth >= 2).length,
  ]
  // 가장 깊이 선택된 열 — 이 열의 머리글만 강조색으로 칠하고 화살표를 붙인다.
  const activeColumn = selectedMiddleId !== null ? 2 : selectedMajorId !== null ? 1 : 0
  // 설정창 머리글 개수는 대분류만 센다 — MARKETRY·거래소(읽기 전용 표)와 같은 기준이다. 중·소분류 개수는 위 열 머리글에 따로 적혀 있다.
  const topLevelTotal = sectors.filter(sector => sector.depth === 0).length
  useReportCountLabel(`${toCount(sectorCounts[0])}/${toCount(topLevelTotal)}업종`, onCountLabelChange)
  const rootSectors = orderSectors(viewSectors.filter(c => c.parentId === null), null, sectorOrder)
  const middleSectors = selectedMajorId === null ? [] : orderSectors(viewSectors.filter(c => c.parentId === selectedMajorId), selectedMajorId, sectorOrder)
  const smallSectors = selectedMiddleId === null ? [] : orderSectors(viewSectors.filter(c => c.parentId === selectedMiddleId), selectedMiddleId, sectorOrder)
  const makeRows = (items: SectorItem[], parentId: number | null): Row[] => {
    const rows: Row[] = items.map((item, index) => ({ type: 'sector', item, siblingIndex: index + 1 }))
    if (parentId !== null && addingChildFor === parentId) {
      const parent = sectors.find(item => item.id === parentId)
      if (parent) rows.push({ type: 'add-child', parentId, parentPath: getSectorPath(parent).split(' › '), depth: parent.depth + 1 })
    }
    return rows
  }
  const columnRows = [makeRows(rootSectors, null), makeRows(middleSectors, selectedMajorId), makeRows(smallSectors, selectedMiddleId)]
  const selectedSector = sectors.find(item => item.id === selectedSectorId) ?? null

  const rootIndexById = new Map<number, number>()
  rootSectors.forEach((c, i) => rootIndexById.set(c.id, i + 1))

  // ⠿ 손잡이로 순서를 바꾸는 동안, 끄는 줄이 들어갈 자리를 비워 주려고 사이에 낀 줄들이 한 칸씩 위아래로 비켜 준다(px).
  const shiftById = useMemo(() => {
    const shifts = new Map<number, number>()
    if (!draggedSector || isMoveDrag || !dropIndicator || !draggedRow) return shifts
    const siblings = orderSectors(sectors.filter(item => item.parentId === draggedSector.parentId), draggedSector.parentId, sectorOrder)
    const from = siblings.findIndex(item => item.id === draggedSector.id)
    const targetIndex = siblings.findIndex(item => item.id === dropIndicator.sectorId)
    if (from < 0 || targetIndex < 0) return shifts
    const slot = targetIndex + (dropIndicator.position === 'after' ? 1 : 0) // 끼워 넣을 자리(원래 순서 기준 0~n)
    siblings.forEach((item, index) => {
      if (index === from) return
      if (from < slot && index > from && index < slot) shifts.set(item.id, -draggedRow.height)
      if (from > slot - 1 && index >= slot && index < from) shifts.set(item.id, draggedRow.height)
    })
    return shifts
  }, [draggedSector, isMoveDrag, dropIndicator, draggedRow, sectors, sectorOrder])

  const pressBadge = () => {
    window.clearTimeout(badgeHintTimer.current)
    const mainRect = mainAreaRef.current?.getBoundingClientRect()
    setHintPosition(mainRect ? { x: mainRect.left + mainRect.width / 2, y: mainRect.top + mainRect.height / 2 } : null)
    setBadgeHint(true)
  }
  const clickBadge = () => {
    window.clearTimeout(badgeHintTimer.current)
    badgeHintTimer.current = window.setTimeout(() => setBadgeHint(false), 3000)
  }
  // 번호 칸을 끌 때 놓을 수 있는 업종 — ↪ 이동과 같은 규칙이다: 자기와 그 하위, 지금 부모는 안 되고, 옮긴 뒤 가장 깊은 업종이 소분류를 넘지 않아야 한다.
  // 그래서 소분류를 대분류 줄에 바로 놓아 중분류로 올리거나, 중분류를 다른 중분류에 놓아 소분류로 내릴 수도 있고, 대분류도 다른 대분류 안으로 넣을 수 있다. 맨 위(대분류)로 올릴 때는 대분류 열 머리글에 놓는다.
  const isMoveDropTarget = (dragged: SectorItem | null, target: SectorItem) => {
    if (!dragged) return false
    return getMoveCandidates(dragged).some(candidate => candidate.id === target.id)
  }
  // 끄는 중 놓을 자리 표시(번호 칸 끌기는 놓을 수 있는 줄, 손잡이 끌기는 위·아래 어느 쪽에 끼울지). 대상 줄이 그대로여도 마우스가 줄 안에서 움직이면 다시 계산해야 해서 onDragOver와 onDragMove 둘 다 쓴다.
  const updateDragTarget = (event: DragOverEvent | DragMoveEvent) => {
    const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
    const targetData = event.over?.data.current as { sectorId: number } | undefined
    const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
    const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
    if ((event.active.data.current as { mode?: string } | undefined)?.mode === 'move') {
      setDropIndicator(null)
      setMoveOverId(draggedItem && targetItem && isMoveDropTarget(draggedItem, targetItem) ? targetItem.id : null)
      setMoveOverRoot(!!draggedItem && draggedItem.parentId !== null && (event.over?.data.current as { root?: boolean } | undefined)?.root === true)
      return
    }
    const activeRect = event.active.rect.current.translated
    const overRect = event.over?.rect
    if (draggedItem && targetItem && draggedItem.parentId === targetItem.parentId && draggedItem.id !== targetItem.id && activeRect && overRect) {
      const pointerY = draggedPointerY(event)
      const insertAfter = (pointerY ?? activeRect.top + activeRect.height / 2) > overRect.top + overRect.height / 2
      setDropIndicator({ sectorId: targetItem.id, position: insertAfter ? 'after' : 'before' })
    } else {
      setDropIndicator(null)
    }
      
  }

  const moveByDrag = async (dragged: SectorItem, target: SectorItem | null) => {
    if (!await appConfirm(`${dragged.name}\n${target ? getSectorPath(target) : '최상위'} 안으로 이동하시겠습니까?`)) return
    reparentSector.mutate({ id: dragged.id, parentId: target ? target.id : null }, {
      onSuccess: () => {
        // 보낸 업종(target)을 선택한 상태로 만들어 그 하위 목록이 열리게 하고, 새로 들어온 업종에 표시를 남긴다. 최상위로 올렸다면 그 업종 자신을 선택한다.
        const chain: SectorItem[] = []
        for (let current: SectorItem | undefined = target ?? undefined; current; current = current.parentId === null ? undefined : sectors.find(item => item.id === current!.parentId)) chain.unshift(current)
        setSelectedMajorId(target ? (chain[0]?.id ?? null) : dragged.id)
        setSelectedMiddleId(target ? (chain[1]?.id ?? null) : null)
        setSelectedSectorId(target ? target.id : dragged.id)
        setMovedSectorId(dragged.id)
        scrollToMovedRef.current = true
        triggerHighlight(dragged.id)
        pushHistory({ type: 'reparent', sectorId: dragged.id, name: dragged.name, fromParentId: dragged.parentId, toParentId: target ? target.id : null })
      },
    })
  }
  useEffect(() => {
    if (!scrollToMovedRef.current || movedSectorId === null) return
    const row = document.querySelector(`[data-sector-row="${movedSectorId}"]`)
    if (!row) return
    scrollToMovedRef.current = false
    row.scrollIntoView({ block: 'nearest' })
  }, [movedSectorId, sectors, selectedMajorId, selectedMiddleId])

  const renderRow = (row: Row) => {
    if (row.type === 'add-child') {
      const parentId = row.parentId
      const quotedChain = row.parentPath.map(name => `'${name}'`).join(' - ')
      return (
        <tr key={`add-child-${parentId}`}>
          <td className="py-0.5 text-left" style={{ paddingLeft: `${row.depth * 20 + 8}px` }}>
            {/* 입력칸 왼쪽을 항목 이름 글자의 시작선에 맞춘다 — 손잡이(24px) + 간격(4px) + 번호 칸(28px) + 간격(8px) = 64px. */}
            <div className="group/create flex items-center gap-2 pl-16">
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
                title={`${quotedChain} 업종 내 세부항목 추가`}
                aria-label={`${quotedChain} 업종 내 세부항목 이름`}
                className="h-7 w-40 rounded-md border-0 bg-[#3b3b3b] px-2 text-sm font-medium text-white outline-none placeholder:text-gray-400 focus:ring-1 focus:ring-inset focus:ring-[var(--brand)]"
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
      setMovedSectorId(null)
      setSelectedSectorId(sector.id)
      if (sector.depth === 0) { setSelectedMajorId(current => current === sector.id ? null : sector.id); setSelectedMiddleId(null) }
      if (sector.depth === 1) setSelectedMiddleId(current => current === sector.id ? null : sector.id)
    }
    // 선택한 경로(대·중·소분류에서 고른 업종)의 줄은 종목 표의 선택된 줄과 같은 청록 배경으로 칠한다.
    const isOnSelectedPath = selectedSectorId === sector.id || selectedMajorId === sector.id || selectedMiddleId === sector.id
    return (
      <DroppableSectorRow
        key={sector.id}
        sectorId={sector.id}
        className={`group ${isRenaming ? '' : 'cursor-pointer'} ${draggedSector?.id === sector.id ? (isMoveDrag ? 'opacity-40' : 'invisible') : ''} ${highlightedId === sector.id ? 'animate-row-blink' : ''}`}
        style={draggedSector && !isMoveDrag ? { transform: `translateY(${shiftById.get(sector.id) ?? 0}px)`, transition: 'transform 150ms ease' } : undefined}
        onClick={event => {
          if (isRenaming || (event.target as HTMLElement).closest('[data-no-row-select]')) return
          selectSector()
        }}
      >
        <td className={`relative py-0.5 text-left ${isMoveDrag && moveOverId === sector.id ? 'bg-[var(--brand)]/45 ring-1 ring-inset ring-[var(--brand)]' : isMoveDrag && isMoveDropTarget(draggedSector, sector) ? 'ring-1 ring-inset ring-[var(--brand)]/70' : ''} ${isOnSelectedPath ? 'bg-[var(--brand)]/35 group-hover:bg-[var(--brand)]/50' : movedSectorId === sector.id ? 'bg-[var(--brand)]/20 group-hover:bg-[var(--brand)]/30' : 'group-hover:bg-[var(--brand)]/10'} ${movedSectorId === sector.id ? 'shadow-[inset_3px_0_0_var(--brand)]' : ''}`} style={{ paddingLeft: `${sector.depth * 20 + 8}px` }}>
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center">
              <DraggableSectorHandle sectorId={sector.id} parentId={sector.parentId} enabled />
              {isRenaming ? (
                <SectorNameInput
                  wrapperClassName="flex min-w-0 flex-1"
                  autoFocus
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename(sector)
                    if (e.key === 'Escape') cancelRename()
                  }}
                  className="nes-input is-dark min-w-0 flex-1 text-sm"
                />
              ) : (
                <>
                  <DraggableNumberBadge sectorId={sector.id} parentId={sector.parentId} onPress={pressBadge} onClickBadge={clickBadge}>{itemNumber}</DraggableNumberBadge>
                  <button
                    type="button"
                    aria-expanded={expandable ? (sector.depth === 0 ? selectedMajorId === sector.id : selectedMiddleId === sector.id) : undefined}
                    className="truncate border-0 bg-transparent p-0 text-left text-sm text-white"
                  >
                    {sector.name}
                  </button>
                  {movedSectorId === sector.id && (
                    <span className="ml-2 shrink-0 rounded-sm bg-[var(--brand)] px-1 text-[11px] font-bold leading-4 text-black">방금 이동</span>
                  )}
                  {(childCountByParent.get(sector.id) ?? 0) > 0 && (
                    <span className="ml-1 shrink-0 text-sm text-gray-400">({toCount(childCountByParent.get(sector.id) ?? 0)})</span>
                  )}
                  {movingSector && moveTargetIds.has(sector.id) && (
                    <button
                      type="button"
                      data-no-row-select
                      title={`${movingSector.name}을(를) ${sector.name} 안으로 이동`}
                      onClick={() => void confirmMove(sector)}
                      className="ml-auto mr-2 h-6 shrink-0 rounded border border-[var(--brand)] bg-transparent px-2 text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand)] hover:text-black"
                    >
                      여기
                    </button>
                  )}
                  {/* 번호 칸을 끄는 동안 놓을 수 있는 줄 오른쪽 끝에 "여기" 표시를 띄운다(지금 위에 올라간 줄은 채워서 강조). */}
                  {isMoveDrag && isMoveDropTarget(draggedSector, sector) && (
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none ml-auto mr-2 h-6 shrink-0 rounded border border-[var(--brand)] px-2 text-xs font-bold leading-[22px] ${moveOverId === sector.id ? 'bg-[var(--brand)] text-black' : 'bg-transparent text-[var(--brand)]'}`}
                    >
                      여기
                    </span>
                  )}
                  {/* 선택한 항목은 줄 오른쪽 끝에 세부 업종 추가·이름 변경·삭제 아이콘을 보여 준다. 이동 모드 중이거나 번호 칸을 끄는 중에는 "여기"와 겹치지 않게 숨긴다. */}
                  {selectedSectorId === sector.id && !movingSector && !isMoveDrag && (
                    <span className="ml-auto flex shrink-0 items-center gap-0.5 pl-2 pr-2">
                      {sector.depth <= ADD_CHILD_MAX_PARENT_DEPTH && (
                        <button type="button" data-no-row-select title="세부 업종 추가" aria-label={`${sector.name} 세부 업종 추가`} onClick={() => toggleAddChild(sector.id)} className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-300 outline-none hover:text-[var(--brand)]">
                          <PlusIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" data-no-row-select title="이름 변경" aria-label={`${sector.name} 이름 변경`} onClick={() => startRename(sector)} className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-300 outline-none hover:text-[var(--brand)]">
                        <EditIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        data-no-row-select
                        title="삭제"
                        aria-label={`${sector.name} 삭제`}
                        onClick={() => {
                          if (isProtectedSector(sector)) {
                            void appAlert(`${sector.name}\n${NEW_LISTING_DELETE_MESSAGE}`)
                            return
                          }
                          remove(sector.id, sector.name)
                        }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center border-0 bg-transparent p-0 text-gray-300 outline-none hover:text-red-500"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </td>
      </DroppableSectorRow>
    )
  }

  return (
    <>
    <DndContext
      sensors={sensors}
      modifiers={[keepInColumnVertically]}
      collisionDetection={halfOverlapCollisionDetection}
      onDragOver={updateDragTarget}
      onDragMove={updateDragTarget}
      onDragStart={event => {
        setDropIndicator(null)
        setMovedSectorId(null)
        setMoveOverId(null)
        setMoveOverRoot(false)
        setIsMoveDrag((event.active.data.current as { mode?: string } | undefined)?.mode === 'move')
        const mainRect = mainAreaRef.current?.getBoundingClientRect()
        setHintPosition(mainRect ? { x: mainRect.left + mainRect.width / 2, y: mainRect.top + mainRect.height / 2 } : null)
        const dragData = event.active.data.current as { sectorId: number } | undefined
        setDraggedSector(dragData ? (sectors.find(c => c.id === dragData.sectorId) ?? null) : null)
        const grabbed = event.activatorEvent.target as HTMLElement | null
        const handleRect = grabbed?.closest('button')?.getBoundingClientRect()
        const rowRect = grabbed?.closest('tr')?.getBoundingClientRect()
        setDraggedRow(handleRect && rowRect ? { width: rowRect.width, offsetX: rowRect.left - handleRect.left, height: rowRect.height } : null)
      }}
      onDragEnd={event => {
        setDropIndicator(null)
        setDraggedSector(null)
        setDraggedRow(null)
        const draggedData = event.active.data.current as { sectorId: number; parentId: number | null } | undefined
        const targetData = event.over?.data.current as { sectorId: number } | undefined
        const draggedItem = draggedData && sectors.find(item => item.id === draggedData.sectorId)
        const targetItem = targetData && sectors.find(item => item.id === targetData.sectorId)
        const wasMoveDrag = (event.active.data.current as { mode?: string } | undefined)?.mode === 'move'
        window.clearTimeout(badgeHintTimer.current)
        setBadgeHint(false)
        setIsMoveDrag(false)
        setMoveOverId(null)
        const droppedOnRoot = (event.over?.data.current as { root?: boolean } | undefined)?.root === true
        setMoveOverRoot(false)
        if (wasMoveDrag) {
          if (draggedItem && droppedOnRoot && draggedItem.parentId !== null) void moveByDrag(draggedItem, null)
          else if (draggedItem && targetItem && isMoveDropTarget(draggedItem, targetItem)) void moveByDrag(draggedItem, targetItem)
          return
        }
        if (draggedItem && targetItem && draggedItem.parentId === targetItem.parentId && draggedItem.id !== targetItem.id) {
          const siblings = orderSectors(sectors.filter(item => item.parentId === draggedItem.parentId), draggedItem.parentId, sectorOrder)
          const fromIndex = siblings.findIndex(item => item.id === draggedItem.id)
          const targetIndex = siblings.findIndex(item => item.id === targetItem.id)
          const activeRect = event.active.rect.current.translated
          const overRect = event.over?.rect
          const pointerY = draggedPointerY(event)
          const insertAfter = !!activeRect && !!overRect && (pointerY ?? activeRect.top + activeRect.height / 2) > overRect.top + overRect.height / 2
          const [moved] = siblings.splice(fromIndex, 1)
          const adjustedTargetIndex = targetIndex - (fromIndex < targetIndex ? 1 : 0)
          siblings.splice(Math.max(0, adjustedTargetIndex + (insertAfter ? 1 : 0)), 0, moved)
          const beforeIds = orderSectors(sectors.filter(item => item.parentId === draggedItem.parentId), draggedItem.parentId, sectorOrder).map(item => item.id)
          const afterIds = siblings.map(item => item.id)
          updateSiblingOrder(draggedItem.parentId, siblings)
          if (beforeIds.join(',') !== afterIds.join(',')) pushHistory({ type: 'reorder', parentId: draggedItem.parentId, beforeIds, afterIds })
        }
      }}
      onDragCancel={() => {
        window.clearTimeout(badgeHintTimer.current)
        setBadgeHint(false)
        setIsMoveDrag(false)
        setMoveOverId(null)
        setMoveOverRoot(false)
        setDropIndicator(null)
        setDraggedSector(null)
        setDraggedRow(null)
      }}
    >
      <div ref={mainAreaRef} className="flex min-h-0 flex-1 flex-col">
        <SearchBar
          query={query}
          onChange={setQuery}
          placeholder="업종 검색"
          ariaLabel="업종 검색"
        />
        <div className="relative grid min-h-0 flex-1 grid-cols-3 overflow-hidden border border-slate-700 select-none [&_input]:select-text">
          {(['대분류', '중분류', '소분류'] as const).map((label, index) => (
            <div key={label} className="flex min-h-0 min-w-0 flex-col">
              {(() => {
                const headerClass = `flex h-7 shrink-0 items-center justify-center gap-2 bg-[#2b3a4f] text-sm font-bold ${index < 2 ? 'border-r border-white/15' : ''} ${index === activeColumn ? 'text-[var(--brand)]' : 'text-slate-100'}`
                const headerContent = (
                  <>
                    {label} ({toCount(sectorCounts[index])})
                    {index === activeColumn && <span aria-hidden="true" className="text-[var(--brand)]">⌃</span>}
                  </>
                )
                return index === 0 ? (
                  <RootDropHeader className={headerClass} isActive={isMoveDrag && draggedSector?.parentId !== null && draggedSector !== null} isOver={moveOverRoot}>{headerContent}</RootDropHeader>
                ) : (
                  <div className={headerClass}>{headerContent}</div>
                )
              })()}
              <div className={`min-h-0 flex-1 overflow-auto scrollbar-hide ${index < 2 ? 'border-r border-slate-700' : ''}`}>
                <table className="nes-table is-dark custom-page-table custom-sector-table w-full text-sm [border-collapse:separate] [border-spacing:0] [&_td]:border-slate-700 [&_td]:border-r-0"><tbody>{columnRows[index].map(renderRow)}</tbody></table>
              </div>
            </div>
          ))}
          {/* 업종이 하나도 없으면 거래소·MARKETRY 표와 같은 안내 글을 가운데에 보여준다. */}
          {viewSectors.length === 0 && <EmptyMessage message={sectors.length === 0 ? EMPTY_DATA_MESSAGE : EMPTY_SEARCH_MESSAGE} topClass="top-7" />}
        </div>
      </div>
      {/* 커서를 따라다니는 드래그 미리보기 — 끌고 있는 줄을 원래 폭의 한 줄 그대로(손잡이·번호·이름) 청록 배경에 그림자를 줘서 들어 올린 것처럼 보여 준다. */}
      {/* 끄는 동안 안내를 메인 영역 가운데에 띄운다 — ⠿ 손잡이는 위·아래로만 움직인다는 안내, 번호 칸은 끌어서 다른 업종으로 보낼 수 있다는 안내(다른 안내 말풍선과 같은 모양). */}
      {(badgeHint || (draggedSector && !isMoveDrag)) && createPortal(
        <div role="status" style={{ position: 'fixed', top: hintPosition?.y ?? '50%', left: hintPosition?.x ?? '50%', transform: 'translate(-50%, -50%)' }} className={`z-[100] whitespace-nowrap ${HINT_BUBBLE_CLASS}`}>
          {badgeHint ? (
            <><b className="text-red-600">드래그 앤 드랍</b>을 통해 선택한 하위 항목으로 보낼 수 있습니다.</>
          ) : (
            <><b className="text-red-600">위·아래</b>로만 이동할 수 있어요.</>
          )}
        </div>,
        document.body,
      )}
      <DragOverlay>
        {draggedSector && (() => {
          const siblings = orderSectors(sectors.filter(item => item.parentId === draggedSector.parentId), draggedSector.parentId, sectorOrder)
          const position = siblings.findIndex(item => item.id === draggedSector.id) + 1
          const number = draggedSector.parentId === null ? `${position}.` : draggedSector.depth >= 2 ? `(${position})` : `${position})`
          const childCount = childCountByParent.get(draggedSector.id) ?? 0
          return (
            <div
              style={{ width: draggedRow?.width, marginLeft: draggedRow?.offsetX, paddingLeft: `${draggedSector.depth * 20 + 8}px` }}
              className="flex items-center border-y-2 border-[var(--brand)] bg-[#1d4a57] py-0.5 text-sm text-white shadow-xl"
            >
              <span aria-hidden="true" className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center text-xl leading-none text-gray-300">⠿</span>
              <span aria-hidden="true" className="mr-2 inline-flex h-5 w-8 shrink-0 items-center justify-end pr-1 rounded-sm border border-gray-400 bg-zinc-700 text-sm leading-none font-bold text-gray-300 tabular-nums">{number}</span>
              <span className="truncate">{draggedSector.name}</span>
              {childCount > 0 && <span className="ml-1 shrink-0 text-gray-300">({toCount(childCount)})</span>}
            </div>
          )
        })()}
      </DragOverlay>
    </DndContext>
    {settingsActionsTarget && createPortal(
      <>
      {/* 업종 추가가 먼저, 아래 업종 재배치와는 구분선으로 나눈다 — 구분선은 그룹 페이지 설정창과 같은 모양이다. */}
      <section aria-label="업종 추가">
        <h2 className="settings-plain-title mb-3 text-[15px] font-medium leading-[22px] text-white">업종 추가</h2>
        <div className="flex min-w-0 items-center gap-2">
          <SectorNameInput
            wrapperClassName="flex min-w-0 flex-1"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="업종 이름 입력 후 Enter"
            aria-label="최상위 업종 이름"
            className="h-9 min-w-0 flex-1 rounded-md border border-gray-600 bg-zinc-700 px-2 text-xs text-white outline-none placeholder:text-gray-400 focus:border-[var(--brand)]"
          />
        </div>
      </section>
      <section aria-label="업종 재배치" className="relative mt-6 mb-6 before:absolute before:-top-3 before:left-0 before:right-0 before:border-t before:border-[rgb(255_255_255/12%)] before:content-['']">
        <h2 className="settings-plain-title mb-3 text-[15px] font-medium leading-[22px] text-white">업종 재배치</h2>
        <div className="mb-3 rounded-md border border-gray-600 bg-zinc-700 px-2 py-1.5 text-sm text-white">
          <div className="flex items-start gap-1">
            {/* 대분류 › 중분류 › 소분류를 한 줄에 이어 보여 주고, 길어서 넘치면 자동으로 다음 줄로 이어진다. */}
            <div className="min-w-0 flex-1 py-0.5 text-xs font-medium leading-5">
              {!selectedSector && <span className="text-gray-400">업종을 선택하세요</span>}
              {selectedSector && getSectorPath(selectedSector).split(' › ').map((name, index) => (
                <span key={index} className="break-all">
                  {index > 0 && (
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="mx-0.5 inline h-3.5 w-3.5 align-text-bottom text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                  )}
                  {name}
                </span>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" title="다른 업종 안으로 이동" disabled={!selectedSector} onClick={() => selectedSector && setMovingSectorId(selectedSector.id)} className={`${ICON_BUTTON_CLASS} disabled:cursor-not-allowed disabled:opacity-40`}><span aria-hidden="true" className="text-sm leading-none">↪</span></button>
              {movingSector && (
                <button type="button" onClick={cancelMove} className="h-6 rounded-md border border-gray-600 bg-zinc-700 px-2 text-xs font-medium text-white hover:bg-white/10">이동 취소</button>
              )}
            </div>
          </div>
          {movingSector && (
            <div className={`mt-2 p-2 text-xs leading-relaxed ${HINT_BUBBLE_COLOR_CLASS}`}>
              <p>
                <b>{movingSector.name}</b>을(를) 옮길 상위 업종 줄 오른쪽의 <b className="text-red-600">여기</b> 버튼을 누르세요. 줄을 눌러 펼치면 다른 업종도 찾을 수 있습니다.
              </p>
              {movingSector.parentId !== null && (
                <button type="button" onClick={() => void confirmMove(null)} className="mt-2 h-7 rounded-md border border-[#7a6d55] bg-transparent px-2 text-xs font-medium text-black hover:bg-black/10">
                  최상위로 이동
                </button>
              )}
            </div>
          )}
        </div>
      </section>
      {/* 변경 내역 — 종목 화면과 같은 부품이다. */}
      <section aria-label="변경 내역" className="relative mt-6 mb-6 before:absolute before:-top-3 before:left-0 before:right-0 before:border-t before:border-[rgb(255_255_255/12%)] before:content-['']">
        <h2 className="settings-plain-title m-0 text-[15px] font-medium leading-[22px] text-white">변경 내역</h2>
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
