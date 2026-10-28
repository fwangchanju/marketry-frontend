import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'
import ProfileAvatar from '@/components/ProfileAvatar'
import { ChevronDownIcon, MoonIcon, SunIcon } from '@/components/icons/AppIcons'
import { useLoginGate } from '@/hooks/useLoginGate'
import { useLocalDevLogin, useLogout, useSession, useSessionKeepAlive } from '@/hooks/useSession'
import { useMobileTheme } from '@/utils/mobileTheme'

// 홈·지도·글 페이지가 공유하는 모바일 상단 줄.
export default function MobileTopBar({ title, titleTo, titleLabel, className = '' }: { title: string; titleTo?: string; titleLabel?: string; className?: string }) {
  const { pathname, search, hash } = useLocation()
  const { requireLogin } = useLoginGate()
  const { data: session, isLoading } = useSession()
  const logout = useLogout()
  const [theme, setTheme] = useMobileTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  useLocalDevLogin()
  useSessionKeepAlive(session?.authenticated ?? false)

  useEffect(() => {
    if (!menuOpen) return
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false) }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); buttonRef.current?.focus() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape) }
  }, [menuOpen])

  return (
    <header className={`relative z-20 grid h-[calc(44px+env(safe-area-inset-top))] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-ui-border bg-ui-surface px-4 pt-[env(safe-area-inset-top)] ${className}`}>
      <Link to="/home" aria-label="MARKETRY 홈으로 이동" className="min-w-0 justify-self-start">
        <MarketryLogo layout="horizontalClean" className="h-auto w-[132px] max-w-none" />
      </Link>
      {titleTo ? (
        <Link to={titleTo} aria-label={titleLabel} className="flex min-h-[44px] items-center justify-center gap-1 text-[14px] font-bold leading-none tracking-[0.12em] text-brand">{title}<ChevronDownIcon aria-hidden="true" className="h-3 w-3" /></Link>
      ) : (
        <span className="flex items-center gap-1 text-[14px] font-bold leading-none tracking-[0.12em] text-brand">{title}{title && <ChevronDownIcon aria-hidden="true" className="h-3 w-3" />}</span>
      )}
      <div className="flex items-center justify-self-end">
      <button type="button" aria-label={theme === 'light' ? '야간모드로 전환' : '주간모드로 전환'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="flex h-[44px] w-[40px] items-center justify-center border-0 bg-transparent p-0 text-ui-white">
        {theme === 'light' ? <SunIcon aria-hidden="true" className="h-[22px] w-[22px]" /> : <MoonIcon aria-hidden="true" className="h-[22px] w-[22px]" />}
      </button>
      <div ref={menuRef} className="relative">
        {isLoading ? <span className="block h-[44px] w-[44px]" aria-hidden="true" /> : session?.authenticated ? (
          <>
            <button ref={buttonRef} type="button" aria-label={menuOpen ? '계정 메뉴 닫기' : '계정 메뉴 열기'} aria-expanded={menuOpen} onClick={() => setMenuOpen(open => !open)} className="flex h-[44px] w-[44px] items-center justify-center border-0 bg-transparent p-1">
              <ProfileAvatar className="size-9 object-cover" />
            </button>
            {menuOpen && <div className="absolute right-0 top-full z-30 min-w-[140px] rounded-[4px] border border-ui-border bg-ui-panel p-2 shadow-lg">
              <p className="truncate px-2 py-1 text-[16px] font-medium text-ui-white">{session.nickname || '내 계정'}</p>
              <button type="button" disabled={logout.isPending} onClick={() => { setMenuOpen(false); logout.mutate() }} className="mt-1 min-h-[36px] w-full rounded-[4px] border-0 bg-ui-control px-3 text-[16px] font-medium text-ui-white disabled:opacity-50">로그아웃</button>
            </div>}
          </>
        ) : <button type="button" onClick={() => void requireLogin(`${pathname}${search}${hash}`, { hideMessage: true })} className="min-h-[44px] border-0 bg-transparent px-1 text-[13px] font-medium text-ui-white">로그인</button>}
      </div>
      </div>
    </header>
  )
}
