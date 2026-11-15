import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDownIcon } from '@/components/icons/AppIcons'
import { DROPDOWN_ITEM_CLASS, DROPDOWN_PANEL_CLASS } from '@/components/dropdownStyle'

export interface ToolbarModeMenuItem {
  label: string
  to: string
  active: boolean
  // 아래 단계 항목(들여쓰기 + ▸)
  indent?: boolean
  // 특별 회원 전용 항목(보라 글자)
  special?: boolean
}

// 툴바 맨 왼쪽에 지금 보는 화면을 페이지 제목처럼 보여 준다 — 서브 청록색 박스 안에 큰 제목(NIKKEI·K-STOCK·STATS 등)을 두고
// 흰 제목 글자는 박스 안에서 왼쪽 정렬한다. 글자 시작점은 윗변의 작은 페이지 이름(MAP·GRAPH·SECTOR·STOCK) 글자 시작점과 맞춘다.
// 박스 너비는 105px로 고정해서 어느 페이지든 같다.
// showChevron을 주면(시장을 고르는 배지) 오른쪽 끝에 아래 꺽쇠를 고정한다. menu를 주면 배지를 누르면 그 아래에 시장 목록이 열린다.
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
        className={`toolbar-badge toolbar-mode-badge flex h-6 w-[105px] items-center justify-start border border-[var(--brand)]/50 bg-[var(--brand-surface)] pl-[9px] pr-1 text-[15px] leading-none font-bold whitespace-nowrap tabular-nums text-ui-white ${isMenu ? 'cursor-pointer' : ''}`}
      >
        <span className="tracking-[0.04em]">{label}</span>
        {showChevron && <ChevronDownIcon className="ml-auto h-3 w-3 shrink-0" aria-hidden />}
      </div>
      {isMenu && isOpen && (
        <div role="menu" className={`absolute left-0 z-50 mt-1.5 flex w-max min-w-[105px] flex-col overflow-hidden py-1 text-sm font-normal tracking-normal ${DROPDOWN_PANEL_CLASS}`}>
          {menu.map(item => (
            <button
              key={item.to}
              type="button"
              role="menuitem"
              onClick={() => { setIsOpen(false); if (!item.active) navigate(item.to) }}
              className={`${DROPDOWN_ITEM_CLASS} flex w-full items-center whitespace-nowrap py-1.5 text-left ${item.active ? 'bg-[var(--brand-surface)] text-ui-white' : item.special ? 'text-[var(--sub-purple)]' : 'text-ui-white'}`}
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
