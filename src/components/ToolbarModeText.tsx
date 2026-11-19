import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDownIcon } from '@/components/icons/AppIcons'
import { DROPDOWN_PANEL_CLASS } from '@/components/dropdownStyle'
import MarketFlagIcon from '@/components/MarketFlagIcon'
import type { MarketFlag } from '@/utils/marketFlag'

export interface ToolbarModeMenuItem {
  label: string
  to: string
  active: boolean
  // 아래 단계 항목(들여쓰기 + ▸)
  indent?: boolean
  // 특별 회원 전용 항목(보라 글자)
  special?: boolean
}

// 툴바 맨 왼쪽에 지금 보는 화면을 페이지 제목처럼 보여 준다 — 서브 청록색 박스 안에 큰 제목(NIKKEI·K-STOCK·STATS 등)을 둔다.
// 박스 너비는 110px로 고정해서 어느 페이지든 같다(2026-11-15 105px에서 5px 키움).
// 제목 글자는 박스 전체가 아니라 꺽쇠 자리를 뺀 왼쪽 칸의 가운데에 둔다. showChevron을 주면(시장·글 페이지를 고르는 배지) 오른쪽 끝에 아래 꺽쇠를 고정하고, 주지 않아도(PROFILE) 같은 자리를 비워 글자 위치가 모든 배지에서 같다. menu를 주면 배지에 마우스를 올리면 그 아래에 시장 목록이 열리고, 마우스가 배지·목록 밖으로 나가면 잠시 뒤 닫힌다(2026-11-18, 클릭으로 열던 방식을 바꿨다). 마우스가 없는 터치 화면은 누르면 열고, 키보드는 Enter·Space로 열고 Esc로 닫는다.
export default function ToolbarModeText({ page, label, showChevron = false, menu, flag, flagClassName }: { page: string; label: string; showChevron?: boolean; menu?: ToolbarModeMenuItem[]; flag?: MarketFlag; flagClassName?: string }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  // 마우스가 배지와 목록 사이를 지나거나 살짝 벗어나도 바로 닫히지 않게 잠시 기다린다.
  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])
  const closeLater = useCallback(() => {
    cancelClose()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      setIsOpen(false)
    }, 150)
  }, [cancelClose])
  useEffect(() => cancelClose, [cancelClose])

  // 터치·펜은 마우스 올림이 없으므로 누르면 열고, 목록 밖을 누르면 닫는다. 키보드 포커스가 목록 밖으로 나가도 닫는다.
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

  const handlePointerEnter = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return
    cancelClose()
    setIsOpen(true)
  }
  const handlePointerLeave = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'mouse') return
    closeLater()
  }

  const isMenu = menu !== undefined && menu.length > 0
  return (
    <>
    <div
      ref={rootRef}
      className="font-roboto-latin relative shrink-0"
      onPointerEnter={isMenu ? handlePointerEnter : undefined}
      onPointerLeave={isMenu ? handlePointerLeave : undefined}
      onBlur={isMenu ? event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false) } : undefined}
    >
      <span className="absolute -top-[5px] left-1.5 z-10 bg-ui-background px-1 text-[9px] leading-none font-bold tracking-[0.12em] text-[var(--brand)]">{page}</span>
      <div
        role={isMenu ? 'button' : undefined}
        tabIndex={isMenu ? 0 : undefined}
        aria-haspopup={isMenu ? 'menu' : undefined}
        aria-expanded={isMenu ? isOpen : undefined}
        // 마우스는 올리면 열리므로 누르기로 닫지 않는다. 터치·펜(마우스 올림이 없는 입력)만 누르면 열고 닫는다.
        onClick={isMenu ? event => { if ((event.nativeEvent as PointerEvent).pointerType !== 'mouse') setIsOpen(open => !open) } : undefined}
        onKeyDown={isMenu ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsOpen(open => !open) } } : undefined}
        className={`toolbar-badge toolbar-mode-badge flex h-6 w-[110px] items-center justify-start border border-[var(--brand)]/50 bg-[var(--brand-surface)] pl-0 pr-1 text-[15px] leading-none font-bold whitespace-nowrap tabular-nums text-ui-white ${isMenu ? 'cursor-pointer' : ''}`}
      >
        <span className="min-w-0 flex-1 justify-center text-center tracking-[0.04em]">{label}</span>
        {showChevron ? <ChevronDownIcon className="ml-auto h-3 w-3 shrink-0" aria-hidden /> : <span aria-hidden className="ml-auto h-3 w-3 shrink-0" />}
      </div>
      {isMenu && isOpen && (
        // 배지와 목록 사이 6px는 비워 두지 않고 이 칸의 위쪽 여백으로 채운다 — 마우스가 틈을 지나도 배지·목록 밖으로 나간 것으로 보지 않는다.
        <div className="absolute left-0 top-full z-50 w-[110px] pt-1.5">
        <div role="listbox" aria-label="시장 목록" className={`w-[110px] overflow-hidden text-sm font-normal tracking-normal ${DROPDOWN_PANEL_CLASS}`}>
          {menu.map(item => (
            <button
              key={item.to}
              type="button"
              role="option"
              aria-selected={item.active}
              onClick={() => { setIsOpen(false); if (!item.active) navigate(item.to) }}
              className={`font-roboto-latin flex h-[30px] w-full items-center whitespace-nowrap rounded-none border-0 pl-[9px] pr-3 text-left text-sm font-medium transition-colors ${item.active ? 'bg-[var(--brand-surface)] text-ui-white' : `bg-transparent hover:bg-ui-white/10 ${item.special ? 'text-[var(--sub-purple)]' : 'text-ui-white'}`}`}
            >
              {/* 하위 단계(KOSPI·KOSDAQ)는 윗줄 KOREA에 맞춘다: ▸는 KO 가운데, 글자는 R 시작 위치. 숨긴 KO로 폭을 잡아 글꼴이 달라도 맞는다. */}
              {item.indent && (
                <span aria-hidden="true" className="relative inline-block">
                  <span className="invisible">KO</span>
                  <span className="absolute inset-0 text-center">▸</span>
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
        </div>
      )}
    </div>
    {/* 국기는 시장 배지 바로 오른쪽에 둔다. 마우스 올림 영역(목록 열기)에는 넣지 않는다. 배지와의 간격은 부모 줄의 gap(4px)이고, gap이 더 큰 줄은 flagClassName으로 4px에 맞춘다. */}
    {flag && <MarketFlagIcon flag={flag} className={flagClassName} />}
    </>
  )
}
