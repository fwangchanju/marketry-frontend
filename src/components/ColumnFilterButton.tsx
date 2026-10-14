import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compareKoreanText } from '@/utils/koreanSort'

const POPUP_WIDTH_PX = 208
const SEARCH_MIN_OPTIONS = 10

function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 3.5h11l-4.2 5v3.8l-2.6 1.2V8.5z" />
    </svg>
  )
}

// "가나다 순 / 사용자 지정 순" 두 칸 — 대·중·소분류 필터와 일괄 변경 팝업이 같이 쓴다.
export function SectorOrderToggle({ label, value, onChange }: { label: string; value: 'alpha' | 'custom'; onChange: (value: 'alpha' | 'custom') => void }) {
  return (
    <div className="flex gap-1 px-3 pb-2" role="radiogroup" aria-label={`${label} 보기 순서`}>
      {([['alpha', '가나다 순'], ['custom', '사용자 지정 순']] as const).map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={`h-6 flex-1 rounded border p-0 text-xs font-medium leading-none shadow-none outline-none focus:outline-none focus-visible:outline-none ${value === option ? 'border-[var(--brand)] bg-transparent text-[var(--brand)]' : 'border-gray-600 bg-transparent text-gray-300 hover:text-[var(--brand)]'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

interface Props {
  // 머리글 이름(접근성 이름과 팝업 제목에 쓴다).
  label: string
  // 고를 수 있는 값 전체를 돌려주는 함수 — 팝업이 열려 있을 때만 부른다(종목이 수천 개라 열마다 미리 모으지 않는다).
  getOptions: () => readonly string[]
  optionOrder?: readonly string[]
  // 화면에 보일 값 이름 — 기본은 값 그대로이고, 비어 있는 값('-')은 "(없음)"으로 보인다.
  labelOf?: (value: string) => string
  excluded: ReadonlySet<string>
  onToggle: (value: string) => void
  onSelectAll: () => void
  onSelectNone: (values: readonly string[]) => void
  // 보기 순서 선택 — 있으면 목록 위에 "가나다 순 / 사용자 지정 순" 두 칸이 생긴다. 'custom'이면 optionOrder, 'alpha'면 가나다 순으로 보인다.
  orderMode?: { value: 'alpha' | 'custom'; onChange: (value: 'alpha' | 'custom') => void }
}

const NO_OPTIONS: readonly string[] = []
const defaultLabelOf = (value: string) => (value === '-' ? '(없음)' : value)

// 머리글 오른쪽의 필터 아이콘 — 누르면 아래에 체크 목록이 뜬다. 체크를 풀면 그 값의 종목이 표에서 빠지고, 걸려 있으면 아이콘이 청록색이다.
// 머리글 칸을 누르면 정렬이 바뀌므로, 아이콘 누름은 칸까지 전달하지 않는다.
export default function ColumnFilterButton({ label, getOptions, optionOrder, labelOf = defaultLabelOf, excluded, onToggle, onSelectAll, onSelectNone, orderMode }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const isActive = excluded.size > 0

  const options = isOpen ? getOptions() : NO_OPTIONS
  const sortedOptions = useMemo(() => {
    const order = new Map((orderMode?.value === 'alpha' ? [] : optionOrder ?? []).map((value, index) => [value, index]))
    return [...options].sort((a, b) => {
      const ia = order.get(a)
      const ib = order.get(b)
      if (ia !== undefined || ib !== undefined) return (ia ?? Infinity) - (ib ?? Infinity)
      // 값이 없는 칸('-')은 맨 아래에 둔다.
      if (a === '-' || b === '-') return a === '-' ? 1 : -1
      return compareKoreanText(a, b)
    })
  }, [options, optionOrder, orderMode?.value])

  const trimmed = query.trim()
  const shownOptions = trimmed ? sortedOptions.filter(value => labelOf(value).includes(trimmed)) : sortedOptions

  // 열 때 아이콘 아래에 자리를 잡는다. 화면 오른쪽 끝이면 안쪽으로 밀고, 아래가 모자라면 위로 연다.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - POPUP_WIDTH_PX / 2, window.innerWidth - POPUP_WIDTH_PX - 8))
    setPosition({ top: rect.bottom + 4, left })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const close = () => setIsOpen(false)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close)
    }
  }, [isOpen])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label} 필터`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={event => {
          event.stopPropagation()
          setQuery('')
          setIsOpen(open => !open)
        }}
        className={`flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 transition-colors hover:text-[var(--brand)] ${isActive || isOpen ? 'text-[var(--brand)]' : 'text-slate-500'}`}
      >
        <FunnelIcon className="h-3.5 w-3.5" />
      </button>
      {isOpen && position && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={`${label} 필터`}
          style={{ position: 'fixed', top: position.top, left: position.left, width: POPUP_WIDTH_PX }}
          className="z-50 rounded-md border border-gray-500 bg-[#363639] py-2 text-sm font-normal text-white shadow-xl"
          // 머리글(정렬 칸) 위에 떠 있어도 안의 누름이 정렬로 이어지지 않게 한다.
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 pb-2 text-xs text-gray-400">
            <span className="font-bold text-[var(--brand)]">{label}</span>
            <span className="flex gap-3">
              <button type="button" className="border-0 bg-transparent p-0 text-xs font-medium text-gray-300 hover:text-[var(--brand)]" onClick={onSelectAll}>전체 선택</button>
              <button type="button" className="border-0 bg-transparent p-0 text-xs font-medium text-gray-300 hover:text-[var(--brand)]" onClick={() => onSelectNone(sortedOptions)}>전체 해제</button>
            </span>
          </div>
          {sortedOptions.length >= SEARCH_MIN_OPTIONS && (
            <div className="px-3 pb-2">
              <input
                type="text"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="검색"
                aria-label={`${label} 검색`}
                autoFocus
                className="h-7 w-full rounded border border-gray-600 bg-zinc-700 px-2 text-sm text-white outline-none focus:placeholder:text-transparent focus:border-[var(--brand)]"
              />
            </div>
          )}
          {orderMode && <SectorOrderToggle label={label} value={orderMode.value} onChange={orderMode.onChange} />}
          <ul className="m-0 max-h-64 list-none overflow-y-auto p-0">
            {shownOptions.length === 0 && <li className="px-3 py-1 text-gray-400">결과가 없습니다</li>}
            {shownOptions.map(value => (
              <li key={value}>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-1 hover:bg-white/10">
                  <input type="checkbox" className="thin-check shrink-0" checked={!excluded.has(value)} onChange={() => onToggle(value)} />
                  <span className="min-w-0 truncate">{labelOf(value)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  )
}
