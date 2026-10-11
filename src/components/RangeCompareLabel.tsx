import { useEffect, useRef, useState } from 'react'
import { useTradingDayGap } from '@/hooks/useMarketMap'
import { toMarketMapSnapshotDateLabel } from '@/utils/format'
import type { ExcludedStock } from '@/utils/rangeChangeRate'

// 제외된 종목 팝업에 이름을 적는 최대 종목 수.
const MAX_LISTED_STOCKS = 10

interface Props {
  // 기간의 시작일·종료일 스냅샷 시각(ISO).
  startSnapshotTime: string
  endSnapshotTime: string
  // 기준일 지도에 없어서 계산에서 뺀 종목.
  excludedStocks: ExcludedStock[]
}

// 기간 등락률을 볼 때 날짜 뒤에 붙는 "~ 2026-10-02 (금) (5거래일·10종목 제외)". 앞의 시작일 날짜는 달력 아이콘 옆 글자가 맡는다.
// 시작일의 기준가(= 그 전 거래일 종가)와 종료일의 종가/현재가 설명은 상단이 길어지지 않게 종목 팝업에서 보여 준다.
// 거래일 수는 시작일을 포함해 종료일까지 센다 — 시작일 하루 전 종가가 기준이라 시작일 하루도 기간에 든다. 아직 못 받았으면 거래일은 빼고 보인다.
// 괄호 안의 구분 점은 가운뎃점(U+00B7)이다. "N종목 제외"를 누르면 제외된 종목 이름 목록이 그 버튼 왼쪽에 맞춰 팝업으로 뜬다.
export default function RangeCompareLabel({ startSnapshotTime, endSnapshotTime, excludedStocks }: Props) {
  const { data: gap } = useTradingDayGap(startSnapshotTime.slice(0, 10), endSnapshotTime.slice(0, 10))
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
  const dayCount = gap !== undefined ? `${gap + 1}거래일` : null

  return (
    <span ref={rootRef}>
      ~ {toMarketMapSnapshotDateLabel(endSnapshotTime)}
      {(dayCount !== null || hasExcluded) && (
        <span className="font-normal text-gray-400">
          {' ('}
          {dayCount}
          {dayCount !== null && hasExcluded && '·'}
          {hasExcluded && (
            // 팝업은 이 버튼을 기준으로 놓아서, 팝업의 왼쪽 끝이 버튼의 왼쪽 끝과 맞는다.
            <span className="relative">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={isPopupOpen}
                onClick={() => setIsOpen(open => !open)}
                className="border-0 bg-transparent p-0 text-inherit underline decoration-dotted underline-offset-4 hover:text-white"
              >
                {excludedStocks.length}종목 제외
              </button>
              {isPopupOpen && (
                <div
                  role="dialog"
                  aria-label="제외된 종목"
                  className="absolute left-0 top-full z-50 mt-[7px] w-60 whitespace-normal rounded-md border border-gray-500 bg-[#363639] p-3 text-sm font-normal tracking-normal text-white shadow-xl"
                >
                  <p className="font-semibold">제외된 종목 ({excludedStocks.length})</p>
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
          {')'}
        </span>
      )}
    </span>
  )
}
