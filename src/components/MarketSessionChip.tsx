import { MARKET_SESSIONS } from '@/markets/marketSessions'
import type { OverseasMarket } from '@/utils/markets'
import { useEffect, useRef, useState } from 'react'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarPopup from '@/components/ToolbarPopup'

// 증시 세션 칩 — 눌러서 시간표를 안내한다. 세션 이름·시간표·색은 시장 정의(marketSessions)에서 받는다.
const SessionDot = ({ color }: { color: string }) => <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />

export default function MarketSessionChip({ market, session }: { market: OverseasMarket; session: string }) {
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
          {guide.map(row => (
            <div key={row.session} className="flex items-center justify-between gap-4 px-2 py-1">
              <span className="flex items-center">
                <SessionDot color={dotColors[row.session]} />
                {row.session}
                {row.term && <span className="ml-1.5 text-xs text-ui-muted">{row.term}</span>}
              </span>
              <span className="w-[11ch] shrink-0 text-center font-normal tabular-nums">{row.range}</span>
            </div>
          ))}
        </ToolbarPopup>
      )}
    </span>
  )
}
