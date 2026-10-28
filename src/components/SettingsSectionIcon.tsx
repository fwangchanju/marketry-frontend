import type { ReactNode } from 'react'
import { IconAd, IconBellRinging, IconDeviceDesktopAnalytics, IconMail, IconUsersGroup } from '@tabler/icons-react'

export type SettingsSectionIconName = 'composition' | 'equal-size' | 'industry' | 'stock-display' | 'colors' | 'bar-chart' | 'dashboard' | 'home' | 'member' | 'members' | 'experiment' | 'custom-edit' | 'document' | 'mail' | 'megaphone' | 'ad'

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
  home: (
    <>
      <path d="m3 10 9-7 9 7" />
      <path d="M5 8.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5" />
      <path d="M9 21v-8h6v8" />
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
  // 실험 탭(특별 회원 전용) — 실험용 삼각 플라스크 모양이다.
  experiment: (
    <>
      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
      <path d="M8.5 2h7" />
      <path d="M7 16h10" />
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
