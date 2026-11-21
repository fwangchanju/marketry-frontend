import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'
import { ChevronRightIcon } from '@/components/icons/AppIcons'

// 서머리·지도·글 페이지가 공유하는 모바일 상단 줄.
export default function MobileTopBar({ title, titleTo, titleLabel, onTitleClick, showDivider = false, className = '', right = null }: { title: string; titleTo?: string; titleLabel?: string; onTitleClick?: () => void; showDivider?: boolean; className?: string; right?: ReactNode }) {

  return (
    <header className={`relative z-20 flex h-[calc(44px+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 ${showDivider ? 'border-b border-ui-border' : ''} bg-ui-surface px-4 pt-[env(safe-area-inset-top)] ${className}`}>
      <Link to="/summary/korea" aria-label="MARKETRY 홈으로 이동" className="min-w-0 shrink-0">
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
