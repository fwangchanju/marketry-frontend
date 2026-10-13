import { useEffect, useRef, useState } from 'react'
import type { ExcludedStock } from '@/utils/rangeChangeRate'

// 제외된 종목 팝업에 이름을 적는 최대 종목 수.
const MAX_LISTED_STOCKS = 10

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

// 기간 등락률을 볼 때 날짜 칩 옆에 따로 붙는 "⊖ 제외 종목" 칩 내용. 기간(시작일 ~ 종료일)은 날짜 칩 하나가 맡는다.
// 시작일의 기준가(= 그 전 거래일 종가)와 종료일의 종가/현재가 설명은 상단이 길어지지 않게 종목 팝업에서 보여 주고,
// 거래일 수는 달력 맨 위 가운데에 보인다. 빼기 원 아이콘(제외 종목 버튼)을 누르면 제외 종목 이름 목록이 그 버튼 왼쪽에 맞춰 팝업으로 뜬다.
// 제외된 종목이 없으면 아무것도 그리지 않으므로, 칩은 이 안이 아니라 호출하는 쪽에서 종목이 있을 때만 만든다.
export default function RangeExcludedStocks({ excludedStocks }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
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

  // 제외된 종목이 없으면(기간을 바꾼 경우) 열려 있던 팝업도 보이지 않는다.
  const hasExcluded = excludedStocks.length > 0
  const isPopupOpen = isOpen && hasExcluded

  return (
    // 글자와 인라인 버튼이 한 줄에 섞이면 줄 높이가 늘어나 글자가 아래로 밀리므로, flex로 두어 서로 가운데 높이를 맞춘다.
    <span ref={rootRef} className="flex items-center gap-2">
      {hasExcluded && (
        // 팝업은 이 버튼을 기준으로 놓아서, 팝업의 왼쪽 끝이 버튼의 왼쪽 끝과 맞는다.
        <span className="relative flex items-center font-normal text-gray-400">
          {/* 아이콘과 "제외 종목" 글자가 한 버튼이라 칩 어디를 눌러도 팝업이 열린다(개수는 팝업 제목에 있다). */}
          <button
            type="button"
            aria-label="제외 종목"
            aria-haspopup="dialog"
            aria-expanded={isPopupOpen}
            onClick={() => setIsOpen(open => !open)}
            className="flex h-6 items-center gap-1 border-0 bg-transparent px-1.5 text-inherit transition-colors hover:bg-[#505050] focus-visible:bg-[#505050]"
          >
            <MinusCircleIcon className="h-[15px] w-[15px] shrink-0" />
            <span>제외 종목</span>
          </button>
          {isPopupOpen && (
                <div
                  role="dialog"
                  aria-label="제외 종목"
                  className="absolute left-0 top-full z-50 mt-[7px] w-60 whitespace-normal rounded-md border border-gray-500 bg-[#363639] p-3 text-sm font-normal tracking-normal text-white shadow-xl"
                >
                  <p className="font-semibold">제외 종목 ({excludedStocks.length})</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-400">시작일 데이터가 없어 기간 등락률을 계산하지 못한 종목입니다. 대체로 신규 상장입니다.</p>
                  <div className="mt-2 border-t border-gray-500 pt-2">
                    {/* 목록은 시가총액이 큰 10종목까지만 적는다. 10종목이 넘으면 제목에 "10 종목"이라고 밝힌다. */}
                    <p className="mb-1 text-xs text-gray-500">{excludedStocks.length > MAX_LISTED_STOCKS ? `시가총액 순 ${MAX_LISTED_STOCKS} 종목` : '시가총액 순'}</p>
                    <ul className="space-y-1">
                      {excludedStocks.slice(0, MAX_LISTED_STOCKS).map(stock => (
                        <li key={stock.stockCode} className="flex items-center justify-between gap-2">
                          <span className="min-w-0 truncate" title={stock.stockName}>{stock.stockName}</span>
                          {/* 종목코드는 숫자와 영문이 섞여 있어(예: 0035S0) 글자 폭이 같은 고정폭 글꼴로 써야 코드마다 너비가 같다. */}
                          <span className="shrink-0 font-mono text-xs text-gray-400">{stock.stockCode}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
        </span>
      )}
    </span>
  )
}
