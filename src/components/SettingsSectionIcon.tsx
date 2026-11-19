import type { ReactNode } from 'react'
import { IconAd, IconBellRinging, IconDeviceDesktopAnalytics, IconMail, IconUsersGroup } from '@tabler/icons-react'

export type SettingsSectionIconName = 'stock-menu' | 'composition' | 'equal-size' | 'industry' | 'stock-display' | 'colors' | 'bar-chart' | 'dashboard' | 'home' | 'member' | 'members' | 'experiment' | 'custom-edit' | 'stock-single' | 'document' | 'mail' | 'megaphone' | 'ad'

interface SettingsSectionIconProps {
  icon: SettingsSectionIconName
  className?: string
  strokeWidth?: number
  // 기본은 24×24 격자 전체다. 그려진 범위가 아이콘마다 달라서 크기를 맞춰야 할 때 그 범위에 맞게 자른 영역을 넘긴다.
  viewBox?: string
}

// 설정창 메뉴 줄의 아이콘 — 상단 영역 아이콘과 같은 선 아이콘이다(24×24 격자, 선 끝·꺾임 둥글게).
// 업종 분류·색상은 Lucide(network·palette), 종목 구성·종목 박스는 Tabler(chart-heatmap·text-size) 모양이다.
const ICON_SHAPES: Record<Exclude<SettingsSectionIconName, 'dashboard' | 'megaphone' | 'ad' | 'mail' | 'members'>, ReactNode> = {
  document: (
    <>
      <path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M14 3.5v5h5M8.5 12h7M8.5 16h7" />
    </>
  ),
  'custom-edit': (
    <>
      <path d="M3 20c1.5-2 3-2.7 4.5-1.5 1.1.9 2.3.8 3.5-.3" />
      <path d="m10 14 8-8a2.12 2.12 0 0 1 3 3l-8 8-4 1z" />
      <path d="m16 8 3 3" />
    </>
  ),
  // 상단 Stock 메뉴 아이콘 — Sector 메뉴(industry)의 계층도에서 작은 네모 하나만 남긴 모양이다. 네모는 industry의 작은 네모(6×6)보다 크게(10×10) 그린다(사용자 요청: "좀 더 커도 된다").
  'stock-single': <rect x="7" y="7" width="10" height="10" rx="1.4" />,
  // 상단 Stock 메뉴 아이콘 — 서머리 아이콘(클립보드)과 크기를 맞추려고 stock-single보다 크게 그린다. 설정창 탭은 계속 stock-single을 쓴다.
  'stock-menu': <rect x="5" y="5" width="14" height="14" rx="2" />,
  // 서머리 메뉴 아이콘 — 클립보드 모양(이중 테두리, 위쪽 클립, 줄 여섯 개). 글자 SUMMARY는 24px 아이콘에서 읽히지 않아 그리지 않는다.
  home: (
    <>
      <rect x="3" y="3.5" width="18" height="18.5" rx="1.5" />
      <rect x="5.5" y="5.5" width="13" height="16" rx="1" />
      <rect x="8.5" y="1.5" width="7" height="4" rx="1.5" />
      <path d="M8 9h8M8 11h8M8 13h8M8 15h8M8 17h8M8 19h8" />
    </>
  ),
  'bar-chart': (
    <>
      <rect x="3" y="12" width="4" height="8" rx="1" />
      <rect x="10" y="4" width="4" height="16" rx="1" />
      <rect x="17" y="8" width="4" height="12" rx="1" />
    </>
  ),
  'equal-size': (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2.25" />
      <path d="M12 3v18M3 12h18" />
    </>
  ),
  composition: (
    <>
      <path d="M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12" />
      <path d="M12 4v16" />
      <path d="M4 15h8" />
      <path d="M12 12h8" />
      <path d="M16 12v8" />
      <path d="M16 16h4" />
    </>
  ),
  industry: (
    <>
      <rect x="16" y="16" width="6" height="6" rx="1" />
      <rect x="2" y="16" width="6" height="6" rx="1" />
      <rect x="9" y="2" width="6" height="6" rx="1" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
      <path d="M12 12V8" />
    </>
  ),
  'stock-display': (
    <>
      <path d="M3 7v-2h13v2" />
      <path d="M10 5v14" />
      <path d="M12 19h-4" />
      <path d="M15 13v-1h6v1" />
      <path d="M18 12v7" />
      <path d="M17 19h2" />
    </>
  ),
  colors: (
    <>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </>
  ),
  // 공통 설정 탭 — 톱니바퀴 모양이다. 상단 영역의 설정 아이콘(두 줄 슬라이더)과 겹치지 않게 다른 모양을 쓴다. Lucide settings 모양이다.
  experiment: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // 관리자 탭 — 머리와 어깨를 그린 사람 모양이다.
  member: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
}

// 30px로 그릴 때 선 1.1이 화면에서 약 1.35px로 보여 상단 영역 아이콘의 굵기(docs/ui-areas.md "아이콘 규칙")와 같다.
// 크기를 바꾸면 선 값도 `굵기 × 24 ÷ 크기`로 맞춰야 한다.
export default function SettingsSectionIcon({ icon, className = 'h-[30px] w-[30px]', strokeWidth = 1.1, viewBox = '0 0 24 24' }: SettingsSectionIconProps) {
  const libraryIconProps = { 'aria-hidden': true as const, size: 30, stroke: strokeWidth, className: `shrink-0 ${className}` }
  if (icon === 'dashboard') return <IconDeviceDesktopAnalytics {...libraryIconProps} />
  if (icon === 'members') return <IconUsersGroup {...libraryIconProps} />
  if (icon === 'megaphone') return <IconBellRinging {...libraryIconProps} />
  if (icon === 'ad') return <IconAd {...libraryIconProps} />
  if (icon === 'mail') return <IconMail {...libraryIconProps} />
  return (
    <svg
      aria-hidden="true"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {ICON_SHAPES[icon]}
    </svg>
  )
}
