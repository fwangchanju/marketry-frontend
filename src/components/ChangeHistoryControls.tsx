import { useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { usePopupPosition } from '@/hooks/usePopupPosition'
import { ChevronDownIcon } from '@/components/icons/AppIcons'

// 설정창 "변경 내역" 항목 — 실행 취소·다시 실행 두 칸과 변경 내역 목록. 종목 화면과 업종 화면이 같이 쓴다.
// 목록은 두 칸을 묶은 줄과 같은 왼쪽 끝·폭으로 펼쳐지고, 줄을 고르면 맨 위(다음 차례)부터 그 줄까지 순서대로 처리한다.

// 목록 한 번에 보이는 줄 수(넘으면 스크롤) — 줄 높이 24px × 10줄. 업종 선택 팝업·열 필터 목록과 같은 10줄이다.
const LIST_MAX_HEIGHT = 24 * 10

interface Props<T extends { id: string }> {
  undoStack: T[]
  redoStack: T[]
  // 목록의 한 줄에 보일 글자.
  describe: (action: T) => string
  onUndo: () => void
  onRedo: () => void
  // 목록에서 고른 항목(id)까지 순서대로 처리한다.
  onUndoItem: (id: string) => void
  onRedoItem: (id: string) => void
}

function HistoryListPopup<T extends { id: string }>({
  isOpen,
  setIsOpen,
  triggerRef,
  actions,
  direction,
  describe,
  onPick,
}: {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  triggerRef: React.RefObject<HTMLElement | null>
  actions: T[]
  direction: 'undo' | 'redo'
  describe: (action: T) => string
  onPick: (id: string) => void
}) {
  const popupRef = useRef<HTMLDivElement>(null)
  const position = usePopupPosition(isOpen, setIsOpen, triggerRef, popupRef, undefined, 0.8, false)
  // 마우스를 올린 줄까지 위에서부터 모두 강조해서, 누르면 어디까지 처리되는지 바로 보이게 한다.
  const [hoverIndex, setHoverIndex] = useState(-1)
  const actionLabel = direction === 'undo' ? '실행 취소' : '다시 실행'

  if (!isOpen || !position) return null

  const ordered = [...actions].reverse()

  return createPortal(
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        // 버튼 바로 밑에 붙지 않게 6px 띄운다(위로 열릴 땐 위로 6px).
        top: position.top + (position.openUpward ? -6 : 6),
        left: position.left,
        width: position.width,
        transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
        '--accent': 'var(--panel-gray)',
      } as CSSProperties}
      className="z-50 overflow-hidden rounded-md border border-ui-border bg-[var(--ui-panel)] text-sm text-ui-white shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      {ordered.length === 0 ? (
        <p className="whitespace-nowrap px-3 py-1 text-ui-muted">{actionLabel}할 변경 내역이 없습니다.</p>
      ) : (
        <div className="change-history-list overflow-y-auto" style={{ maxHeight: LIST_MAX_HEIGHT }} onMouseLeave={() => setHoverIndex(-1)}>
          {ordered.map((action, index) => (
            <button
              key={action.id}
              onMouseEnter={() => setHoverIndex(index)}
              type="button"
              onClick={() => {
                onPick(action.id)
                setIsOpen(false)
              }}
              className={`flex h-[25px] w-full items-center gap-3 whitespace-nowrap rounded-none border-0 px-3 py-0 text-left text-[13px] font-medium transition-colors ${index <= hoverIndex ? 'bg-[var(--accent)]/35 text-ui-white' : 'bg-transparent text-ui-white hover:bg-ui-white/10'}`}
            >
              <span className={`w-4 shrink-0 text-right text-xs tabular-nums ${index <= hoverIndex ? 'text-ui-white' : 'text-ui-muted'}`}>{direction === 'undo' ? '-' : '+'}{index + 1}</span>
              <span className="flex min-w-0 flex-col">
                {describe(action).split('\n').map((line, lineIndex) => (
                  <span key={lineIndex} className={`truncate ${lineIndex > 0 ? `text-xs font-normal ${index <= hoverIndex ? 'text-ui-white' : 'text-ui-text'}` : ''}`}>{line}</span>
                ))}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}

export default function ChangeHistoryControls<T extends { id: string }>({ undoStack, redoStack, describe, onUndo, onRedo, onUndoItem, onRedoItem }: Props<T>) {
  const [isUndoListOpen, setIsUndoListOpen] = useState(false)
  const [isRedoListOpen, setIsRedoListOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  const pill = (kind: 'undo' | 'redo') => {
    const isUndo = kind === 'undo'
    const stack = isUndo ? undoStack : redoStack
    const isListOpen = isUndo ? isUndoListOpen : isRedoListOpen
    const setListOpen = isUndo ? setIsUndoListOpen : setIsRedoListOpen
    const isEmpty = stack.length === 0
    const label = isUndo ? '실행 취소' : '다시 실행'
    return (
      <>
        <div className={`flex min-h-[25px] min-w-0 items-stretch overflow-hidden rounded-[5px] text-[13px] leading-[1.3] font-medium bg-[var(--ui-control)] text-ui-white ${isEmpty ? 'opacity-35' : ''}`}>
          <button
            type="button"
            onClick={() => {
              if (isUndo) setIsRedoListOpen(false)
              else setIsUndoListOpen(false)
              setListOpen(prev => !prev)
            }}
            disabled={isEmpty}
            className={`flex w-5 shrink-0 items-center justify-center settings-chip-hover border-0 border-r border-ui-white/20 bg-transparent p-0 text-ui-white disabled:cursor-not-allowed ${isListOpen ? '!bg-[var(--accent)]/35' : ''}`}
            aria-label={`${label} 목록`}
          >
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={isUndo ? onUndo : onRedo}
            disabled={isEmpty}
            className={`settings-chip-hover flex min-w-0 flex-1 items-center justify-center gap-1 border-0 bg-transparent px-1.5 text-[13px]/4 font-medium text-ui-white disabled:cursor-not-allowed`}
            aria-label={label}
          >
            <span className="truncate">{label}</span>
          </button>
        </div>
        <HistoryListPopup
          isOpen={isListOpen}
          setIsOpen={setListOpen}
          triggerRef={rowRef}
          actions={stack}
          direction={kind}
          describe={describe}
          onPick={isUndo ? onUndoItem : onRedoItem}
        />
      </>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <p className="settings-description m-0 mt-1 text-xs font-medium text-ui-muted">변경 내역 실행 취소·다시 실행</p>
      <div ref={rowRef} className="mt-auto mb-auto grid max-w-full settings-control-inset grid-cols-2 gap-[6px]">
        {pill('undo')}
        {pill('redo')}
      </div>
    </div>
  )
}
