import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { compareKoreanText } from '@/utils/koreanSort'
import { SEARCH_MAX_LENGTH } from '@/utils/sectorSearch'
import { DROPDOWN_GAP_PX, DROPDOWN_PANEL_CLASS, DROPDOWN_SNAP_ITEM_CLASS, dropdownListMaxHeight } from '@/components/dropdownStyle'

// 필터 목록의 한 줄 높이(h-7)와 한 번에 보이는 줄 수. 높이는 이 값의 곱으로 맞춰야 스크롤 끝에서 항목이 잘리지 않는다.
const FILTER_ROW_PX = 28
const FILTER_VISIBLE_ROWS = 10

const POPUP_WIDTH_PX = 208
const SEARCH_MIN_OPTIONS = 10

export function FunnelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 3.5h11l-4.2 5v3.8l-2.6 1.2V8.5z" />
    </svg>
  )
}

// "가나다 순 / 시가총액 순" 두 칸 — 대·중·소분류 필터와 일괄 변경 팝업이 같이 쓴다.
export function SectorOrderToggle({ label, value, onChange, compact = false }: { label: string; value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void; compact?: boolean }) {
  return (
    <div className={compact ? 'flex gap-3' : 'flex w-max gap-1 px-3 pb-2'} role="radiogroup" aria-label={`${label} 보기 순서`}>
      {([['alpha', '가나다 순'], ['cap', '시가총액 순']] as const).map(([option, text]) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={compact
            ? `whitespace-nowrap border-0 bg-transparent p-0 text-xs font-medium ${value === option ? 'text-[var(--brand)]' : 'text-ui-text hover:text-ui-white'}`
            : `h-6 shrink-0 whitespace-nowrap rounded border px-2 text-xs font-medium shadow-none outline-none focus:outline-none focus-visible:outline-none ${value === option ? 'border-transparent bg-brand-surface text-ui-white' : 'border-ui-border bg-transparent text-ui-text hover:text-ui-white'}`}
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
  hintOf?: (value: string) => string | undefined
  excluded: ReadonlySet<string>
  onToggle: (value: string) => void
  onSelectAll: () => void
  onSelectNone: (values: readonly string[]) => void
  // 전체 선택 상태에서 검색 결과를 누르면 해당 값만 남기고 선택을 시작한다.
  selectOnlyOnSearch?: boolean
  // 보기 순서 선택 — 있으면 목록 위에 "가나다 순 / 시가총액 순" 두 칸이 생긴다. 'cap'이면 optionOrder(시가총액 합 순), 'alpha'면 가나다 순으로 보인다.
  orderMode?: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
}

// "전체 선택 / 전체 해제" 배지 버튼 — 지금 상태와 맞는 쪽이 청록으로 눌러진 상태가 된다(설정창 선택 버튼과 같은 색: 미선택 회색, 선택 청록).
const BULK_BUTTON_CLASS = 'h-6 flex-1 rounded border p-0 text-xs font-medium'
const BULK_BUTTON_ON_CLASS = 'border-transparent bg-brand-surface text-ui-white'
const BULK_BUTTON_OFF_CLASS = 'border-ui-border bg-transparent text-ui-text hover:text-ui-white'

const NO_OPTIONS: readonly string[] = []
const defaultLabelOf = (value: string) => (value === '-' ? '(없음)' : value)

// 머리글 오른쪽의 필터 아이콘 — 누르면 아래에 체크 목록이 뜬다. 체크를 풀면 그 값의 종목이 표에서 빠지고, 걸려 있으면 아이콘이 청록색이다.
// 머리글 칸을 누르면 정렬이 바뀌므로, 아이콘 누름은 칸까지 전달하지 않는다.
export default function ColumnFilterButton({ label, getOptions, optionOrder, labelOf = defaultLabelOf, hintOf, excluded, onToggle, onSelectAll, onSelectNone, orderMode, selectOnlyOnSearch = false }: Props) {
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

  // 목록 전체(검색으로 가려진 항목 포함)가 모두 체크됐는지, 하나도 체크되지 않았는지 — 둘 다 아니면(일부만 체크) 두 버튼 모두 회색이다.
  const allSelected = sortedOptions.length > 0 && sortedOptions.every(option => !excluded.has(option))
  const noneSelected = sortedOptions.length > 0 && sortedOptions.every(option => excluded.has(option))

  const trimmed = query.trim().toLowerCase()
  const shownOptions = trimmed ? sortedOptions.filter(value => labelOf(value).toLowerCase().includes(trimmed)) : sortedOptions

  const toggleOption = (value: string) => {
    if (selectOnlyOnSearch && trimmed && sortedOptions.every(option => !excluded.has(option))) {
      onSelectNone(sortedOptions.filter(option => option !== value))
      setQuery('')
    } else {
      onToggle(value)
    }
  }

  // 열 때 아이콘 아래에 자리를 잡는다. 화면 오른쪽 끝이면 안쪽으로 밀고, 아래가 모자라면 위로 연다.
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - POPUP_WIDTH_PX / 2, window.innerWidth - POPUP_WIDTH_PX - 8))
    setPosition({ top: rect.bottom + DROPDOWN_GAP_PX, left })
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
        className={`flex h-4 w-4 shrink-0 items-center justify-center border-0 bg-transparent p-0 transition-colors hover:text-[var(--brand)] ${isActive || isOpen ? 'text-[var(--brand)]' : 'text-ui-muted'}`}
      >
        <FunnelIcon className="h-3.5 w-3.5" />
      </button>
      {isOpen && position && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={`${label} 필터`}
          style={{ position: 'fixed', top: position.top, left: position.left, width: POPUP_WIDTH_PX }}
          className={`column-filter-popup z-50 overflow-hidden ${DROPDOWN_PANEL_CLASS} pt-2 text-sm font-normal`}
          // 머리글(정렬 칸) 위에 떠 있어도 안의 누름이 정렬로 이어지지 않게 한다.
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 pb-2 text-xs text-ui-muted">
            <span className="shrink-0 rounded bg-[var(--brand-surface)] px-1.5 py-[3px] text-[11px] font-semibold leading-none text-ui-white">{label}</span>
            {orderMode && <SectorOrderToggle label={label} value={orderMode.value} onChange={orderMode.onChange} compact />}
          </div>
          {sortedOptions.length >= SEARCH_MIN_OPTIONS && (
            <div className="px-3 pb-2">
              <input
                type="text"
                maxLength={SEARCH_MAX_LENGTH}
                value={query}
                onChange={event => setQuery(event.target.value.slice(0, SEARCH_MAX_LENGTH))}
                placeholder="검색"
                aria-label={`${label} 검색`}
                autoFocus
                className="h-7 w-full rounded border border-ui-border bg-ui-panel px-2 text-sm text-ui-white outline-none focus:placeholder:text-transparent focus:border-[var(--brand)]"
              />
            </div>
          )}
          {/* 전체 선택·전체 해제 배지 — 검색창이 있을 만큼 항목이 많은 필터(10개 이상)에만 둔다. 항목이 적으면 하나씩 고르면 되어 두지 않는다. */}
          {sortedOptions.length >= SEARCH_MIN_OPTIONS && (
            <div className="flex gap-1 px-3 pb-2">
              <button type="button" aria-pressed={allSelected} className={`${BULK_BUTTON_CLASS} ${allSelected ? BULK_BUTTON_ON_CLASS : BULK_BUTTON_OFF_CLASS}`} onClick={onSelectAll}>전체 선택</button>
              <button type="button" aria-pressed={noneSelected} className={`${BULK_BUTTON_CLASS} ${noneSelected ? BULK_BUTTON_ON_CLASS : BULK_BUTTON_OFF_CLASS}`} onClick={() => onSelectNone(sortedOptions)}>전체 해제</button>
            </div>
          )}
          <ul className="column-filter-options m-0 list-none snap-y snap-mandatory overflow-y-scroll p-0" style={{ maxHeight: dropdownListMaxHeight(FILTER_VISIBLE_ROWS, FILTER_ROW_PX) }}>
            {shownOptions.length === 0 && <li className="px-3 py-1 text-ui-muted">검색 결과가 없습니다.</li>}
            {shownOptions.map(value => (
              <li key={value} className={DROPDOWN_SNAP_ITEM_CLASS}>
                <label data-hint={hintOf?.(value)} className="flex h-7 cursor-pointer items-center gap-2 px-3 hover:bg-ui-white/10">
                  <input type="checkbox" className="thin-check shrink-0" checked={!excluded.has(value)} onChange={() => toggleOption(value)} />
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
