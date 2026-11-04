import { useEffect, useRef, useState } from 'react'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import ToolbarChip from '@/components/ToolbarChip'
import { accentColor } from '@/utils/accentPalette'
import { JAPAN_SESSION_GUIDE, type JapanSession } from '@/utils/japanMarketSession'

// 일본 증시 세션 칩 — 눌러서 도쿄 거래소 시간표를 안내한다. 모양은 한국 증시 세션 칩과 같지만 세션 이름과 시간표는 따로 둔다.
const DOT_COLOR: Record<JapanSession, string> = {
  '오전 장': 'var(--brand)',
  '점심 휴장': accentColor('연회색'),
  '오후 장': 'var(--brand)',
  '장 마감': accentColor('연회색'),
}

const SessionDot = ({ session }: { session: JapanSession }) => <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DOT_COLOR[session] }} />

export default function JapanSessionChip({ session }: { session: JapanSession }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false) }
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
        <button type="button" aria-label="일본 증시 세션 안내" aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen(open => !open)} className={`toolbar-badge-control flex h-6 items-center border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[var(--ui-control)] focus-visible:bg-[var(--ui-control)] ${isOpen ? 'bg-[var(--ui-control)]' : 'bg-transparent'}`}>
          <span className={`${FONT_BAR_TIME} flex items-center text-ui-white`}><SessionDot session={session} /><span>{session}</span></span>
        </button>
      </ToolbarChip>
      {isOpen && (
        <div role="dialog" aria-label="일본 증시 세션 안내" className="absolute left-0 top-full z-50 mt-1 w-max rounded-md border border-ui-border bg-[var(--ui-panel)] p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl">
          {JAPAN_SESSION_GUIDE.map(row => (
            <div key={row.session} className="flex items-center justify-between gap-4 px-2 py-1">
              <span className="flex items-center">
                <SessionDot session={row.session} />
                {row.session}
                <span className="ml-1.5 text-xs text-ui-muted">{row.term}</span>
              </span>
              <span className="w-[11ch] shrink-0 text-center font-normal tabular-nums">{row.range}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
