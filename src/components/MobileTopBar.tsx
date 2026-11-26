import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'
import { ChevronRightIcon } from '@/components/icons/AppIcons'

// 서머리·지도·글 페이지가 공유하는 모바일 상단 줄.
// centered: MOBILE 지도 세 페이지용 — 52px 높이, 지금 페이지 이름을 가운데에 두고(누르기 기능 없음) 오른쪽에 아이콘을 둔다(2026-11-27 사용자 결정).
export default function MobileTopBar({ title, titleTo, titleLabel, onTitleClick, showDivider = false, className = '', right = null, centered = false }: { title: string; titleTo?: string; titleLabel?: string; onTitleClick?: () => void; showDivider?: boolean; className?: string; right?: ReactNode; centered?: boolean }) {
  if (centered) {
    return (
      <header className={`relative z-20 flex h-[calc(52px+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 bg-ui-surface pl-4 pr-1 pt-[env(safe-area-inset-top)] ${className}`}>
        {/* 가운데 제목(가장 긴 "그룹 등락률" 약 80px)과 겹치지 않게, 390px보다 좁은 화면에서는 로고만 조금 줄인다. */}
        <Link to="/" aria-label="MARKETRY 홈으로 이동" className="min-w-0 shrink-0">
          <MarketryLogo layout="horizontalMobile" className="h-auto w-[min(132px,calc(50vw-62px))] max-w-none" />
        </Link>
        <h1 className="pointer-events-none absolute left-1/2 m-0 -translate-x-1/2 whitespace-nowrap text-[15px] font-bold leading-none tracking-[0.12em] text-brand">{title}</h1>
        {right}
      </header>
    )
  }

  return (
    <header className={`relative z-20 flex h-[calc(44px+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 ${showDivider ? 'border-b border-ui-border' : ''} bg-ui-surface px-4 pt-[env(safe-area-inset-top)] ${className}`}>
      <Link to="/" aria-label="MARKETRY 홈으로 이동" className="min-w-0 shrink-0">
        <MarketryLogo layout="horizontalMobile" className="h-auto w-[132px] max-w-none" />
      </Link>
      <div className="flex min-w-0 items-center justify-end gap-2">
        {title ? (
          titleTo ? (
            <Link to={titleTo} aria-label={titleLabel} onClick={event => { if (onTitleClick) { event.preventDefault(); onTitleClick() } }} className="flex min-h-[44px] items-center justify-end gap-1 text-[14px] font-bold leading-none tracking-[0.12em] text-brand">{title}<ChevronRightIcon aria-hidden="true" className="h-3 w-3" /></Link>
          ) : (
            <span className="flex items-center justify-end gap-1 text-[14px] font-bold leading-none tracking-[0.12em] text-brand">{title}<ChevronRightIcon aria-hidden="true" className="h-3 w-3" /></span>
          )
        ) : null}
        {right}
      </div>
    </header>
  )
}
