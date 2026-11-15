import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDownIcon } from '@/components/icons/AppIcons'
import { DROPDOWN_PANEL_CLASS } from '@/components/dropdownStyle'

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
// 제목 글자는 박스 전체가 아니라 꺽쇠 자리를 뺀 왼쪽 칸의 가운데에 둔다. showChevron을 주면(시장·글 페이지를 고르는 배지) 오른쪽 끝에 아래 꺽쇠를 고정하고, 주지 않아도(PROFILE) 같은 자리를 비워 글자 위치가 모든 배지에서 같다. menu를 주면 배지를 누르면 그 아래에 시장 목록이 열린다.
export default function ToolbarModeText({ page, label, showChevron = false, menu }: { page: string; label: string; showChevron?: boolean; menu?: ToolbarModeMenuItem[] }) {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // 목록은 배지를 다시 누르거나 목록 밖을 누르면 닫힌다.
  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [isOpen])

  const isMenu = menu !== undefined && menu.length > 0
  return (
    <div ref={rootRef} className="font-roboto-latin relative shrink-0">
      <span className="absolute -top-[5px] left-1.5 z-10 bg-ui-background px-1 text-[9px] leading-none font-bold tracking-[0.12em] text-[var(--brand)]">{page}</span>
      <div
        role={isMenu ? 'button' : undefined}
        tabIndex={isMenu ? 0 : undefined}
        aria-haspopup={isMenu ? 'menu' : undefined}
        aria-expanded={isMenu ? isOpen : undefined}
        onClick={isMenu ? () => setIsOpen(open => !open) : undefined}
        onKeyDown={isMenu ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsOpen(open => !open) } } : undefined}
        className={`toolbar-badge toolbar-mode-badge flex h-6 w-[110px] items-center justify-start border border-[var(--brand)]/50 bg-[var(--brand-surface)] pl-0 pr-1 text-[15px] leading-none font-bold whitespace-nowrap tabular-nums text-ui-white ${isMenu ? 'cursor-pointer' : ''}`}
      >
        <span className="min-w-0 flex-1 justify-center text-center tracking-[0.04em]">{label}</span>
        {showChevron ? <ChevronDownIcon className="ml-auto h-3 w-3 shrink-0" aria-hidden /> : <span aria-hidden className="ml-auto h-3 w-3 shrink-0" />}
      </div>
      {isMenu && isOpen && (
        <div role="listbox" aria-label="시장 목록" className={`absolute left-0 z-50 mt-1.5 w-[110px] overflow-hidden text-sm font-normal tracking-normal ${DROPDOWN_PANEL_CLASS}`}>
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
      )}
    </div>
  )
}
