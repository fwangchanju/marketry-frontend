import { MARKET_SESSIONS } from '@/markets/marketSessions'
import type { SnapshotMarket } from '@/utils/markets'
import { useEffect, useRef, useState } from 'react'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarPopup from '@/components/ToolbarPopup'
import PopupHeader from '@/components/PopupHeader'

// 증시 세션 칩 — 눌러서 시간표를 안내한다. 세션 이름·시간표·색은 시장 정의(marketSessions)에서 받는다.
// 원과 글자 사이 여백: 배지는 4px, 팝업은 글자가 커서 8px로 넓힌다(2026-11-27 사용자 제보).
const SessionDot = ({ color, gapClass = 'mr-1' }: { color: string; gapClass?: string }) => <span aria-hidden="true" className={`${gapClass} inline-block h-2 w-2 rounded-full`} style={{ backgroundColor: color }} />


// 가운데 설명(일본 "한자 한글읽기" 예: 前場 젠바, 미국 영문 약어 예: PRE)에서 앞 칸 폭을 맞춰, 뒤의 한글 읽기가 모든 행에서 같은 자리에서 시작하게 한다.
function SessionTerm({ term }: { term: string }) {
  const [kanji, ...reading] = term.split(' ')
  return (
    <span className="ml-1.5 inline-block w-[8em] text-xs text-ui-muted">
      {reading.length > 0
        ? <><span className="inline-block w-[3.5em]">{kanji}</span>{reading.join(' ')}</>
        : kanji}
    </span>
  )
}

export default function MarketSessionChip({ market, session }: { market: SnapshotMarket; session: string }) {
  const { label, guide, dotColors } = MARKET_SESSIONS[market]
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setIsOpen(false) }
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false) }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])
  return (
    <span ref={rootRef} className="relative z-40 flex shrink-0">
      <ToolbarChip bare>
        <button type="button" aria-label={label} aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen(open => !open)} className={`toolbar-badge-control flex h-6 items-center border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[var(--ui-control)] focus-visible:bg-[var(--ui-control)] ${isOpen ? 'bg-[var(--ui-control)]' : 'bg-transparent'}`}>
          <span className={`${FONT_BAR_TIME} flex items-center text-ui-white`}><SessionDot color={dotColors[session]} /><span>{session}</span></span>
        </button>
      </ToolbarChip>
      {isOpen && (
        <ToolbarPopup open={isOpen} triggerRef={rootRef} popupRef={popupRef} ariaLabel={label} className="w-max rounded-md border border-ui-border bg-[var(--ui-panel)] p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl">
          <PopupHeader>SESSION</PopupHeader>
          {guide.map(row => (
            <div key={row.session} className="flex items-center justify-between gap-4 px-2 py-1">
              <span className="flex items-center">
                <SessionDot color={dotColors[row.session]} gapClass="mr-2" />
                <span className={row.term ? 'inline-block w-[6em]' : undefined}>{row.session}</span>
                {row.term && <SessionTerm term={row.term} />}
              </span>
              <span className="w-[11ch] shrink-0 text-center font-normal tabular-nums">{row.range}</span>
            </div>
          ))}
        </ToolbarPopup>
      )}
    </span>
  )
}
