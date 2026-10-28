import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSocialProviderAvailability, googleLoginUrl, kakaoLoginUrl, naverLoginUrl } from '@/api/auth'
import { GoogleLogoIcon, KakaoLogoIcon, NaverLogoIcon } from '@/components/icons/AppIcons'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'
import { useTestMemberToggle } from '@/hooks/useTestMemberToggle'
import { isLocalSignupEnabled } from '@/utils/localDevLogin'

interface Props {
  // 로그인 성공 후 백엔드가 돌려보낼 프론트 경로("/"로 시작). 로그인 팝업을 연 지점(메뉴 클릭,
  // 커스텀 모드 토글, 커스텀 페이지 직접 진입)의 목적지를 그대로 넘긴다.
  returnTo: string
  // true면 안내 문구를 보여주지 않는다(오른쪽 위 로그인 버튼으로 연 경우).
  hideMessage?: boolean
  loginError?: 'cancelled' | 'oauth_failed' | 'email_required' | null
  onClose: () => void
}

// ScreenshotModal과 같은 어두운 팝업 패널을 쓰고, 구글 로고의 원색이 보이도록 흰 배경으로 표시한다.
export default function LoginModal({ returnTo, hideMessage = false, loginError = null, onClose }: Props) {
  const mainAreaRect = useMainAreaRect(true)
  const googleLinkRef = useRef<HTMLAnchorElement>(null)
  const { data: providers } = useQuery({
    queryKey: ['auth', 'social-providers'],
    queryFn: getSocialProviderAvailability,
    retry: false,
    staleTime: 5 * 60_000,
  })
  // 로컬 서버에는 Google 로그인 설정이 없어(503) 버튼이 막다른 길이라, 로컬 화면에서는 관리자 계정으로 바로 로그인한다. 운영에는 영향이 없다.
  const isLocalDev = isLocalSignupEnabled()
  const { isPending: isDevLoginPending, error: devLoginError, loginAs } = useTestMemberToggle()
  // 확인창처럼 열리자마자 주 버튼에 포커스를 둬서 Enter로 바로 로그인하고 Tab으로 닫기로 넘어간다. 링크에는 autoFocus가 듣지 않아 직접 옮긴다.
  useEffect(() => { googleLinkRef.current?.focus() }, [])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 bg-ui-background/70" onClick={onClose}>
      {/* 가로는 메인 영역 가운데, 세로는 NXT 안내창처럼 전체 화면 가운데에 놓는다. */}
      <div
        className={`flex items-center justify-center ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
        style={mainAreaRect ? { left: mainAreaRect.left, top: 0, width: mainAreaRect.width, height: '100dvh' } : undefined}
      >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        className="w-[calc(100%-2rem)] max-w-sm select-none border border-ui-border bg-[var(--surface)] p-6 max-[767px]:max-h-[calc(100dvh-32px)] max-[767px]:overflow-y-auto max-[767px]:p-5"
        onClick={e => e.stopPropagation()}
        onDragStart={e => e.preventDefault()}
      >
        <p id="login-modal-title" className="text-lg font-bold text-ui-white max-[767px]:text-[18px]">로그인</p>
        {!hideMessage && (
          <p className="mt-2 text-sm text-[var(--accent)] max-[767px]:text-[14px]">
            로그인 후 이용 가능합니다.
          </p>
        )}
        {loginError && (
          <p role="alert" className="mt-2 text-sm text-status-error-text max-[767px]:text-[14px]">
            {loginError === 'cancelled'
              ? '로그인이 취소되었습니다.'
              : loginError === 'email_required'
                ? '이메일 제공에 동의해야 로그인할 수 있습니다.'
                : '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {/* 실제 페이지 이동(전체 새로고침)이어야 하므로 버튼 클릭 핸들러가 아니라 일반 링크로 연다 —
              XHR로 처리하면 쿠키를 세팅하는 리다이렉트 체인이 브라우저 주소창에서 진행되지 않는다. */}
          <a
            href={googleLoginUrl(returnTo)}
            ref={googleLinkRef}
            onClick={isLocalDev ? event => { event.preventDefault(); if (!isDevLoginPending) void loginAs('admin') } : undefined}
            aria-label="구글 로그인"
            className="relative flex items-stretch overflow-hidden rounded-lg bg-ui-white text-sm font-bold text-[#202124] transition-colors hover:bg-[#f1f3f4] max-[767px]:min-h-[44px] max-[767px]:items-center max-[767px]:text-[14px]"
          >
            <span aria-hidden="true" className="absolute inset-y-0 left-0 flex w-10 items-center justify-center">
              <GoogleLogoIcon className="h-3.5 w-3.5" />
            </span>
            <span className="w-full px-10 py-2 text-center">구글</span>
          </a>
          {providers?.naver && (
            <a
              href={naverLoginUrl(returnTo)}
              aria-label="네이버 로그인"
              className="relative flex items-stretch overflow-hidden rounded-lg bg-[#03a94d] text-sm font-bold text-white transition-opacity hover:opacity-85 max-[767px]:min-h-[44px] max-[767px]:items-center max-[767px]:text-[14px]"
            >
              <span aria-hidden="true" className="absolute inset-y-0 left-0 flex w-10 items-center justify-center">
                <NaverLogoIcon className="h-3 w-3 text-white" />
              </span>
              <span className="w-full px-10 py-2 text-center">네이버</span>
            </a>
          )}
          {providers?.kakao && (
            <a
              href={kakaoLoginUrl(returnTo)}
              aria-label="카카오 로그인"
              className="relative flex items-stretch overflow-hidden rounded-lg bg-[#fee500] text-sm font-bold text-[#191919] transition-opacity hover:opacity-85 max-[767px]:min-h-[44px] max-[767px]:items-center max-[767px]:text-[14px]"
            >
              <span aria-hidden="true" className="absolute inset-y-0 left-0 flex w-10 items-center justify-center">
                <KakaoLogoIcon className="h-3.5 w-3.5" />
              </span>
              <span className="w-full px-10 py-2 text-center">카카오</span>
            </a>
          )}
          {devLoginError && <p role="alert" className="m-0 text-xs text-status-error-ink">{devLoginError}</p>}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-0 bg-ui-control px-4 py-2 text-sm text-ui-white transition-colors hover:bg-ui-control-hover max-[767px]:min-h-[44px] max-[767px]:text-[14px]"
          >
            닫기
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-ui-muted max-[767px]:text-[12px]">
          <a href="/info/terms" className="hover:text-ui-text">
            이용약관
          </a>
          {' · '}
          <a href="/info/privacy" className="hover:text-ui-text">
            개인정보처리방침
          </a>
        </p>
      </div>
      </div>
    </div>
  )
}
