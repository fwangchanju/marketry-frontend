import { useLayoutEffect, useRef, useState } from 'react'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

// 면책조항 — 지도·그룹 페이지 왼쪽 아래에 마침표 기준으로 두 줄(줄 높이 28px)로 보여준다.
// 한 줄이 칸보다 길면 줄임표로 자른다(마우스를 올려도 전체 문구를 띄우지 않는다).
// 둘째 줄 끝의 ? 버튼을 누르면 데이터마다 어디서 받아 오는지 말풍선으로 알려 준다.
const DISCLAIMER_LINES = [
  '본 웹사이트의 정보는 외부 시세·종목 데이터를 바탕으로 가공된 것으로, 투자 참고사항이며 오류가 발생하거나 지연될 수 있습니다.',
  '제공된 정보에 의한 투자결과에 대해 법적인 책임을 지지 않습니다.',
]

// 데이터별 출처. 새 외부 데이터를 쓰기 시작하면 여기에 한 줄을 더한다 — 말풍선은 이 목록을 그대로 그린다.
const DATA_SOURCES: { data: string; source: string }[] = [
  { data: '시세/등락률/종목 정보/시가총액/업종명', source: '키움증권' },
  { data: '날짜/시간/거래 세션', source: '토스증권' },
  { data: '거래정지 종목(안내·지도 제외)', source: '토스증권' },
  { data: '상장폐지 종목(지도 제외)', source: '토스증권' },
  { data: '신규 상장 종목(안내)', source: '키움증권(종목 정보를 처음 받은 날 기준)' },
  { data: 'NXT 거래 가능 종목', source: '키움증권, NEXTRADE' },
  { data: 'MARKETRY 분류', source: 'MARKETRY' },
  { data: '내 분류', source: '사용자가 직접 분류' },
]

// 말풍선이 화면 가장자리에서 띄우는 최소 간격.
const BUBBLE_MARGIN = 6

function SourceHelpBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: BUBBLE_MARGIN, top: BUBBLE_MARGIN })

  // 이 글은 화면 맨 아래에 있어서 아이콘 위로 띄우고, 화면 왼쪽·오른쪽 밖으로 나가지 않게 가둔다.
  useLayoutEffect(() => {
    if (!isOpen) return
    const update = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const bubble = bubbleRef.current?.getBoundingClientRect()
      if (!anchor || !bubble) return
      const left = Math.max(BUBBLE_MARGIN, Math.min(anchor.left, window.innerWidth - bubble.width - BUBBLE_MARGIN))
      const above = anchor.top - bubble.height - 4
      const top = above >= BUBBLE_MARGIN ? above : anchor.bottom + 4
      setPosition({ left, top })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [isOpen])

  return (
    <span className="relative ml-1 inline-flex shrink-0 align-top">
      <button
        ref={buttonRef}
        type="button"
        aria-label="데이터 출처 설명"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(open => !open)}
        onBlur={() => setIsOpen(false)}
        className="inline-flex h-3 w-3 items-center justify-center border-0 bg-transparent p-0 text-white/70 hover:text-[var(--brand)] focus-visible:text-[var(--brand)] focus-visible:outline focus-visible:outline-1"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="6.35" />
          <path d="M6.25 6.05a1.85 1.85 0 1 1 3.55.78c-.48.86-1.8 1.06-1.8 2.52" />
          <circle cx="8" cy="11.75" r="0.55" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={bubbleRef}
          role="tooltip"
          style={{ position: 'fixed', left: position.left, top: position.top }}
          className={`z-50 w-max whitespace-pre ${HINT_BUBBLE_CLASS}`}
        >
          <b>데이터 출처</b>
          {DATA_SOURCES.map(({ data, source }) => (
            <div key={data} className="mt-1">
              <div className="font-bold text-red-600">{data}</div>
              <div className="pl-3">{source}</div>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

export default function DisclaimerNotice() {
  return (
    // 글자는 10px, 줄 간격은 12px이라 두 줄이 24px다 — 아래 줄의 등락률 바(24px)와 같은 높이로 맞춘다.
    <p className="min-w-0 text-left text-[10px] font-bold text-white/70">
      <span className="min-w-0 leading-[12px]">
        {DISCLAIMER_LINES.map((line, index) => (
          <span key={line} className="block h-3 truncate">
            {line}
            {index === DISCLAIMER_LINES.length - 1 && <SourceHelpBubble />}
          </span>
        ))}
      </span>
    </p>
  )
}
