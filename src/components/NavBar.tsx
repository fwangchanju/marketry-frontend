import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession, useLogout, useSessionKeepAlive, useLocalDevLogin } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import ProfileAvatar from '@/components/ProfileAvatar'
import { UserIcon } from '@/components/icons/AppIcons'
import MarketryLogo from '@/components/MarketryLogo'
import { useTestMemberToggle } from '@/hooks/useTestMemberToggle'
import { isLocalSignupEnabled } from '@/utils/localDevLogin'

// 모든 페이지에서 항상 똑같이 고정되는 최상단 바 — 홈 이동과 로그인 상태/프로필 메뉴를 담당한다.
// 로그인 버튼은 NavSubBar 우측 "일괄변경"류 accent 버튼(nes-btn + var(--accent))과 같은 톤을 쓰고,
// 로그인한 사용자는 우측 아바타에서 계정 메뉴를 연다.
// 오류에는 UI 상태색을 쓰고 등락률 데이터색과 구분한다.
// hideAccount가 true면 오른쪽의 로그인 버튼/프로필 아이콘을 숨기고 로고만 보여준다(비로그인이 프로필 페이지에 들어왔을 때).
export default function NavBar({ hideAccount = false }: { hideAccount?: boolean }) {
  const { data: session, isLoading } = useSession()
  const { pathname, search, hash } = useLocation()
  const { requireLogin } = useLoginGate()
  const logout = useLogout()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  // 로컬 전용 테스트 회원 전환 — 테스트 회원으로 바꾸는 버튼은 Admin 설정창에 있고, 여기서는 테스트 회원일 때 원래 계정으로 돌아오는 버튼만 보인다.
  const { isTestMember, isPending: isDevSignupPending, error: devSignupError, toggle: handleToggleTestMember } = useTestMemberToggle()
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  useLocalDevLogin()
  // 세션 확인이 끝났고 로그인하지 않은 상태 — 확인 중(isLoading)에는 깜빡임 없이 프로필 아이콘을 유지한다.
  const isLoggedOut = !isLoading && !session?.authenticated
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
// 프로필 메뉴는 헤더 아래에 펼쳐지고, 열려 있는 동안 헤더가 페이지 메뉴 위에 표시된다.
  return (
    <header className={`sticky top-0 flex h-16 items-center justify-between px-4 ${isProfileMenuOpen ? 'z-40' : 'z-20'} bg-ui-surface`}>
      <Link
        to="/"
        aria-label="홈으로 이동: 지도 전체 종목"
        className="flex h-[60px] shrink-0 items-center"
      >
        <MarketryLogo className="h-[40.9px] w-auto max-w-[18rem]" />
      </Link>
      <div className="flex items-center gap-3">
      {hideAccount ? null : (
      // 비로그인의 사람 모양 칸과 로그인한 프로필 사진 칸은 크기와 자리가 같아서, 로그인 상태가 바뀌어도 오른쪽 위 모양이 달라지지 않는다.
      <div className="flex items-center justify-end gap-3">
      {isLoading ? (
        // 세션 확인 중에는 로그인 버튼도 프로필 아이콘도 아닌 빈 틀만 둔다 — 새로고침 직후 잠깐 로그인한 모양이 비쳤다가 로그아웃 모양으로 바뀌는 깜빡임을 막는다. 크기와 자리는 둘과 같다.
        <div aria-hidden="true" className="relative -top-[2.5px] mr-0.5 size-[38px] rounded-[12%] bg-ui-surface" />
      ) : isLoggedOut ? (
        // 비로그인은 프로필 사진 자리에 사람 모양 칸을 보여주고, 누르면 바로 로그인 창이 열린다.
        <button
          type="button"
          aria-label="로그인"
          data-hint="로그인"
          onClick={() => requireLogin(`${pathname}${search}${hash}`, { hideMessage: true })}
          className="relative -top-[2.5px] mr-0.5 flex size-[38px] items-center justify-center rounded-[12%] border-0 bg-ui-control p-0 text-ui-text transition-colors hover:bg-ui-control-hover"
        >
          <UserIcon aria-hidden="true" strokeWidth={1.25} className="size-[26px]" />
        </button>
      ) : (
      <div ref={profileMenuRef} className="relative flex h-16 items-center">
        <button
          ref={profileButtonRef}
          type="button"
          aria-label={isProfileMenuOpen ? '계정 메뉴 닫기' : '계정 메뉴 열기'}
          aria-expanded={isProfileMenuOpen}
          onClick={() => setIsProfileMenuOpen(open => !open)}
          className="relative -top-[2.5px] mr-0.5 size-[38px] overflow-hidden rounded-[12%] border-0 bg-transparent p-0 ring-2 ring-transparent hover:ring-ui-border focus-visible:outline-none focus-visible:ring-[var(--accent)]"
        >
          <ProfileAvatar className="size-full object-cover" />
        </button>
        {isProfileMenuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-md border border-ui-border bg-[var(--ui-panel)] pb-2 text-ui-white shadow-2xl shadow-ui-background/60">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-ui-muted">계정 확인 중...</p>
            ) : session?.authenticated ? (
              <>
                <div className="flex items-center gap-3 border-b border-ui-border px-4 py-3 text-sm">
                  <ProfileAvatar className="size-10 shrink-0 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{session.nickname || '내 계정'}</p>
                    <p className="mt-1 truncate text-ui-muted">{session.email || `사용자 ${session.userId}`}</p>
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
                {/* 로컬 개발 전용 — 테스트 회원일 때만 보이며, 누르면 로그아웃 없이 원래 계정으로 돌아온다(테스트 회원으로 바꾸는 버튼은 Admin 설정창에 있다). 운영 화면에는 나오지 않는다. */}
                {isLocalSignupEnabled() && isTestMember && (
                  <div className="mx-3 mt-2 border-t border-ui-border pt-2">
                    <button
                      type="button"
                      onClick={handleToggleTestMember}
                      disabled={isLoading || isDevSignupPending}
                      aria-pressed={isTestMember}
                      data-hint={isTestMember ? '지금 테스트 회원입니다. 누르면 로그아웃 없이 원래 계정으로 돌아갑니다.' : '누르면 로컬 DB에 새 USER 계정(테스트 회원)을 만들어 그 계정으로 바꿉니다.'}
                      className="h-7 w-full rounded-[5px] border-0 bg-[var(--brand-surface)] text-[13px] font-medium text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)] disabled:opacity-50"
                    >
                      {isDevSignupPending ? '전환 중…' : '개발 · 원래 계정으로 돌아가기'}
                    </button>
                    {devSignupError && <p role="alert" className="mt-1.5 text-xs text-status-error-ink">{devSignupError}</p>}
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
      )}
      </div>
      )}
      </div>
    </header>
  )
}
