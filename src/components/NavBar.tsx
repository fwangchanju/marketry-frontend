import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession, useLogout, useSessionKeepAlive, useLocalDevLogin } from '@/hooks/useSession'
import { useLoginGate } from '@/hooks/useLoginGate'
import ProfileAvatar from '@/components/ProfileAvatar'
import { UserIcon } from '@/components/icons/AppIcons'
import MarketryLogo from '@/components/MarketryLogo'
import { devLogin, devSignup } from '@/api/auth'
import { settleSessionRefresh } from '@/api/client'
import { cancelPendingPreferenceSave } from '@/hooks/useCustomPreferences'
import { isLocalSignupEnabled, isTestMemberActive, setTestMemberActive } from '@/utils/localDevLogin'

// 모든 페이지에서 항상 똑같이 고정되는 최상단 바 — 홈 이동과 로그인 상태/프로필 메뉴를 담당한다.
// 로그인 버튼은 NavSubBar 우측 "일괄변경"류 accent 버튼(nes-btn + var(--accent))과 같은 톤을 쓰고,
// 로그인한 사용자는 우측 아바타에서 계정 메뉴를 연다.
// 등락률 전용 색(--stock-up/--stock-down/--negative, 즉 red/blue 계열)은 쓰지 않는다.
// hideAccount가 true면 오른쪽의 로그인 버튼/프로필 아이콘을 숨기고 로고만 보여준다(비로그인이 프로필 페이지에 들어왔을 때).
export default function NavBar({ hideAccount = false }: { hideAccount?: boolean }) {
  const { data: session, isLoading } = useSession()
  const { pathname, search, hash } = useLocation()
  const { requireLogin } = useLoginGate()
  const logout = useLogout()
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isDevSignupPending, setIsDevSignupPending] = useState(false)
  const [devSignupError, setDevSignupError] = useState<string | null>(null)
  // 로컬 전용 "테스트" 버튼 — 눌러서 테스트 회원으로 바꾸고, 다시 누르면 로그아웃 없이 원래 계정으로 돌아온다.
  const [isTestMember] = useState(isTestMemberActive)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileButtonRef = useRef<HTMLButtonElement>(null)
  useLocalDevLogin()
  // 세션 확인이 끝났고 로그인하지 않은 상태 — 확인 중(isLoading)에는 깜빡임 없이 프로필 아이콘을 유지한다.
  const isLoggedOut = !isLoading && !session?.authenticated
  // dev-login도 구글 로그인과 같은 15분짜리 접근 토큰을 발급하므로, localAutoLogin 여부와 무관하게
  // 로그인 상태면 동일하게 선제 갱신한다.
  useSessionKeepAlive((session?.authenticated ?? false) && !isDevSignupPending)

  const handleToggleTestMember = async () => {
    setIsDevSignupPending(true)
    setDevSignupError(null)
    cancelPendingPreferenceSave()
    try {
      await settleSessionRefresh()
      if (isTestMember) {
        await devLogin()
        setTestMemberActive(false)
      } else {
        await devSignup()
        setTestMemberActive(true)
      }
      // 현재 화면을 다시 열어 이전 회원의 캐시를 비우고, 비회원 확인 모드만 해제한다.
      const currentUrl = new URL(window.location.href)
      currentUrl.searchParams.set('guest', '0')
      window.location.assign(currentUrl.href)
    } catch {
      setDevSignupError(isTestMember ? '전환 실패: 원래 계정으로 돌아가지 못했습니다.' : '생성 실패: 백엔드 local 프로필을 확인하세요.')
      setIsDevSignupPending(false)
    }
  }

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
// 메뉴가 열려 있는 동안은 헤더 배경을 위쪽 53px만 칠한다 — 헤더(64px)가 아래 메뉴 줄의 글자 윗부분(53px부터 시작)을 덮어서 글자가 잘려 보이던 것을 막는다. 그 아래 구간은 메뉴 줄 자신의 배경(같은 색)이 칠한다.
  return (
    <header className={`sticky top-0 flex h-16 items-center justify-between px-4 ${isProfileMenuOpen ? 'z-40 bg-[linear-gradient(to_bottom,#18181b_53px,transparent_53px)]' : 'z-20 bg-zinc-900'}`}>
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
      <div className="flex justify-end">
      {isLoggedOut ? (
        // 비로그인은 프로필 사진 자리에 사람 모양 칸을 보여주고, 누르면 바로 로그인 창이 열린다.
        <button
          type="button"
          aria-label="로그인"
          data-hint="로그인"
          onClick={() => requireLogin(`${pathname}${search}${hash}`, { hideMessage: true })}
          className="relative -top-[2.5px] mr-0.5 flex size-[38px] items-center justify-center rounded-[12%] border-0 bg-zinc-600 p-0 text-gray-300 transition-colors hover:bg-zinc-500"
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
          className="relative -top-[2.5px] mr-0.5 size-[38px] overflow-hidden rounded-[12%] ring-2 ring-transparent hover:ring-zinc-400 focus-visible:outline-none focus-visible:ring-[var(--accent)]"
        >
          <ProfileAvatar className="size-full object-cover" />
        </button>
        {isProfileMenuOpen && (
          <div className="absolute right-0 top-full z-30 -mt-2 w-64 overflow-hidden rounded-md border border-zinc-400 bg-[var(--panel-gray)] pb-2 text-zinc-900 shadow-2xl shadow-black/60">
            {isLoading ? (
              <p className="px-4 py-3 text-sm text-zinc-600">계정 확인 중...</p>
            ) : session?.authenticated ? (
              <>
                <div className="flex items-center gap-3 border-b border-zinc-400 px-4 py-3 text-sm">
                  <ProfileAvatar className="size-10 shrink-0 object-cover" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{session.nickname || '내 계정'}</p>
                    <p className="mt-1 truncate text-zinc-600">{session.email || `사용자 ${session.userId}`}</p>
                  </div>
                </div>
                {/* 메뉴는 설정창 위에 겹쳐도 구분되도록 밝은 틀로 두고, 프로필·로그아웃은 설정창 선택 칸과 같은 검정 버튼 두 개를 나란히 놓고, 개발 전용 항목만 청록이다. */}
                <div className="flex gap-2 px-3 pb-1 pt-2.5">
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex-1 rounded-lg bg-zinc-800 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus:bg-zinc-700"
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
                    className="flex-1 rounded-lg border-0 bg-zinc-800 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 focus:bg-zinc-700 disabled:opacity-50"
                  >
                    로그아웃
                  </button>
                </div>
                {/* 로컬 개발 전용 — 누르면 로컬 DB에 새 USER 계정(테스트 회원)을 만들어 그 계정으로 바꾸고, 다시 누르면 로그아웃 없이 원래 계정으로 돌아온다. 운영 화면에는 나오지 않는다. */}
                {isLocalSignupEnabled() && (
                  <div className="mx-3 mt-2 border-t border-zinc-400 pt-2">
                    <button
                      type="button"
                      onClick={handleToggleTestMember}
                      disabled={isLoading || isDevSignupPending}
                      aria-pressed={isTestMember}
                      data-hint={isTestMember ? '지금 테스트 회원입니다. 누르면 로그아웃 없이 원래 계정으로 돌아갑니다.' : '누르면 로컬 DB에 새 USER 계정(테스트 회원)을 만들어 그 계정으로 바꿉니다.'}
                      className="w-full rounded-lg border-0 bg-cyan-700 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-600 disabled:opacity-50"
                    >
                      {isDevSignupPending ? '전환 중…' : isTestMember ? '개발 · 원래 계정으로 돌아가기' : '개발 · 테스트 회원으로 전환'}
                    </button>
                    {devSignupError && <p role="alert" className="mt-1.5 text-xs text-red-700">{devSignupError}</p>}
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
