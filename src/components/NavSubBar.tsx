import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FONT_NAV_TAB } from '@/components/FontStyle'

const BASE_LINKS = [
  { to: '/home', label: 'Home' },
  { to: '/map/allstock', label: 'Map' },
  { to: '/group/allstock', label: 'Group' },
]
// 비로그인에게도 열려 있다 — 마켓트리·거래소 시트는 읽고, 내 분류는 비어 있으며 수정하려 할 때 로그인 팝업이 뜬다.
const CUSTOM_LINK = { to: '/custom/stock', label: 'Custom' }

interface Props {
  // 페이지별 옵션 버튼 — 재사용되지 않는 페이지 전용 UI라 각 페이지가 인라인으로 만들어 넘긴다.
  actions?: ReactNode
}

// 탭 메뉴(왼쪽) + 페이지별 옵션 버튼(오른쪽)을 한 줄에 같이 보여주는 바.
export default function NavSubBar({ actions }: Props) {
  const location = useLocation()
  const links = [...BASE_LINKS, CUSTOM_LINK]

  const isLinkActive = (to: string) => {
    if (to === '/map/allstock') return location.pathname.startsWith('/map/')
    if (to === '/group/allstock') return location.pathname.startsWith('/group/')
    if (to === '/custom/stock') return location.pathname.startsWith('/custom')
    return location.pathname === to
  }
  const linkClassName = (to: string) =>
    `${FONT_NAV_TAB} whitespace-nowrap ${isLinkActive(to) ? 'text-[var(--accent)]' : 'text-gray-400 hover:text-white'}`

  return (
    <div className="relative z-30 -top-[13px] flex h-8 after:absolute after:inset-x-0 after:top-full after:h-[2.5px] after:bg-zinc-900 shrink-0 items-center justify-between gap-3 bg-zinc-900 px-3 text-xs">
      <div className="flex h-8 items-center gap-3">
        {links.map(link => (
          <Link
            key={link.to}
            to={link.to}
            className={linkClassName(link.to)}
          >
            {link.label}
          </Link>
        ))}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
