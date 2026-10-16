import { useRef, useState } from 'react'
import { usePopupPosition } from '@/hooks/usePopupPosition'
import { ChevronDownIcon } from '@/components/icons/AppIcons'

// 설정창 "변경 내역" 항목 — 실행 취소·다시 실행 두 칸과 변경 내역 목록. 종목 화면과 업종 화면이 같이 쓴다.
// 목록은 두 칸을 묶은 줄과 같은 왼쪽 끝·폭으로 펼쳐지고, 줄을 고르면 맨 위(다음 차례)부터 그 줄까지 순서대로 처리한다.

// 목록 한 번에 보이는 줄 수(넘으면 스크롤) — 줄 높이 24px × 15줄.
const LIST_MAX_HEIGHT = 24 * 15

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

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        // 버튼 바로 밑에 붙지 않게 6px 띄운다(위로 열릴 땐 위로 6px).
        top: position.top + (position.openUpward ? -6 : 6),
        left: position.left,
        width: position.width,
        transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
      }}
      className="z-50 overflow-hidden rounded-none border border-gray-500 bg-[#363639] p-0 text-sm text-white shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      {ordered.length === 0 ? (
        <p className="whitespace-nowrap px-1 text-gray-400">{actionLabel}할 변경 내역이 없습니다.</p>
      ) : (
        <div className="overflow-y-auto scrollbar-thin" style={{ maxHeight: LIST_MAX_HEIGHT }} onMouseLeave={() => setHoverIndex(-1)}>
          {ordered.map((action, index) => (
            <button
              key={action.id}
              onMouseEnter={() => setHoverIndex(index)}
              type="button"
              onClick={() => {
                onPick(action.id)
                setIsOpen(false)
              }}
              data-hint={`${index + 1}단계 ${direction === 'undo' ? '실행 취소' : '다시 실행'}`}
              className={`flex w-full items-center gap-2 whitespace-nowrap rounded-none border-0 px-2 py-1 text-left text-sm font-normal text-white ${index > 0 ? 'border-t border-t-white/30' : ''} ${index <= hoverIndex ? 'bg-[var(--brand)]/20 border-white/25!' : 'bg-transparent'}`}
            >
              <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-400">{direction === 'undo' ? '-' : '+'}{index + 1}</span>
              <span className="min-w-0 truncate">{describe(action)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
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
        <div className={`flex min-h-[26px] min-w-0 items-stretch overflow-hidden rounded-[5px] text-[13px]/4 font-medium ${isEmpty ? 'bg-[#4b4b50] opacity-50' : 'bg-[var(--accent)]'}`}>
          <button
            type="button"
            onClick={() => {
              if (isUndo) setIsRedoListOpen(false)
              else setIsUndoListOpen(false)
              setListOpen(prev => !prev)
            }}
            disabled={isEmpty}
            className={`flex w-5 shrink-0 items-center justify-center border-0 border-r bg-transparent p-0 hover:bg-black/10 disabled:cursor-not-allowed disabled:hover:bg-transparent ${isEmpty ? 'border-white/15 text-zinc-200' : 'border-black/15 text-zinc-900'} ${isListOpen ? '!bg-black/10' : ''}`}
            data-hint={`${label} 목록`}
            aria-label={`${label} 목록`}
          >
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={isUndo ? onUndo : onRedo}
            disabled={isEmpty}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-0 bg-transparent px-1.5 text-[13px]/4 font-medium hover:bg-black/10 disabled:cursor-not-allowed disabled:hover:bg-transparent ${isEmpty ? 'text-zinc-200' : 'text-zinc-900'}`}
            data-hint={`${label} (${isUndo ? 'Ctrl+Z' : 'Ctrl+Y'})`}
            aria-label={label}
          >
            <span className="truncate">{label}{isEmpty ? '' : ` (${stack.length})`}</span>
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
    <div>
      <p className="settings-description m-0 mt-1 text-xs font-medium text-gray-300">변경 내역 실행 취소·다시 실행</p>
      <div ref={rowRef} className="mt-4 grid max-w-[16rem] settings-control-inset grid-cols-2 gap-[6px]">
        {pill('undo')}
        {pill('redo')}
      </div>
    </div>
  )
}
