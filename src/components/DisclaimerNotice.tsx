import { useLayoutEffect, useRef, useState } from 'react'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

// 면책조항 — 지도·그룹 페이지 왼쪽 아래에 마침표 기준으로 두 줄(줄 높이 28px)로 보여준다.
// 한 줄이 칸보다 길면 줄임표로 자른다(마우스를 올려도 전체 문구를 띄우지 않는다).
// 둘째 줄 끝의 ? 버튼을 누르면 데이터마다 어디서 받아 오는지 말풍선으로 알려 준다.
const DISCLAIMER_LINES = [
  '본 웹사이트의 정보는 외부 시세·종목 데이터를 바탕으로 가공된 것으로, 투자 참고사항이며 오류가 발생하거나 지연될 수 있습니다.',
  '제공된 정보에 의한 투자결과에 대해 법적인 책임을 지지 않습니다.',
]

// 데이터 출처. 출처(증권사)를 제목으로 하고 그곳에서 받는 항목 이름을 아래에 줄로 적는다.
// 보는 사람이 "이 숫자가 어디서 왔나"를 알면 되므로 수집 주기·시각 같은 운영 정보와 내부 용어는 적지 않는다.
// 새 외부 데이터를 쓰기 시작하면 해당 출처 아래에 한 줄을 더한다(새 출처면 묶음을 더한다) — 말풍선은 이 목록을 그대로 그린다.
// 백엔드가 실제로 받아 오는 곳(키움 업종현재가·업종별주가·종목정보, 토스 시장 캘린더·종목 정보, NEXTRADE 종목 목록) 기준이다.
const DATA_SOURCES: { source: string; items: string[] }[] = [
  {
    source: '키움증권',
    items: [
      '시세/등락률/시가총액',
      '코스피·코스닥 지수/거래대금',
      '종목명/업종명',
      '신규 상장 종목',
      'NXT 거래 가능 종목',
    ],
  },
  {
    source: '토스증권',
    items: ['날짜/시간/거래 세션/휴장일', '거래정지/상장폐지 종목'],
  },
  { source: 'NEXTRADE', items: ['NXT 거래 가능 종목 (키움증권 데이터가 없을 때만)'] },
  { source: 'MARKETRY', items: ['종목·업종 분류'] },
  { source: '사용자', items: ['내 분류'] },
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
        <svg aria-hidden="true" viewBox="0 0 16 16" className="h-[11px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="1.95" strokeLinecap="round" strokeLinejoin="round">
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
          <div><span className="inline-flex items-center rounded bg-cyan-700 px-1.5 py-[3px] text-xs leading-none font-semibold text-white">출처</span></div>
          {DATA_SOURCES.map(({ source, items }) => (
            <div key={source} className="mt-1">
              <div className="font-medium text-red-600">{source}</div>
              {items.map(item => (
                <div key={item} className="pl-3">{item}</div>
              ))}
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
