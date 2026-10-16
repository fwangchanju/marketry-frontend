import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FONT_NAV_TAB } from '@/components/FontStyle'
import { MARKET_OPTIONS } from '@/utils/marketOptions'
import { marketRoute } from '@/utils/marketRoute'
import { useSession } from '@/hooks/useSession'

interface MenuOption {
  label: string
  to: string
}

interface MenuLink {
  to: string
  label: string
  // 커서를 올리면 아래로 펼쳐지는 목록 — 없으면 그냥 이동만 하는 메뉴(Home).
  options?: MenuOption[]
}

// Map·Group은 KOSPI / KOSDAQ / ALL STOCK, Custom은 SECTOR / STOCK을 고른다(예전 화면 왼쪽 위 드롭다운과 같은 목록·순서).
const BASE_LINKS: MenuLink[] = [
  { to: '/home', label: 'Home' },
  { to: '/map/allstock', label: 'Map', options: MARKET_OPTIONS.map(option => ({ label: option.label, to: marketRoute('/map', option.market) })) },
  { to: '/group/allstock', label: 'Group', options: MARKET_OPTIONS.map(option => ({ label: option.label, to: marketRoute('/group', option.market) })) },
]
// 비로그인에게도 열려 있다 — 마켓트리·거래소 시트는 읽고, 내 분류는 비어 있으며 수정하려 할 때 로그인 팝업이 뜬다.
const CUSTOM_LINK: MenuLink = {
  to: '/custom/stock',
  label: 'Custom',
  options: [
    { label: 'SECTOR', to: '/custom/sector' },
    { label: 'STOCK', to: '/custom/stock' },
  ],
}

// 관리자 계정에만 보인다 — MARKETRY 맵 업데이트·롤백처럼 모두에게 영향을 주는 작업은 이 페이지에서 한다.
const ADMIN_LINK: MenuLink = { to: '/admin', label: 'Admin' }

// 목록이 닫히기 전에 커서가 메뉴 글자에서 목록으로 건너갈 시간(ms).
const CLOSE_DELAY_MS = 120

interface Props {
  // 페이지별 옵션 버튼 — 재사용되지 않는 페이지 전용 UI라 각 페이지가 인라인으로 만들어 넘긴다.
  actions?: ReactNode
  // 지금 보는 항목을 목록에서 다시 고르면 이동 대신 이걸 부른다(지도: 드릴다운 맨 위로). 안 넘기면 아무 일도 하지 않는다.
  onReselectCurrent?: () => void
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function NavSubBar({ actions, onReselectCurrent }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { data: session } = useSession()
  const links = [...BASE_LINKS, CUSTOM_LINK, ...(session?.authenticated && session.role === 'ADMIN' ? [ADMIN_LINK] : [])]
  const [openTo, setOpenTo] = useState<string | null>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  // 터치로 누르기 직전에 이 메뉴 목록이 열려 있었는지 — 터치는 누르면 마우스 이벤트가 먼저 와서 목록을 열어 버리므로 누르기 전 상태를 따로 기억한다.
  const touchStartRef = useRef<{ to: string; wasOpen: boolean } | null>(null)
  // 메뉴를 떠날 때 예약해 둔 닫기 타이머가 화면이 바뀐 뒤에 실행되지 않게 정리한다.
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])
  // 목록이 열려 있을 때 메뉴 밖을 누르면 닫는다(터치 화면은 커서를 치울 수 없어서 필요하다).
  useEffect(() => {
    if (openTo === null) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenTo(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openTo])

  const isLinkActive = (to: string) => {
    if (to === '/map/allstock') return location.pathname.startsWith('/map/')
    if (to === '/group/allstock') return location.pathname.startsWith('/group/')
    if (to === '/custom/stock') return location.pathname.startsWith('/custom')
    return location.pathname === to
  }
  // Admin 메뉴만 빨강이다(모두에게 영향을 주는 작업이 있는 관리자 전용 페이지) — 지금 보는 중일 때는 더 밝은 빨강이다.
  const linkClassName = (to: string) => {
    if (to === ADMIN_LINK.to) return `${FONT_NAV_TAB} whitespace-nowrap ${isLinkActive(to) ? 'text-[#ff6a4d]' : 'text-[#ff4d2e] hover:text-[#ff6a4d]'}`
    return `${FONT_NAV_TAB} whitespace-nowrap ${isLinkActive(to) ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'}`
  }

  const open = (to: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setOpenTo(to)
  }
  const closeSoon = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpenTo(null), CLOSE_DELAY_MS)
  }
  // 목록에서 지금 보고 있는 항목인지 — Custom은 /custom/sector와 /custom/stock 두 화면 중 하나이고, Map·Group은 주소의 시장 이름이다.
  const isCurrentOption = (option: MenuOption) => location.pathname === option.to
  const handleSelect = (option: MenuOption) => {
    setOpenTo(null)
    if (isCurrentOption(option)) onReselectCurrent?.()
    else navigate(option.to)
  }

  return (
    <div className="relative z-30 -top-[13px] flex h-8 after:absolute after:inset-x-0 after:top-full after:h-[2.5px] after:bg-zinc-900 shrink-0 items-center justify-between gap-3 bg-zinc-900 px-3 text-xs">
      <div ref={barRef} className="flex h-8 items-center gap-3">
        {links.map(link => (
          <div
            key={link.to}
            className="relative flex h-8 items-center"
            onMouseEnter={() => link.options && open(link.to)}
            onMouseLeave={() => link.options && closeSoon()}
          >
            <Link
              to={link.to}
              className={linkClassName(link.to)}
              onPointerDown={event => {
                touchStartRef.current = event.pointerType === 'touch' ? { to: link.to, wasOpen: openTo === link.to } : null
              }}
              onClick={event => {
                // 터치 화면은 목록이 닫혀 있을 때 처음 누르면 이동하지 않고 목록을 연다(다시 누르면 기본 화면으로 이동한다).
                const touch = touchStartRef.current
                touchStartRef.current = null
                if (link.options && touch?.to === link.to && !touch.wasOpen) {
                  event.preventDefault()
                  open(link.to)
                }
              }}
            >
              {link.label}
            </Link>
            {link.options && openTo === link.to && (
              <div className="absolute left-0 top-full z-50 w-32 rounded-lg bg-[var(--panel-gray)] p-[3px] shadow-lg shadow-black/60">
                <div role="listbox" aria-label={`${link.label} 목록`}>
                  {link.options.map(option => {
                    const isCurrent = isCurrentOption(option)
                    return (
                      <button
                        key={option.to}
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        onClick={() => handleSelect(option)}
                        className={`font-roboto-latin block h-[30px] w-full rounded-[5px] border-0 px-2.5 text-left text-sm font-medium transition-colors ${
                          isCurrent ? 'bg-cyan-700 text-white' : 'bg-transparent text-zinc-800 hover:bg-white/50 hover:text-black'
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {actions && <div className="flex items-center">{actions}</div>}
    </div>
  )
}
