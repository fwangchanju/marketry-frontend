import { useEffect, useRef, useState } from 'react'
import ToolbarPopup from '@/components/ToolbarPopup'
import PopupHeader from '@/components/PopupHeader'
import { DROPDOWN_SCROLL_CLASS, DROPDOWN_SNAP_ITEM_CLASS } from '@/components/dropdownStyle'
import type { ExcludedStock } from '@/utils/rangeChangeRate'

// 제외 종목 목록에서 한 번에 보이는 줄 수와 한 줄 높이(rem, h-6). 넘치면 스크롤한다(팝업 크기는 예전 10줄 그대로).
const VISIBLE_ROWS = 10
const ROW_REM = 1.5

interface Props {
  // 기준일 지도에 없어서 계산에서 뺀 종목.
  excludedStocks: ExcludedStock[]
}

// 동그라미 안에 빼기가 있는 아이콘 — "제외"를 뜻한다.
function MinusCircleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.3" />
      <path d="M5 8h6" />
    </svg>
  )
}

// 기간 등락률을 볼 때 날짜 칩 옆에 따로 붙는 ⊖ 아이콘 버튼(제외 종목). 기간(시작일 ~ 종료일)은 날짜 칩 하나가 맡는다.
// 시작일의 기준가(= 그 전 거래일 종가)와 종료일의 종가/현재가 설명은 상단이 길어지지 않게 종목 팝업에서 보여 주고,
// 거래일 수는 달력 맨 위 가운데에 보인다. 빼기 원 아이콘(제외 종목 버튼)을 누르면 제외 종목 이름 목록이 그 버튼 왼쪽에 맞춰 팝업으로 뜬다.
// 기간을 보는 동안에는 제외 종목이 없어도 칩을 항상 보여 준다. 없으면 팝업에 "제외된 종목이 없습니다."라고 적는다.
export default function RangeExcludedStocks({ excludedStocks }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      // MOBILE에서는 팝업이 document.body로 옮겨지므로 루트 밖이라도 팝업 안 클릭은 닫지 않는다.
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const isPopupOpen = isOpen
  const hasExcluded = excludedStocks.length > 0

  return (
    // 글자와 인라인 버튼이 한 줄에 섞이면 줄 높이가 늘어나 글자가 아래로 밀리므로, flex로 두어 서로 가운데 높이를 맞춘다.
    <span ref={rootRef} className="flex items-center gap-2">
      {(
        // 팝업은 이 버튼을 기준으로 놓아서, 팝업의 왼쪽 끝이 버튼의 왼쪽 끝과 맞는다.
        <span className="relative flex items-center font-normal text-ui-muted">
          {/* 핀처럼 아이콘만 둔다(2026-11-27 사용자 지시, 예전 "⊖ 제외 종목" 글자 삭제). 개수와 설명은 팝업에 있다. 크기는 핀 아이콘과 같은 20px. */}
          <button
            type="button"
            aria-label="제외 종목"
            aria-haspopup="dialog"
            aria-expanded={isPopupOpen}
            onClick={() => setIsOpen(open => !open)}
            className="toolbar-badge-control flex h-6 items-center border-0 bg-transparent px-1.5 text-inherit transition-colors hover:bg-[var(--ui-control-hover)] focus-visible:bg-[var(--ui-control-hover)]"
          >
            <MinusCircleIcon className="h-[20px] w-[20px] shrink-0" />
          </button>
          <ToolbarPopup
            open={isPopupOpen}
            triggerRef={rootRef}
            popupRef={popupRef}
            ariaLabel="제외 종목"
            className="w-60 whitespace-normal rounded-md border border-ui-border bg-[var(--ui-panel)] p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl"
          >
            {/* 툴바 팝업 머리줄 공통 양식(PopupHeader): 사방 8px, 영문 머리줄과 구분선, 글자는 왼쪽 16px에서 시작, 아래 구분선도 머리줄 구분선과 같은 길이(2026-11-27 사용자 지시). */}
            <PopupHeader>EXCLUDED</PopupHeader>
            <p className="mt-1 px-2 text-xs font-medium leading-relaxed text-ui-text">시작일 데이터가 없어 기간 등락률을 계산하지 못한 종목입니다. 대체로 신규 상장입니다.</p>
            {!hasExcluded && (
              <p className="mt-2 border-t border-ui-border px-2 pt-2 text-xs font-medium text-ui-text">제외된 종목이 없습니다.</p>
            )}
            {hasExcluded && (
              <div className="mt-2 border-t border-ui-border px-2 pt-2">
                {/* 제외된 종목 전부를 시가총액 순으로 적고, 개수는 "시가총액 순 (n)"으로 둔다. 10줄이 넘으면 스크롤한다(2026-11-27 사용자 지시, 예전 상위 10종목·10/74 [종목] 표기를 바꿈). */}
                <p className="mb-1 text-xs font-medium text-ui-text">시가총액 순 ({excludedStocks.length})</p>
                {/* 스크롤 목록은 다른 필터 팝업과 같은 드롭다운 공통 스크롤 규칙을 쓴다: 팝업 좌우 끝까지 닿고(-mx-4 = 팝업 여백 8 + 이 칸 여백 8),
                    줄 단위로 멈추며(snap), 보이는 높이는 줄 높이의 정수배(최대 10줄), 스크롤바는 오른쪽 끝에 자기 자리를 둔다(dropdown-scroll-list).
                    종목명은 "시가총액 순" 아래에 8px 들여 쓴다(2026-11-27 사용자 지시). */}
                <ul className={`dropdown-scroll-list -mx-4 m-0 list-none p-0 ${DROPDOWN_SCROLL_CLASS}`} style={{ maxHeight: `${VISIBLE_ROWS * ROW_REM}rem` }}>
                  {excludedStocks.map(stock => (
                    <li key={stock.stockCode} className={`flex h-6 items-center justify-between gap-2 pl-6 pr-4 ${DROPDOWN_SNAP_ITEM_CLASS}`}>
                      <span className="min-w-0 truncate" data-hint={stock.stockName}>{stock.stockName}</span>
                      {/* 종목코드는 숫자와 영문이 섞여 있어(예: 0035S0) 글자 폭이 같은 고정폭 글꼴로 써야 코드마다 너비가 같다. */}
                      <span className="shrink-0 font-mono text-xs text-ui-muted">{stock.stockCode}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ToolbarPopup>
        </span>
      )}
    </span>
  )
}
