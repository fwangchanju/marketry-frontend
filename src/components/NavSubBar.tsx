import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FONT_NAV_TAB } from '@/components/FontStyle'
import SettingsSectionIcon, { type SettingsSectionIconName } from '@/components/SettingsSectionIcon'
import { OVERSEAS_SEGMENT_PATTERN, overseasMarketBySegment } from '@/utils/markets'
import { marketRoute } from '@/utils/marketRoute'
import { SECTOR_KOREA, STOCK_KOREA } from '@/utils/customRoutes'
import { useSession } from '@/hooks/useSession'
import { isAdminSession } from '@/utils/adminAccess'
import { DROPDOWN_PANEL_CLASS } from '@/components/dropdownStyle'

interface MenuOption {
  label: string
  to: string
  // 특별 회원 전용 항목 — 글자를 특별 회원 색(보라)으로 표시한다.
  special?: boolean
}

interface MenuLink {
  to: string
  label: string
  // 글자 앞 아이콘 — 각 페이지 설정창 메뉴 줄의 아이콘을 그대로 쓴다.
  icon: NavIconName
  // 관리자 전용 메뉴 — 글자 색만 관리자 전용 색이다.
  admin?: boolean
  // 누르면 아래로 펼쳐지는 목록 — 없으면 그냥 이동만 하는 메뉴(Home).
  options?: MenuOption[]
}

// Map·Graph는 KOREA / KOSPI / KOSDAQ을 고르고, Sector·Stock은 KOREA를 바로 연다(특별 회원은 JAPAN도 고른다).
const BASE_LINKS: MenuLink[] = [
  { to: '/summary/korea', label: 'Home', icon: 'home' },
  { to: marketRoute('/map', 'ALL_STOCK'), label: 'Map', icon: 'composition' },
  { to: marketRoute('/graph', 'ALL_STOCK'), label: 'Graph', icon: 'bar-chart' },
]
// 비로그인에게도 열려 있다 — 마켓트리·거래소 시트는 읽고, 내 분류는 비어 있으며 수정하려 할 때 로그인 팝업이 뜬다.
// 예전 Custom 메뉴를 Sector·Stock 두 메뉴로 나눴다. 주소는 /sector/korea·/stock/korea(일본은 /sector/japan·/stock/japan)다. 옛 /custom 주소는 새 주소로 이동한다.
// 일반 회원은 누르면 바로 한국 화면으로 가고, 특별 회원은 KOREA / JAPAN 목록이 열린다.
const SECTOR_LINK: MenuLink = { to: SECTOR_KOREA, label: 'Sector', icon: 'industry' }
const STOCK_LINK: MenuLink = { to: STOCK_KOREA, label: 'Stock', icon: 'stock-single' }

// 관리자 계정에만 보이는 Admin 메뉴 — 회원 명단(MEMBER), 대시보드(DASHBOARD, 차트 모음), 메시지(MESSAGE, 주소는 /admin/message), 배너(BANNER)로 나뉜다.
const ADMIN_LINK: MenuLink = {
  to: '/admin/member',
  label: 'Admin',
  icon: 'member',
  admin: true,
  // 마우스를 올리면 관리자 화면 목록이 열린다.
  options: [
    { label: 'MEMBER', to: '/admin/member' },
    { label: 'DASHBOARD', to: '/admin/stats' },
    { label: 'MESSAGE', to: '/admin/message' },
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
type NavIconName = Extract<SettingsSectionIconName, 'home' | 'composition' | 'bar-chart' | 'custom-edit' | 'member' | 'industry' | 'stock-single'>
const NAV_ICON_EXTENT: Record<NavIconName, { cx: number; cy: number; size: number; px?: number }> = {
  home: { cx: 12, cy: 12, size: 18 },
  composition: { cx: 12, cy: 12, size: 16 },
  'bar-chart': { cx: 12, cy: 12, size: 18 },
  'custom-edit': { cx: 12.31, cy: 12.69, size: 18.62 },
  member: { cx: 12, cy: 12.5, size: 17 },
  industry: { cx: 12, cy: 12, size: 20 },
  // 네모(10칸)에 맞춰 자르고, 칸(px)도 같은 비율(18px ÷ 22칸)로 줄여 네모 크기는 그대로 두되 양옆 빈 여백만 없앤다.
  // 18px 칸에 그대로 넣으면 네모가 칸의 절반만 차서 글자와의 간격이 다른 아이콘보다 넓어 보인다.
  'stock-single': { cx: 12, cy: 12, size: 10, px: 9.8 },
}

// 광고 배너(AdBannerSlot)가 메뉴에 걸릴 만큼 화면이 좁으면 배너 자리가 html에 data-nav-compact를 달아서 글자 앞 아이콘을 숨기고 메뉴 폭을 줄인다.
function NavIcon({ icon }: { icon: NavIconName }) {
  const { cx, cy, size, px = NAV_ICON_PX } = NAV_ICON_EXTENT[icon]
  const side = size + 2
  // 칸 크기(px)는 대부분 18px이고, 그보다 작은 아이콘(stock-single)만 따로 줄인다. 클래스는 소스에 문자열로 있어야 만들어진다.
  const boxClass = px === NAV_ICON_PX ? 'h-[18px] w-[18px]' : 'h-[9.8px] w-[9.8px]'
  return (
    <SettingsSectionIcon
      icon={icon}
      className={`-translate-y-[1.4px] ${boxClass} [html[data-nav-compact]_&]:hidden`}
      viewBox={`${cx - side / 2} ${cy - side / 2} ${side} ${side}`}
      strokeWidth={(NAV_ICON_STROKE_PX * side) / px}
    />
  )
}

interface Props {
  // 페이지별 옵션 버튼 — 재사용되지 않는 페이지 전용 UI라 각 페이지가 인라인으로 만들어 넘긴다.
  actions?: ReactNode
  // 지금 보는 항목을 목록에서 다시 고르면 이동 대신 이걸 부른다(지도: 드릴다운 맨 위로). 안 넘기면 아무 일도 하지 않는다.
  onReselectCurrent?: () => void
  // 공개 문서의 Google OAuth 동의 화면에서는 세션 API를 호출하지 않는다.
  staticMode?: boolean
  // true면 메뉴를 가로 한 줄이 아니라 화면 왼쪽 세로 줄로 보여준다(지도 화면).
  vertical?: boolean
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function NavSubBar({ actions, onReselectCurrent, staticMode = false, vertical = true }: Props) {
  // 오른쪽 버튼 묶음은 상단 영역(NavBar)의 자리에 그린다.
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setActionSlot(document.getElementById('nav-actions-slot')))
    return () => cancelAnimationFrame(frame)
  }, [])
  const location = useLocation()
  const navigate = useNavigate()
  // 관리자 계정에만 Admin 메뉴가 더 보인다 — 다른 메뉴와 같은 글자 모양이고 색만 관리자 전용 색이다.
  const { data: session, isLoading: isSessionLoading } = useSession(!staticMode)
  const isAdmin = !isSessionLoading && isAdminSession(session)
  // 지금 보는 시장이 일본·미국이면 페이지 이동 메뉴도 그 시장으로 간다(일본 지도 → 그래프는 /graph/japan).
  const marketSegment = new RegExp(`/(kospi|kosdaq|${OVERSEAS_SEGMENT_PATTERN})(/|$)`).exec(location.pathname)?.[1] ?? null
  const overseasMarket = overseasMarketBySegment(marketSegment)
  const overseasSegment = overseasMarket?.routeSegment ?? null
  // 코스피·코스닥은 korea 아래에 있다(/map/korea/kospi).
  const mapSegment = marketSegment === 'kospi' || marketSegment === 'kosdaq' ? `korea/${marketSegment}` : marketSegment
  // Sector·Stock은 마우스를 올리면 시장 목록(KOREA·JAPAN·USA)이 열린다.
  const marketOptions = (prefix: string, korea: string, withKospi = false): MenuOption[] => [
    { label: 'KOREA', to: korea },
    ...(withKospi ? [
      { label: 'KOSPI', to: `/${prefix}/korea/kospi` },
      { label: 'KOSDAQ', to: `/${prefix}/korea/kosdaq` },
    ] : []),
    { label: 'JAPAN', to: `/${prefix}/japan` },
    { label: 'USA', to: `/${prefix}/usa` },
  ]
  const customLinks = overseasSegment
    ? [{ ...SECTOR_LINK, to: `/sector/${overseasSegment}`, options: marketOptions('sector', SECTOR_KOREA) }, { ...STOCK_LINK, to: `/stock/${overseasSegment}`, options: marketOptions('stock', STOCK_KOREA) }]
    : [{ ...SECTOR_LINK, options: marketOptions('sector', SECTOR_KOREA) }, { ...STOCK_LINK, options: marketOptions('stock', STOCK_KOREA) }]
  // Home·Map·Graph도 마우스를 올리면 시장 목록(KOREA·JAPAN·USA)이 열린다.
  const baseLinks = BASE_LINKS.map(link => {
    const prefix = link.label === 'Home' ? 'summary' : link.label === 'Map' ? 'map' : link.label === 'Graph' ? 'graph' : null
    const options = prefix ? marketOptions(prefix, `/${prefix}/korea`, true) : undefined
    if (!marketSegment) return { ...link, options }
    if (link.label === 'Home') return { ...link, to: `/summary/${mapSegment}`, options }
    if (link.label === 'Map') return { ...link, to: `/map/${mapSegment}`, options }
    if (link.label === 'Graph') return { ...link, to: `/graph/${mapSegment}`, options }
    return { ...link, options }
  })
  const links = isAdmin ? [...baseLinks, ...customLinks, ADMIN_LINK] : [...baseLinks, ...customLinks]
  const [openTo, setOpenTo] = useState<string | null>(null)
  // 목록은 누르면 열려 그대로 있고, 메뉴 밖을 누르면 닫는다. 메뉴 사이 빈 곳도 메뉴 밖이다.
  useEffect(() => {
    if (openTo === null) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest?.('[data-nav-menu-item]')) setOpenTo(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openTo])

  const isLinkActive = (to: string) => {
    if (to === marketRoute('/map', 'ALL_STOCK')) return location.pathname.startsWith('/map/')
    if (to === marketRoute('/graph', 'ALL_STOCK')) return location.pathname.startsWith('/graph/')
    if (to === SECTOR_KOREA) return location.pathname.startsWith('/sector/')
    if (to === STOCK_KOREA) return location.pathname.startsWith('/stock/')
    if (to === '/admin/member') return location.pathname.startsWith('/admin')
    return location.pathname === to
  }
  // 세로 메뉴는 아이콘을 글자 위에 두고, 선택 칸에 청록 배경을 깐다.
  const linkClassName = (to: string) => vertical
    ? `flex h-14 w-full flex-col items-center justify-center gap-1 rounded text-[13px] font-semibold ${isLinkActive(to) ? 'text-[var(--accent)]' : 'text-ui-muted hover:text-ui-white'}`
    : `${NAV_TAB_CLASS} ${isLinkActive(to) ? 'text-[var(--accent)]' : 'text-ui-muted hover:text-ui-white'}`

  // 목록에서 지금 보고 있는 항목인지 — Sector·Stock은 한국(/sector/korea, /stock/korea)과 일본(/sector/japan, /stock/japan) 화면이고, Map·Graph는 주소의 시장 이름이다.
  const isCurrentOption = (option: MenuOption) => location.pathname === option.to
  const handleSelect = (option: MenuOption) => {
    setOpenTo(null)
    if (isCurrentOption(option)) onReselectCurrent?.()
    else navigate(option.to)
  }

  return (
    <div className={vertical
      ? 'fixed bottom-0 left-0 top-[90px] z-30 flex w-20 flex-col items-stretch bg-ui-background px-2 pt-[4px] text-xs'
      : 'relative z-30 mb-[15px] flex h-[30px] after:absolute after:inset-x-0 after:top-full after:h-[0.5px] after:bg-ui-surface shrink-0 items-center justify-between gap-3 bg-ui-surface px-3 text-xs'}>
      {/* 이 줄의 하단선은 메인·설정 행의 세로 기준이다. 아이콘 28px과 같은 높이로 두고, 하단선에서 설정창까지는 페이지 쪽의 4px만 남긴다. */}
      <div data-nav-menus className={vertical ? 'flex h-full flex-col items-stretch gap-1' : 'flex h-7 items-center gap-3'}>
        {links.map(link => (
          <div
            key={link.to}
            data-nav-menu-item
            onMouseEnter={vertical && link.options ? () => setOpenTo(link.to) : undefined}
            onMouseLeave={vertical && link.options ? () => setOpenTo(current => (current === link.to ? null : current)) : undefined}
            className={vertical ? `relative flex w-full items-center${link.admin ? ' mt-auto' : ''}` : 'relative flex h-7 items-center'}
          >
            <Link
              to={link.to}
              className={link.admin ? `${vertical ? 'flex h-14 w-full flex-col items-center justify-center gap-1 rounded text-[13px] font-semibold' : NAV_TAB_CLASS} transition-colors hover:text-admin-only-hover ${isLinkActive(link.to) ? 'text-admin-only-hover' : 'text-admin-only'}` : linkClassName(link.to)}
              aria-expanded={link.options ? openTo === link.to : undefined}
              onClick={event => {
                // 왼쪽 세로 메뉴는 누르면 바로 이동하고, 목록은 마우스를 올렸을 때만 연다.
                if (!link.options || vertical) {
                  setOpenTo(null)
                  return
                }
                // Cmd·Ctrl·Shift를 누른 클릭은 브라우저의 새 탭·새 창 열기로 둔다.
                if (event.metaKey || event.ctrlKey || event.shiftKey) return
                // 목록이 있는 메뉴는 이동하지 않고 목록을 열거나 닫는다. 화면은 목록에서 고른다.
                event.preventDefault()
                setOpenTo(current => (current === link.to ? null : link.to))
              }}
            >
              <NavIcon icon={link.icon} />
              {link.label}
            </Link>
            {/* 메뉴 칸(28px)이 탭 글자(약 20px)보다 커서 칸 아래에 바로 붙여야 글자 기준으로 4px가 된다. */}
            {link.options && openTo === link.to && (
              <div className={`absolute z-50 w-32 overflow-hidden ${DROPDOWN_PANEL_CLASS} ${vertical ? (link.admin ? 'left-full bottom-0' : 'left-full top-0') : 'left-0 top-full'}`}>
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
                        className={`font-roboto-latin block h-[30px] w-full rounded-none border-0 px-3 text-left text-sm font-medium transition-colors ${
                          isCurrent ? 'bg-[var(--brand-surface)]' : 'bg-transparent hover:bg-ui-white/10'} ${option.special ? 'text-[var(--sub-purple)]' : 'text-ui-white'
                        }`}
                      >
                        {/* 하위 시장은 윗줄 KOREA에 맞춘다: 화살표는 KO 가운데, 글자는 R 시작 위치. 숨긴 KO로 폭을 잡아 글꼴이 달라도 맞는다. */}
                        {isMarketChild && (
                          <span aria-hidden="true" className="relative inline-block">
                            <span className="invisible">KO</span>
                            <span className="absolute inset-0 text-center">▸</span>
                          </span>
                        )}
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
      {actions && actionSlot && createPortal(actions, actionSlot)}
    </div>
  )
}
