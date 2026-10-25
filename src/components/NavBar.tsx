import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession, useLogout, useSessionKeepAlive, useLocalDevLogin } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import ProfileAvatar from '@/components/ProfileAvatar'
import { UserIcon } from '@/components/icons/AppIcons'
import MarketryLogo from '@/components/MarketryLogo'
import { useTestMemberToggle } from '@/hooks/useTestMemberToggle'
import { isLocalGuestMode, isLocalSignupEnabled, LOCAL_TEST_MEMBER_USER_ID } from '@/utils/localDevLogin'
import { isAdminSession } from '@/utils/adminAccess'
import { displayEmail } from '@/utils/displayEmail'
import ActiveBannerSlot from '@/components/ActiveBannerSlot'

// 모든 페이지에서 항상 똑같이 고정되는 최상단 바 — 홈 이동과 로그인 상태/프로필 메뉴를 담당한다.
// 로그인 버튼은 NavSubBar 우측 "일괄변경"류 accent 버튼(nes-btn + var(--accent))과 같은 톤을 쓰고,
// 로그인한 사용자는 우측 아바타에서 계정 메뉴를 연다.
// 오류에는 UI 상태색을 쓰고 등락률 데이터색과 구분한다.
// hideAccount가 true면 오른쪽의 로그인 버튼/프로필 아이콘을 숨기고 로고만 보여준다(비로그인이 프로필 페이지에 들어왔을 때).
export default function NavBar({ hideAccount = false, staticMode = false, bannerSlot }: { hideAccount?: boolean; staticMode?: boolean; bannerSlot?: ReactNode | null }) {
  const { data: session, isLoading } = useSession(!staticMode)
  const { pathname, search, hash } = useLocation()
  const { requireLogin } = useLoginGate()
  const logout = useLogout()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  // 로컬 전용 테스트 회원 전환 — 테스트 회원 생성과 원래 계정 복귀를 모두 계정 메뉴에서 제공한다.
  const { isPending: isDevSignupPending, error: devSignupError, loginAs: handleDevLogin } = useTestMemberToggle()
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  useLocalDevLogin(!staticMode)
  // 세션 확인이 끝났고 로그인하지 않은 상태 — 확인 중(isLoading)에는 깜빡임 없이 프로필 아이콘을 유지한다.
  const isLoggedOut = !isLoading && !session?.authenticated
  const isLocalDev = isLocalSignupEnabled()
  const localGuestMode = isLocalDev && isLocalGuestMode()
  const localAccountLabel = isLocalDev
    ? session?.authenticated
      ? isAdminSession(session)
        ? 'ADMIN'
        : session.userId === LOCAL_TEST_MEMBER_USER_ID
          ? 'TEST'
          : null
      : localGuestMode ? 'GUEST' : null
    : null
  const accountDisplayName = localAccountLabel || session?.nickname || '내 계정'
  // 로컬 개발 화면 전용 — 지금 어느 계정(ADMIN·TEST·GUEST)인지 프로필 칸 왼쪽에 보여 준다. 운영에는 없다.
  const localAccountBadge = localAccountLabel && (
    <span
      role="img"
      aria-label={`현재 계정: ${localAccountLabel}`}
      className={`mr-2 rounded px-2.5 py-1 text-sm font-bold leading-none ${localAccountLabel === 'ADMIN' ? 'bg-admin-only text-ui-background' : 'bg-ui-control text-ui-white'}`}
    >
      {localAccountLabel}
    </span>
  )
  // dev-login도 구글 로그인과 같은 15분짜리 접근 토큰을 발급하므로, localAutoLogin 여부와 무관하게
  // 로그인 상태면 동일하게 선제 갱신한다.
  useSessionKeepAlive((session?.authenticated ?? false) && !isDevSignupPending)

  useEffect(() => {
    if (!isProfileMenuOpen) return

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setIsProfileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false)
        profileButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isProfileMenuOpen])

  // 계정 메뉴가 열려 있는 동안만 헤더를 아래 줄(아이콘 줄, z-30)보다 위에 둔다 — 안 그러면 메뉴 위쪽이 그 줄에 가려진다.
  // 로고·프로필은 이 60px 줄(위 4px 띄움)의 중심선(32px)에 두고, 28px 메뉴 줄이 바로 아래에서 이어진다.
  return (
    <>
    <header className={`sticky top-0 flex h-[60px] items-center justify-between bg-ui-surface px-4 pt-[4px] ${isProfileMenuOpen ? 'z-40' : 'z-20'}`}>
      <Link
        to="/"
        aria-label="홈으로 이동: 지도 전체 종목"
        className="flex h-[60px] shrink-0 items-center"
      >
        <MarketryLogo layout="horizontalClean" className="h-auto w-[min(13rem,calc(100vw-10rem))]" />
      </Link>
      <div data-account-area className="flex items-center gap-3">
      {hideAccount ? null : (
      // 비로그인의 사람 모양 칸과 로그인한 프로필 사진 칸은 크기와 자리가 같아서, 로그인 상태가 바뀌어도 오른쪽 위 모양이 달라지지 않는다.
      <div className="flex items-center justify-end gap-3">
      {isLoading ? (
        // 세션 확인 중에는 로그인 버튼도 프로필 아이콘도 아닌 빈 틀만 둔다 — 새로고침 직후 잠깐 로그인한 모양이 비쳤다가 로그아웃 모양으로 바뀌는 깜빡임을 막는다. 크기와 자리는 둘과 같다.
        <div aria-hidden="true" className="relative -top-[2px] size-[38px] rounded-[12%] bg-ui-surface" />
      ) : isLoggedOut ? (
        // 비로그인은 프로필 사진 자리에 사람 모양 칸을 보여주고, 누르면 바로 로그인 창이 열린다. 로컬에서는 앞에 GUEST 표시가 붙는다.
        <div className="flex items-center">
        {localAccountBadge}
        <button
          type="button"
          aria-label="로그인"
          data-hint="로그인"
          onClick={() => requireLogin(`${pathname}${search}${hash}`, { hideMessage: true })}
          className="relative -top-[2px] flex size-[38px] items-center justify-center rounded-[12%] border-0 bg-ui-control p-0 text-ui-text transition-colors hover:bg-ui-control-hover"
        >
          <UserIcon aria-hidden="true" strokeWidth={1.25} className="size-[26px]" />
        </button>
        </div>
      ) : (
      <div ref={profileMenuRef} className="relative flex items-center">
        {localAccountBadge}
        <button
          ref={profileButtonRef}
          type="button"
          aria-label={isProfileMenuOpen ? '계정 메뉴 닫기' : '계정 메뉴 열기'}
          aria-expanded={isProfileMenuOpen}
          onClick={() => setIsProfileMenuOpen(open => !open)}
          className={`relative -top-[2px] flex size-[38px] items-center justify-center overflow-hidden rounded-[12%] border-0 p-0 ring-2 ring-transparent hover:ring-ui-border focus-visible:outline-none focus-visible:ring-[var(--accent)] bg-transparent`}
        >
          <ProfileAvatar className="size-full object-cover" />
        </button>
        {isProfileMenuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-ui-border bg-[var(--ui-panel)] pb-2 text-ui-white shadow-2xl shadow-ui-background/70">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-ui-muted">계정 확인 중...</p>
            ) : session?.authenticated ? (
              <>
                <div className="flex items-center gap-3 border-b border-ui-border px-4 py-3 text-sm">
                  <ProfileAvatar className="size-10 shrink-0 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{accountDisplayName}</p>
                    <p className="mt-1 truncate text-ui-muted">{displayEmail(session.email) || `사용자 ${session.userId}`}</p>
                  </div>
                </div>
                {/* 마켓 메뉴와 같은 상태색 규칙: 기본은 팝업 바탕, 호버는 옅은 회색, 현재 페이지는 청록 포인트다. */}
                <div className="flex gap-[6px] px-3 pb-1 pt-2.5">
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    aria-current={pathname === '/profile' ? 'page' : undefined}
                    className={`flex h-7 flex-1 items-center justify-center rounded-[5px] border text-[13px] font-medium text-ui-white transition-colors ${pathname === '/profile' ? 'border-[var(--brand)] bg-[var(--brand-surface)]' : 'border-ui-border bg-transparent hover:bg-ui-white/10 focus:bg-ui-white/10'}`}
                  >
                    프로필
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileMenuOpen(false)
                      logout.mutate()
                    }}
                    disabled={logout.isPending}
                    className="h-7 flex-1 rounded-[5px] border border-ui-border bg-transparent text-[13px] font-medium text-ui-white transition-colors hover:bg-ui-white/10 focus:bg-ui-white/10 disabled:opacity-50"
                  >
                    로그아웃
                  </button>
                </div>
              </>
            ) : null}
            {/* 계정 전환은 로그인한 뒤에만 보인다 — 관리자로 들어와야 테스트 계정을 쓸 수 있다(GUEST는 프로필 칸을 누르면 바로 뜨는 로그인 팝업이 관리자로 로그인한다). */}
            {isLocalDev && session?.authenticated && (
              <div className="mx-3 mt-2 flex flex-col gap-1.5 border-t border-ui-border pt-2">
                {(['admin', 'test'] as const)
                  .filter(account => account.toUpperCase() !== localAccountLabel)
                  .map(account => (
                  <button
                    key={account}
                    type="button"
                    onClick={() => handleDevLogin(account)}
                    disabled={isLoading || isDevSignupPending}
                    className={`h-7 w-full rounded-[5px] border-0 text-[13px] font-medium transition-colors disabled:opacity-50 ${account === 'admin' ? 'bg-admin-only text-ui-background hover:bg-admin-only-hover' : 'bg-ui-control text-ui-white hover:bg-ui-control-hover'}`}
                  >
                    {isDevSignupPending ? '전환 중…' : account === 'admin' ? '관리자 계정으로 전환' : '테스트 계정으로 전환'}
                  </button>
                ))}
                {devSignupError && <p role="alert" className="mt-0.5 text-xs text-status-error-ink">{devSignupError}</p>}
              </div>
            )}
          </div>
        )}
      </div>
      )}
      </div>
      )}
      </div>
    </header>
    {!staticMode && (bannerSlot === undefined ? <ActiveBannerSlot /> : bannerSlot)}
    </>
  )
}
