import { useEffect, useRef, useState } from 'react'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import ToolbarChip from '@/components/ToolbarChip'
import { accentColor } from '@/utils/accentPalette'
import { USA_SESSION_GUIDE, type UsaSession } from '@/utils/usaMarketSession'

// 미국 증시 세션 칩 — 눌러서 뉴욕 증시 시간표(현지 시각)를 안내한다. 모양과 세션 이름은 한국 증시 세션 칩과 같고 시간표만 뉴욕 기준이다.
const DOT_COLOR: Record<UsaSession, string> = {
  '프리 마켓': 'var(--sub-yellow)',
  '메인 마켓': 'var(--brand)',
  '애프터 마켓': 'var(--sub-purple)',
  '마켓 종료': accentColor('연회색'),
}

const SessionDot = ({ session }: { session: UsaSession }) => <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: DOT_COLOR[session] }} />

export default function UsaSessionChip({ session }: { session: UsaSession }) {
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
        <button type="button" aria-label="미국 증시 세션 안내" aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen(open => !open)} className={`toolbar-badge-control flex h-6 items-center border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[var(--ui-control)] focus-visible:bg-[var(--ui-control)] ${isOpen ? 'bg-[var(--ui-control)]' : 'bg-transparent'}`}>
          <span className={`${FONT_BAR_TIME} flex items-center text-ui-white`}><SessionDot session={session} /><span>{session}</span></span>
        </button>
      </ToolbarChip>
      {isOpen && (
        <div role="dialog" aria-label="미국 증시 세션 안내" className="absolute left-0 top-full z-50 mt-1 w-max rounded-md border border-ui-border bg-[var(--ui-panel)] p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl">
          {USA_SESSION_GUIDE.map(row => (
            <div key={row.session} className="flex items-center justify-between gap-4 px-2 py-1">
              <span className="flex items-center">
                <SessionDot session={row.session} />
                {row.session}
              </span>
              <span className="w-[11ch] shrink-0 text-center font-normal tabular-nums">{row.range}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
