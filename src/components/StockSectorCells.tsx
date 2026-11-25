import type { SectorOption } from '@/utils/sectorOptions'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PROTECTED_SECTOR_TEXT_CLASS, isProtectedSectorName } from '@/utils/protectedSector'
import { SEARCH_MAX_LENGTH } from '@/utils/sectorSearch'
import { usePopupPosition, type PopupPosition } from '@/hooks/usePopupPosition'
import { POPUP_WIDTH_PX, SectorOrderToggle } from '@/components/ColumnFilterButton'
import { DROPDOWN_GAP_PX } from '@/components/dropdownStyle'

// 검색어가 자기 이름이나 조상(부모/조부모...) 중 하나에라도 걸리면 매칭으로 본다.
// 예: "반"으로 검색하면 "반도체"뿐 아니라 그 하위 "메모리"/"파운드리"도 같이 남는다.
function matchesSectorSearch(option: SectorOption, trimmed: string, byId: Map<number, SectorOption>): boolean {
  let current: SectorOption | undefined = option
  while (current) {
    if (current.name.toLowerCase().includes(trimmed)) return true
    current = current.parentId != null ? byId.get(current.parentId) : undefined
  }
  return false
}

// 섹터 선택 팝업 목록 한 행의 높이(px) — 행의 min-h-7(28px)과 같다.
const FILTER_LIST_ROW_HEIGHT = 28
// 선택 팝업을 한 화면에 몇 개 행까지 보여줄지 — 이보다 적으면 목록 실제 높이만큼만 차지하고,
// 많으면 이 높이에서 스크롤(overflow-y-auto)된다. 열 머리글 필터(ColumnFilterButton)도 같은 10개다.
const FILTER_LIST_MAX_VISIBLE_ROWS = 10
const FILTER_LIST_MAX_HEIGHT = FILTER_LIST_ROW_HEIGHT * FILTER_LIST_MAX_VISIBLE_ROWS


// 섹터 검색창의 검색어/방향키 탐색 상태 — StockSectorCell과 BulkAssignButton이 공유.
// isOpen이 false(팝업 닫힘)면 아무도 matches를 안 쓰므로 계산 자체를 건너뛴다 — 행이 수천 개라
// 팝업 열림 여부와 무관하게 매 렌더마다 계산하면 그 비용이 그대로 누적된다.
function useSectorSearchState(options: SectorOption[], isOpen: boolean) {
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const reset = () => {
    setQuery('')
    setHighlightedIndex(-1)
  }

  const handleQueryChange = (value: string) => {
    setQuery(value.slice(0, SEARCH_MAX_LENGTH))
    setHighlightedIndex(-1)
  }

  const trimmed = query.trim().toLowerCase()
  // 검색 전엔 전체 섹터를 그대로 보여주고(방향키로 바로 탐색 가능), 검색어가 있으면 그 안에서만 필터링한다.
  // 부모가 매칭되면 그 하위 섹터도 같이 남겨서(예: "반" -> 반도체 + 메모리/파운드리), 트리 맥락이 끊기지 않게 한다.
  const matches = useMemo(() => {
    if (!isOpen || !trimmed) return options
    const optionsById = new Map(options.map(opt => [opt.id, opt]))
    return options.filter(opt => matchesSectorSearch(opt, trimmed, optionsById))
  }, [isOpen, trimmed, options])

  const handleArrowsAndEnter = (e: React.KeyboardEvent<HTMLInputElement>, onSelect: (sectorId: number) => void) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i < 0 ? 0 : (i + 1) % matches.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (matches.length === 0) return
      setHighlightedIndex(i => (i <= 0 ? matches.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = matches[highlightedIndex]
      if (target) onSelect(target.id)
    }
  }

  return { query, handleQueryChange, matches, highlightedIndex, setHighlightedIndex, handleArrowsAndEnter, reset }
}

// 섹터 검색 팝업(검색창 + 전체/필터링된 목록). 대분류·소분류 셀과 일괄 변경 버튼이 트리거만 다르게 해서 같이 쓴다.
function SectorSearchPopup({
  popupRef,
  inputRef,
  position,
  search,
  onSelect,
  onEscape,
  contextLabel,
  title,
  orderMode,
  currentSectorId,
}: {
  popupRef: React.RefObject<HTMLDivElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>
  position: PopupPosition
  search: ReturnType<typeof useSectorSearchState>
  onSelect: (sectorId: number) => void
  onEscape: () => void
  // 소분류 팝업처럼 목록이 특정 대분류로 좁혀져 있을 때, 지금 어느 대분류 밑을 보고 있는지 알려주는 칩.
  contextLabel?: string
  // 일괄 변경 팝업 — 제목과 "가나다 순 / 시가총액 순" 선택(고른 순서는 호출한 쪽이 options 순서로 반영한다).
  title?: string
  orderMode?: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
  // 지금 이 칸에 지정된 업종 번호 — 그 줄에만 체크 표시를 붙인다(고르면 바로 적용되므로 여러 개 체크가 아니다).
  currentSectorId?: number | null
}) {
  // 방향키로 하이라이트가 화면 밖으로 나가면 스크롤이 안 따라가서 지금 뭐가 선택됐는지 안 보이는
  // 문제가 있었다 — 하이라이트된 항목의 DOM 노드를 등록해뒀다가, 바뀔 때마다 보이는 영역으로 스크롤한다.
  const optionRefs = useRef(new Map<number, HTMLButtonElement>())
  useEffect(() => {
    optionRefs.current.get(search.highlightedIndex)?.scrollIntoView({ block: 'nearest' })
  }, [search.highlightedIndex])

  // 목록이 한 단계(같은 부모 아래)뿐이면 들여쓰기·"- " 표시 없이 이름만 보여준다.
  const isSingleLevel = search.matches.every(opt => opt.parentId === search.matches[0]?.parentId)

  return (
    <div
      ref={popupRef}
      style={{
        position: 'fixed',
        top: position.top + (position.openUpward ? -DROPDOWN_GAP_PX : DROPDOWN_GAP_PX),
        left: position.left,
        transform: `translate(${position.alignRight ? '-100%' : '0'}, ${position.openUpward ? '-100%' : '0'})`,
        // 제목과 정렬 전환이 한 줄에 들어가도록 내용 폭에 맞추되, 최소는 헤더 필터 팝업 폭(208px)을 지킨다.
        ...(orderMode ? { width: 'max-content', minWidth: POPUP_WIDTH_PX } : {}),
      }}
      className="z-50 w-[195px] overflow-hidden rounded-md border border-ui-border bg-[var(--ui-panel)] pt-2 text-sm font-normal text-ui-white shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      {title && (
        // 대·중·소분류 필터(ColumnFilterButton)와 같은 양식: 제목은 왼쪽, 가나다·시가총액 전환은 오른쪽.
        <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs text-ui-muted">
          <span className="shrink-0 rounded bg-[var(--brand-surface)] px-1.5 py-[3px] text-[11px] font-semibold leading-none text-ui-white">{title}</span>
          {orderMode && <SectorOrderToggle label={title} value={orderMode.value} onChange={orderMode.onChange} compact />}
        </div>
      )}
      <div className="px-3 pb-2">
        <input
          ref={inputRef}
          type="text"
          maxLength={SEARCH_MAX_LENGTH}
          autoFocus
          value={search.query}
          onChange={e => search.handleQueryChange(e.target.value)}
          onKeyDown={e => (e.key === 'Escape' ? onEscape() : search.handleArrowsAndEnter(e, onSelect))}
          placeholder="업종 검색"
          aria-label="업종 검색"
          className="h-7 w-full rounded border border-ui-border bg-ui-panel px-2 text-sm text-ui-white outline-none focus:placeholder:text-transparent focus:border-[var(--brand)]"
        />
      </div>
      {contextLabel && <p className="m-0 truncate px-3 pb-2 text-xs font-medium text-ui-muted">{contextLabel}</p>}
      <div className="sector-popup-options overflow-y-auto" style={{ maxHeight: FILTER_LIST_MAX_HEIGHT }}>
        {search.matches.length === 0 ? (
          <p className="m-0 px-3 py-1 text-ui-muted">검색 결과가 없습니다.</p>
        ) : (
          search.matches.map((opt, index) => (
            <button
              key={opt.id}
              ref={el => {
                if (el) optionRefs.current.set(index, el)
                else optionRefs.current.delete(index)
              }}
              type="button"
              onClick={() => onSelect(opt.id)}
              onMouseEnter={() => search.setHighlightedIndex(index)}
              className={`flex min-h-7 w-full items-center truncate rounded-none border-0 py-1 pr-3 pl-4 text-left text-sm font-normal shadow-none outline-none ${
                opt.parentId === null && isProtectedSectorName(opt.name) ? PROTECTED_SECTOR_TEXT_CLASS : 'text-ui-white'
              } ${index === search.highlightedIndex ? 'bg-ui-white/10' : 'bg-transparent'}`}
            >
              <span className="min-w-0 flex-1 truncate">{isSingleLevel ? opt.name : opt.label}</span>
              {currentSectorId != null && opt.id === currentSectorId && (
                <span aria-label="현재 지정됨" className="ml-2 shrink-0 text-[var(--brand)]">✓</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// 대분류/소분류 셀. 검색창 열림 상태를 이 컴포넌트 안에서만 갖고 있어서,
// 타이핑해도 전체 종목 테이블(2700여 행)이 다시 렌더되지 않는다.
export function StockSectorCell({
  value,
  options,
  onAssign,
  isHighlighted,
  rowHoverClass,
  onHoverStart,
  onHoverEnd,
  onEditingChange,
  contextLabel,
  disabled,
  disabledHint,
  title,
  orderMode,
  currentSectorId,
}: {
  value: string
  options: SectorOption[]
  onAssign: (sectorId: number) => void
  isHighlighted: boolean
  rowHoverClass: string
  onHoverStart: () => void
  onHoverEnd: () => void
  onEditingChange: (editing: boolean) => void
  contextLabel?: string
  // 예: 중분류가 아직 지정 안 된 상태의 소분류 셀 — 고를 수 있는 범위 자체가 없으니 클릭해도 팝업을 안 띄운다.
  disabled?: boolean
  // disabled일 때 마우스를 올리면 공통 말풍선(data-hint)으로 뜨는 안내 문구.
  disabledHint?: string
  // 팝업 제목과 "가나다 순 / 시가총액 순" 선택(일괄 변경 팝업과 같은 모양).
  title?: string
  orderMode?: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
  currentSectorId?: number | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const cellRef = useRef<HTMLTableCellElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const search = useSectorSearchState(options, isOpen)

  // 바깥 클릭/스크롤로 닫힐 때도(usePopupPosition 내부에서 직접 호출) 항상 이 함수를 거치도록,
  // 팝업 열림 상태를 바꾸는 지점을 하나로 모은다 — 그래야 행 하이라이트(onEditingChange)가 항상 같이 갱신된다.
  const updateOpen = (open: boolean) => {
    setIsOpen(open)
    onEditingChange(open)
    // 팝업이 열려있는 동안 마우스가 밖으로 나가도(예: 검색 목록 클릭) 진한 컬럼 강조가 그대로 남지 않도록 끈다.
    if (open) onHoverEnd()
  }

  // 섹터 목록 팝업은 세로로 훨씬 커져서(약 12개 높이), 기본 임계값(80%)보다 일찍 위로 뒤집어야 화면 밖으로 안 잘린다.
  // 대분류/소분류는 테이블 우측에 몰려있어 오른쪽으로 열면 화면 밖으로 잘리므로, 필터 팝업과 동일하게
  // 셀 우측 끝에 맞춰 왼쪽으로 열리게 한다.
  const position = usePopupPosition(isOpen, updateOpen, cellRef, popupRef, () => inputRef.current?.focus(), 0.6, true)

  const handleSelect = (sectorId: number) => {
    onAssign(sectorId)
    updateOpen(false)
  }

  return (
    <td
      ref={cellRef}
      data-no-row-select
      data-hint={disabled ? disabledHint : undefined}
      className={`truncate pl-2 text-left ${disabled ? 'cursor-default text-ui-muted' : 'cursor-pointer'} ${
        isHighlighted ? 'bg-[var(--brand)]/35' : rowHoverClass
      }`}
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onClick={
        disabled
          ? e => e.stopPropagation()
          : e => {
              // 행 전체 클릭 시 체크박스가 토글되는 동작(AdminStockRow)과 별개로 동작해야 하므로 버블링을 막는다.
              e.stopPropagation()
              search.reset()
              updateOpen(true)
            }
      }
    >
      {value}
      {!disabled && isOpen && position && (
        <SectorSearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => updateOpen(false)}
          contextLabel={contextLabel}
          title={title}
          orderMode={orderMode}
          currentSectorId={currentSectorId}
        />
      )}
    </td>
  )
}

// 체크된 종목들을 한 섹터로 한 번에 재배정하는 버튼. 팝업 자체는 StockSectorCell과 동일하게 동작한다.
export function BulkAssignButton({
  count,
  options,
  onAssign,
  disabled = false,
  disabledHint,
  label,
  title,
  orderMode,
  currentSectorId,
}: {
  count: number
  options: SectorOption[]
  onAssign: (sectorId: number) => void
  // 버튼에 보일 글자(대분류·중분류·소분류) — "일괄 변경"은 위 섹션 제목이 말해 준다.
  label: string
  title: string
  orderMode: { value: 'alpha' | 'cap'; onChange: (value: 'alpha' | 'cap') => void }
  // 선행 단계(1차/2차)가 아직 적용 안 된 상태의 2차/3차 버튼 — 버튼 자체는 평소와 똑같이 보이되,
  // 누르면 아무 일도 없고, 마우스를 올리면 안내 문구가 공통 말풍선(data-hint)으로 뜬다(StockSectorCell의 disabled 셀과 동일한 패턴).
  disabled?: boolean
  disabledHint?: string
  // 선택한 종목들이 모두 같은 업종일 때만 그 번호(그 줄에 체크 표시), 아니면 null.
  currentSectorId?: number | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 설정창은 좌우로 옮길 수 있어서, 누르는 순간 버튼이 화면 오른쪽 절반에 있으면 팝업을 왼쪽으로 연다.
  const [alignRight, setAlignRight] = useState(false)
  const search = useSectorSearchState(options, isOpen)

  const position = usePopupPosition(
    isOpen,
    setIsOpen,
    buttonRef,
    popupRef,
    () => inputRef.current?.focus(),
    0.6,
    alignRight,
  )

  // 고른 종목이 없으면 흐리게 비활성이다(누르면 아무 일도 없다).
  const isIdle = count === 0
  const handleClick = () => {
    if (isIdle) return
    if (disabled) return
    search.reset()
    setAlignRight((buttonRef.current?.getBoundingClientRect().left ?? 0) > window.innerWidth / 2)
    setIsOpen(true)
  }

  const handleSelect = (sectorId: number) => {
    onAssign(sectorId)
    setIsOpen(false)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        aria-disabled={isIdle}
        data-hint={!isIdle && disabled ? disabledHint : undefined}
        className={`flex h-[25px] w-full items-center justify-center whitespace-nowrap rounded-[5px] border-0 px-1.5 text-[13px] leading-[1.3] font-medium transition-colors ${
          isIdle ? 'cursor-not-allowed bg-[var(--ui-control)] text-ui-white opacity-35' : 'settings-chip-hover bg-[var(--ui-control)] text-ui-white'
        }`}
      >
        {label}
      </button>
      {isOpen && position && !disabled && createPortal(
        <SectorSearchPopup
          popupRef={popupRef}
          inputRef={inputRef}
          position={position}
          search={search}
          onSelect={handleSelect}
          onEscape={() => setIsOpen(false)}
          title={title}
          orderMode={orderMode}
          currentSectorId={currentSectorId}
        />,
        document.body,
      )}
    </>
  )
}

