import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ChangeRateChoice } from '@/api/marketMap'
import { accentColor } from '@/utils/accentPalette'
import { LONGEST_TRADING_SESSION, type TradingSession } from '@/utils/tradingWindow'
import { useTradingSession } from '@/hooks/useTradingSession'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

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
    <span className={`${FONT_BAR_TIME} flex items-center text-gray-400`}>
      <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[session] }} />
      {/* 가장 긴 이름으로 너비를 유지해 시간대가 바뀌어도 옆 항목이 움직이지 않게 한다. */}
      <span className="grid">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1">{LONGEST_TRADING_SESSION}</span>
        <span className="col-start-1 row-start-1">{session}</span>
      </span>
    </span>
  )
}

// 등락률 기준 토글 — 종가(그날 정규장 종가 지도) / 누적(전일 종가 대비) / 별도(당일 종가 대비). 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지만 보인다.
// 시간외 스냅샷이 아직 없으면 별도는 잠긴다. 시장 시간대 말머리는 버튼의 표시 여부와 무관하게 유지한다.
// 버튼을 누르면 그 버튼 아래에 설명 팝업이 뜬다(새로고침 버튼의 설명창과 같은 모양). 잠긴 별도도 눌러서 설명을 볼 수 있다.
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
  const [popup, setPopup] = useState<{ text: ReactNode; anchor: DOMRect } | null>(null)
  const popupRef = useRef<HTMLSpanElement>(null)
  // 버튼 아래(4px)에 붙이고, 화면 밖으로 나가면 안쪽으로 밀거나 위로 뒤집는다 — 새로고침 버튼의 설명창과 같은 배치.
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

  // 팝업 바깥을 누르거나 Esc를 누르거나 4초가 지나면 닫는다.
  useEffect(() => {
    if (!popup) return
    const close = () => setPopup(null)
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-basis-toggle]')) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const timer = window.setTimeout(close, 4000)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    return () => {
      window.clearTimeout(timer)
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
    <div className="-mr-[5px] flex shrink-0 items-center gap-2 whitespace-nowrap" data-basis-toggle>
      {/* 종가 지도는 정규장이 끝난 시점의 지도라서, 지금이 애프터 마켓이어도 시간대 글자는 "마켓 종료"로 둔다. 시각으로 계산하지 않아 개장·마감이 달라지는 날에도 맞다. */}
      <TradingSessionIndicator session={basis === 'close' ? '마켓 종료' : undefined} />
      {visible && <div
        role="radiogroup"
        aria-label="등락률 기준"
        className="relative inline-flex h-6 w-[120px] shrink-0 items-center overflow-visible rounded-full bg-zinc-800 p-0.5"
      >
        {highlight && (
          <span
            aria-hidden="true"
            className="absolute bottom-0.5 top-0.5 rounded-full transition-[left,width] duration-[500ms] ease-out"
            style={{
              left: highlight.left,
              width: highlight.width,
              backgroundColor: SESSION_DOT_COLOR['애프터 마켓'],
            }}
          />
        )}
        {options.map((option, index) => (
          // disabled를 쓰지 않는다 — 비활성 버튼은 클릭 이벤트가 없어서 잠긴 별도의 설명을 볼 수 없다. 잠긴 동안은 값만 안 바꾼다.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={basis === option.value}
            aria-disabled={option.locked}
            ref={element => {
              buttonRefs.current[index] = element
            }}
            onClick={event => {
              if (!option.locked && basis !== option.value) onChange(option.value)
              setPopup({ text: option.help, anchor: event.currentTarget.getBoundingClientRect() })
            }}
            // 안 선택 글자는 옆 거래 세션 글자(text-gray-400)와 같은 회색이다. 잠긴 별도는 흐리게 해서 잠긴 것을 알아보게 한다.
            className={`relative z-10 h-5 min-w-0 flex-1 rounded-full border-0 bg-transparent px-0 text-[13px] font-semibold leading-none transition-colors duration-[500ms] ${
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
