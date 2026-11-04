import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FONT_NAV_TAB } from '@/components/FontStyle'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import { MARKET_OPTIONS } from '@/utils/marketOptions'
import { marketRoute } from '@/utils/marketRoute'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { DROPDOWN_PANEL_CLASS } from '@/components/dropdownStyle'

interface MenuOption {
  label: string
  to: string
}

interface MenuLink {
  to: string
  label: string
  // 글자 앞 아이콘 — 각 페이지 설정창 메뉴 줄의 아이콘을 그대로 쓴다.
  icon: NavIconName
  // 관리자 전용 메뉴 — 글자 색만 관리자 전용 색이다.
  admin?: boolean
  // 커서를 올리면 아래로 펼쳐지는 목록 — 없으면 그냥 이동만 하는 메뉴(Home).
  options?: MenuOption[]
}

// Map·Graph는 KOREA / KOSPI / KOSDAQ, Custom은 SECTOR / STOCK을 고른다.
const BASE_LINKS: MenuLink[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: marketRoute('/map', 'ALL_STOCK'), label: 'Map', icon: 'composition', options: MARKET_OPTIONS.map(option => ({ label: option.label, to: marketRoute('/map', option.market) })) },
  { to: marketRoute('/graph', 'ALL_STOCK'), label: 'Graph', icon: 'bar-chart', options: MARKET_OPTIONS.map(option => ({ label: option.label, to: marketRoute('/graph', option.market) })) },
]
// 비로그인에게도 열려 있다 — 마켓트리·거래소 시트는 읽고, 내 분류는 비어 있으며 수정하려 할 때 로그인 팝업이 뜬다.
const CUSTOM_LINK: MenuLink = {
  to: '/custom/sector',
  label: 'Custom',
  icon: 'custom-edit',
  options: [
    { label: 'SECTOR', to: '/custom/sector' },
    { label: 'STOCK', to: '/custom/stock' },
  ],
}

// 관리자 계정에만 보이는 Admin 메뉴 — 회원 명단(MEMBER), 대시보드(DASHBOARD, 차트 모음), 메시지(MESSAGE, 주소는 /admin/message), 배너(BANNER)로 나뉜다.
const ADMIN_LINK: MenuLink = {
  to: '/admin/member',
  label: 'Admin',
  icon: 'member',
  admin: true,
  options: [
    { label: 'MEMBER', to: '/admin/member' },
    { label: 'DASHBOARD', to: '/admin/dashboard' },
    { label: 'MESSAGE', to: '/admin/message' },
    { label: 'DEFAULT', to: '/admin/default' },
    { label: 'BANNER', to: '/admin/banner' },
  ],
}

// 메뉴 글자는 글자 앞 아이콘과 함께 쓰므로 글자 크기를 18px에서 15px로 줄였다.
const NAV_TAB_CLASS = `${FONT_NAV_TAB.replace('text-lg', 'text-[15px]')} inline-flex items-center gap-[4.5px] whitespace-nowrap`

// 아이콘마다 선이 그려진 범위(24칸 격자 기준)가 달라서(Map·Admin 16칸, Home·Graph 18칸, Custom 18.6칸) 그대로 같은 크기로 그리면 들쭉날쭉해 보인다.
// 그려진 범위의 가운데를 잡고 긴 변 + 선 여백 2칸을 한 변으로 하는 정사각형으로 잘라, 모두 같은 18px 칸에 넣는다.
// 아이콘 중심이 글자 대문자 높이의 중심보다 약 1.4px 낮아서 그만큼 올린다(-translate-y-[1.4px]). 선 굵기는 화면에서 모두 약 1.35px가 되도록 잘린 크기에 맞춰 정한다(굵기 × 잘린 변 ÷ 18).
const NAV_ICON_PX = 18
const NAV_ICON_STROKE_PX = 1.35
type NavIconName = Extract<SettingsSectionIconName, 'home' | 'composition' | 'bar-chart' | 'custom-edit' | 'member'>
const NAV_ICON_EXTENT: Record<NavIconName, { cx: number; cy: number; size: number }> = {
  home: { cx: 12, cy: 12, size: 18 },
  composition: { cx: 12, cy: 12, size: 16 },
  'bar-chart': { cx: 12, cy: 12, size: 18 },
  'custom-edit': { cx: 12.31, cy: 12.69, size: 18.62 },
  member: { cx: 12, cy: 12.5, size: 17 },
}

// 광고 배너(AdBannerSlot)가 메뉴에 걸릴 만큼 화면이 좁으면 배너 자리가 html에 data-nav-compact를 달아서 글자 앞 아이콘을 숨기고 메뉴 폭을 줄인다.
function NavIcon({ icon }: { icon: NavIconName }) {
  const { cx, cy, size } = NAV_ICON_EXTENT[icon]
  const side = size + 2
  return (
    <SettingsSectionIcon
      icon={icon}
      className="-translate-y-[1.4px] h-[18px] w-[18px] [html[data-nav-compact]_&]:hidden"
      viewBox={`${cx - side / 2} ${cy - side / 2} ${side} ${side}`}
      strokeWidth={(NAV_ICON_STROKE_PX * side) / NAV_ICON_PX}
    />
  )
}

// 목록이 닫히기 전에 커서가 메뉴 글자에서 목록으로 건너갈 시간(ms).
const CLOSE_DELAY_MS = 120

interface Props {
  // 페이지별 옵션 버튼 — 재사용되지 않는 페이지 전용 UI라 각 페이지가 인라인으로 만들어 넘긴다.
  actions?: ReactNode
  // 지금 보는 항목을 목록에서 다시 고르면 이동 대신 이걸 부른다(지도: 드릴다운 맨 위로). 안 넘기면 아무 일도 하지 않는다.
  onReselectCurrent?: () => void
  // 공개 문서의 Google OAuth 동의 화면에서는 세션 API를 호출하지 않는다.
  staticMode?: boolean
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function NavSubBar({ actions, onReselectCurrent, staticMode = false }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  // 관리자 계정에만 Admin 메뉴가 더 보인다 — 다른 메뉴와 같은 글자 모양이고 색만 관리자 전용 색이다.
  const { data: session, isLoading: isSessionLoading } = useSession(!staticMode)
  const isAdmin = !isSessionLoading && isAdminSession(session)
  const customLink = isAdmin ? { ...CUSTOM_LINK, options: [...(CUSTOM_LINK.options ?? []), { label: 'J-SECTOR', to: '/custom/japan/sector' }, { label: 'J-STOCK', to: '/custom/japan/stock' }] } : CUSTOM_LINK
  const baseLinks = isAdmin ? BASE_LINKS.map(link => link.label === 'Map' ? { ...link, options: [...(link.options ?? []), { label: 'JAPAN', to: '/map/japan' }] } : link) : BASE_LINKS
  const links = isAdmin ? [...baseLinks, customLink, ADMIN_LINK] : [...baseLinks, customLink]
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
    if (to === marketRoute('/map', 'ALL_STOCK')) return location.pathname.startsWith('/map/')
    if (to === marketRoute('/graph', 'ALL_STOCK')) return location.pathname.startsWith('/graph/')
    if (to === '/custom/sector') return location.pathname.startsWith('/custom')
    if (to === '/admin/member') return location.pathname.startsWith('/admin')
    return location.pathname === to
  }
  const linkClassName = (to: string) =>
    `${NAV_TAB_CLASS} ${isLinkActive(to) ? 'text-[var(--accent)]' : 'text-ui-muted hover:text-ui-white'}`

  const open = (to: string) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    setOpenTo(to)
  }
  const closeSoon = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current)
    closeTimerRef.current = setTimeout(() => setOpenTo(null), CLOSE_DELAY_MS)
  }
  // 목록에서 지금 보고 있는 항목인지 — Custom은 /custom/sector와 /custom/stock 두 화면 중 하나이고, Map·Graph는 주소의 시장 이름이다.
  const isCurrentOption = (option: MenuOption) => location.pathname === option.to
  const handleSelect = (option: MenuOption) => {
    setOpenTo(null)
    if (isCurrentOption(option)) onReselectCurrent?.()
    else navigate(option.to)
  }

  return (
    <div className="relative z-30 mb-[15px] flex h-[30px] after:absolute after:inset-x-0 after:top-full after:h-[0.5px] after:bg-ui-surface shrink-0 items-center justify-between gap-3 bg-ui-surface px-3 text-xs">
      {/* 이 줄의 하단선은 메인·설정 행의 세로 기준이다. 아이콘 28px과 같은 높이로 두고, 하단선에서 설정창까지는 페이지 쪽의 4px만 남긴다. */}
      <div ref={barRef} data-nav-menus className="flex h-7 items-center gap-3">
        {links.map(link => (
          <div
            key={link.to}
            className="relative flex h-7 items-center"
            onMouseEnter={() => link.options && open(link.to)}
            onMouseLeave={() => link.options && closeSoon()}
          >
            <Link
              to={link.to}
              className={link.admin ? `${NAV_TAB_CLASS} transition-colors hover:text-admin-only-hover ${isLinkActive(link.to) ? 'text-admin-only-hover' : 'text-admin-only'}` : linkClassName(link.to)}
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
              <NavIcon icon={link.icon} />
              {link.label}
            </Link>
            {/* 메뉴 칸(28px)이 탭 글자(약 20px)보다 커서 칸 아래에 바로 붙여야 글자 기준으로 4px가 된다. */}
            {link.options && openTo === link.to && (
              <div className={`absolute left-0 top-full z-50 w-32 overflow-hidden ${DROPDOWN_PANEL_CLASS}`}>
                <div role="listbox" aria-label={`${link.label} 목록`}>
                  {link.options.map(option => {
                    const isCurrent = isCurrentOption(option)
                    const isMarketChild = option.to.endsWith('/kospi') || option.to.endsWith('/kosdaq')
                    return (
                      <button
                        key={option.to}
                        type="button"
                        role="option"
                        aria-selected={isCurrent}
                        onClick={() => handleSelect(option)}
                        className={`font-roboto-latin block h-[30px] w-full rounded-none border-0 ${isMarketChild ? 'pl-6 pr-3' : 'px-3'} text-left text-sm font-medium transition-colors ${
                          isCurrent ? 'bg-[var(--brand-surface)] text-ui-white' : 'bg-transparent text-ui-white hover:bg-ui-white/10'
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
