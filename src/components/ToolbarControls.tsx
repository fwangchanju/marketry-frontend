import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ChangeRateChoice } from '@/api/treemap'
import { accentColor } from '@/utils/accentPalette'
import { type TradingSession } from '@/utils/tradingWindow'
import { useTradingSession } from '@/hooks/useTradingSession'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'
import ToolbarChip from '@/components/ToolbarChip'

// 시간대 말머리 앞 점의 색 — 설정창 4-1) 강조 색상 기준으로 프리 마켓은 연노랑,
// 메인 마켓은 형광, 애프터 마켓은 연보라, 마켓 종료은 연회색이다.
const SESSION_DOT_COLOR: Record<TradingSession, string> = {
  '프리 마켓': accentColor('연노랑'),
  '메인 마켓': accentColor('형광'),
  '애프터 마켓': accentColor('연보라'),
  '마켓 종료': accentColor('연회색'),
}

// 지도·그룹 페이지가 같은 시간대 문구와 강조 색상을 사용한다.
// session을 주면 지금 시간대 대신 그 시간대를 보여준다(종가 지도를 보는 동안은 "마켓 종료").
export function TradingSessionIndicator({ session: sessionOverride }: { session?: TradingSession }) {
  const currentSession = useTradingSession()
  const session = sessionOverride ?? currentSession
  return (
    <span className={`${FONT_BAR_TIME} flex items-center text-white`}>
      <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[session] }} />
      {/* 칩 폭은 지금 시간대 이름에 맞춘다 — 애프터 마켓일 때만 그만큼 넓어진다. */}
      <span>{session}</span>
    </span>
  )
}

// 시간대 안내 팝업의 고정 내용 — 서버 시간표나 지금 시간대와 연동하지 않는 안내문이다(칩의 시간대 판정과는 별개).
const SESSION_GUIDE: { session: TradingSession; range: string }[] = [
  { session: '프리 마켓', range: '08:00 ~ 08:50' },
  { session: '메인 마켓', range: '09:00 ~ 15:30' },
  { session: '애프터 마켓', range: '15:40 ~ 20:00' },
  { session: '마켓 종료', range: '그 외' },
]

// 시장 시간대 칩 — 눌러서 시간대별 시간 범위를 안내하는 팝업을 칩 아래에 연다(달력 팝업과 같은 색·테두리).
// 바깥을 누르거나 Esc를 누르면 닫힌다.
function TradingSessionChip({ session: sessionOverride }: { session?: TradingSession }) {
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

  return (
    <span ref={rootRef} className="relative z-40 flex">
      <ToolbarChip bare>
        <button
          type="button"
          aria-label="시장 시간대 안내"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(open => !open)}
          className={`flex h-6 items-center border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[#838385] focus-visible:bg-[#838385] ${isOpen ? 'bg-[#838385]' : 'bg-transparent'}`}
        >
          <TradingSessionIndicator session={sessionOverride} />
        </button>
      </ToolbarChip>
      {isOpen && (
        <div
          role="dialog"
          aria-label="시장 시간대 안내"
          className="absolute left-0 top-full z-50 mt-[7px] w-max rounded-md border border-gray-500 bg-[#363639] p-2 text-sm font-normal tracking-normal text-white shadow-xl"
        >
          <p className="mb-1.5 px-1 text-[13px] text-gray-400">시장 시간대 (한국 시간)</p>
          {SESSION_GUIDE.map(row => (
            <div key={row.session} className="flex items-center justify-between gap-6 px-2 py-1">
              <span className="flex items-center">
                <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[row.session] }} />
                {row.session}
              </span>
              {/* 시작·끝 시각을 각각 같은 폭의 칸(5글자)에 두고 굵기도 바꾸지 않아서, 줄마다 시작점과 끝점이 세로로 맞는다. */}
              {row.range.includes(' ~ ') ? (
                <span className="flex items-center gap-1 font-normal tabular-nums">
                  <span className="w-[5ch] text-right">{row.range.split(' ~ ')[0]}</span>
                  <span aria-hidden="true">~</span>
                  <span className="w-[5ch] text-right">{row.range.split(' ~ ')[1]}</span>
                </span>
              ) : (
                <span className="font-normal">{row.range}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

// 등락률 기준 토글 — 종가(그날 정규장 종가 지도) / 누적(전일 종가 대비) / 별도(당일 종가 대비). 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지만 보인다.
// 시간외 스냅샷이 아직 없으면 별도는 잠긴다. 시장 시간대 말머리는 버튼의 표시 여부와 무관하게 유지한다.
// 버튼에 커서를 올리면 그 버튼 아래에 설명 팝업이 뜬다(공용 툴팁과 같은 모양). 잠긴 별도도 올려서 설명을 볼 수 있다.
export function ChangeRateModeToggle({ basis, visible, selectable, onChange }: {
  basis: ChangeRateChoice
  visible: boolean
  selectable: boolean
  onChange: (basis: ChangeRateChoice) => void
}) {
  const red = (text: string) => <span className="text-red-600">{text}</span>
  const options = [
    {
      value: 'close' as const,
      label: '종가',
      help: (
        <>
          <b>메인 마켓 종가</b>
          <br />
          ({red('전일 종가')} 대비 {red('당일 종가')})
        </>
      ),
      locked: false,
    },
    {
      value: 'daily' as const,
      label: '누적',
      help: (
        <>
          <b>애프터 마켓 누적</b>
          <br />
          ({red('전일 종가')} 대비 {red('현재가')})
        </>
      ),
      locked: false,
    },
    {
      value: 'afterHours' as const,
      label: '별도',
      help: (
        <>
          <b>애프터 마켓 별도</b>
          <br />
          ({red('당일 종가')} 대비 {red('현재가')})
        </>
      ),
      locked: !selectable,
    },
  ]
  const [popup, setPopup] = useState<{ text: ReactNode; anchor: DOMRect; touch: boolean } | null>(null)
  const popupRef = useRef<HTMLSpanElement>(null)
  // 버튼 아래(4px)에 붙이고, 화면 밖으로 나가면 안쪽으로 밀거나 위로 뒤집는다 — 공용 툴팁과 같은 배치.
  // 크기를 잰 뒤 DOM 위치만 직접 고쳐서(상태를 다시 설정하지 않는다) 한 번에 자리를 잡는다.
  useLayoutEffect(() => {
    const element = popupRef.current
    if (!popup || !element) return
    const tooltip = element.getBoundingClientRect()
    const margin = 8
    const left = Math.max(margin, Math.min(popup.anchor.left, window.innerWidth - tooltip.width - margin))
    let top = popup.anchor.bottom + 4
    if (top + tooltip.height > window.innerHeight - margin) {
      const above = popup.anchor.top - tooltip.height - 4
      top = above >= margin ? above : Math.max(margin, window.innerHeight - tooltip.height - margin)
    }
    element.style.left = `${left}px`
    element.style.top = `${top}px`
  }, [popup])

  // 커서를 치우면 닫히고(터치로 연 팝업은 3초 뒤에 닫힌다), 그 밖에 바깥을 누르거나 Esc를 누르거나 창 크기가 바뀌어도 닫는다.
  useEffect(() => {
    if (!popup) return
    const close = () => setPopup(null)
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-basis-toggle]')) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const timer = popup.touch ? window.setTimeout(close, 3000) : undefined
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
    }
  }, [popup])

  // 선택 칸의 색 채움은 버튼 뒤의 알약 하나가 옆으로 미끄러져 옮긴다.
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [highlight, setHighlight] = useState<{ left: number; width: number } | null>(null)
  const selectedIndex = options.findIndex(option => option.value === basis)
  useLayoutEffect(() => {
    const button = buttonRefs.current[selectedIndex]
    if (!visible || !button) return
    setHighlight(previous =>
      previous?.left === button.offsetLeft && previous.width === button.offsetWidth
        ? previous
        : { left: button.offsetLeft, width: button.offsetWidth })
  }, [visible, selectedIndex])

  return (
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap" data-basis-toggle>
      {/* 종가 지도는 정규장이 끝난 시점의 지도라서, 지금이 애프터 마켓이어도 시간대 글자는 "마켓 종료"로 둔다. 시각으로 계산하지 않아 개장·마감이 달라지는 날에도 맞다. */}
      <TradingSessionChip session={basis === 'close' ? '마켓 종료' : undefined} />
      {visible && <div
        role="radiogroup"
        aria-label="등락률 기준"
        className="relative inline-flex h-6 w-[120px] shrink-0 items-center overflow-visible bg-zinc-800 p-0.5"
      >
        {highlight && (
          <span
            aria-hidden="true"
            className="absolute bottom-0.5 top-0.5 transition-[left,width] duration-[500ms] ease-out"
            style={{
              left: highlight.left,
              width: highlight.width,
              backgroundColor: SESSION_DOT_COLOR['애프터 마켓'],
            }}
          />
        )}
        {/* 칸 사이 구분선 — 설정창 선택 스위치와 같은 규칙으로, 선택 칸에 맞닿은 경계는 숨기고 나머지는 회색 선을 긋는다. 칸은 같은 폭이고 안쪽 여백이 2px이다. */}
        {options.slice(1).map((option, offset) => {
          const boundary = offset + 1
          if (boundary === selectedIndex || boundary === selectedIndex + 1) return null
          return (
            <span
              key={option.value}
              aria-hidden="true"
              className="pointer-events-none absolute z-10 w-px bg-gray-500"
              style={{ top: 7, bottom: 7, left: `calc(2px + (100% - 4px) * ${boundary} / ${options.length})` }}
            />
          )
        })}
        {options.map((option, index) => (
          // disabled를 쓰지 않는다 — 비활성 버튼은 마우스 이벤트가 없어서 잠긴 별도의 설명을 볼 수 없다. 잠긴 동안은 값만 안 바꾼다.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={basis === option.value}
            aria-disabled={option.locked}
            ref={element => {
              buttonRefs.current[index] = element
            }}
            onClick={() => {
              if (!option.locked && basis !== option.value) onChange(option.value)
            }}
            // 설명 팝업은 누르는 것과 상관없이 커서를 올리는 동안만 뜬다(잠긴 별도도 올리면 설명이 보인다).
            // 터치는 손을 떼면 곧바로 pointerleave가 와서 팝업이 바로 사라지므로, 터치로 연 팝업은 남겨 두고 몇 초 뒤에 닫는다.
            onPointerEnter={event => setPopup({ text: option.help, anchor: event.currentTarget.getBoundingClientRect(), touch: event.pointerType === 'touch' })}
            onPointerLeave={event => { if (event.pointerType !== 'touch') setPopup(null) }}
            // 안 선택 글자는 옆 거래 세션 글자(text-gray-400)와 같은 회색이다. 잠긴 별도는 흐리게 해서 잠긴 것을 알아보게 한다.
            className={`relative z-10 h-5 min-w-0 flex-1 border-0 bg-transparent px-0 text-[13px] font-semibold leading-none transition-colors duration-[500ms] ${
              basis === option.value
                ? 'text-gray-900'
                : option.locked
                  ? 'cursor-not-allowed text-gray-400 opacity-40'
                  : 'text-gray-400 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>}
      {visible && popup && (
        <span
          ref={popupRef}
          role="tooltip"
          data-basis-toggle
          style={{ position: 'fixed', left: popup.anchor.left, top: popup.anchor.bottom + 4 }}
          className={`z-50 w-max max-w-64 whitespace-pre-line font-normal ${HINT_BUBBLE_CLASS}`}
        >
          {popup.text}
        </span>
      )}
    </div>
  )
}
