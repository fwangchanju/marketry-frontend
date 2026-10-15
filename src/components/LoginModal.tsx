import { useEffect } from 'react'
import { googleLoginUrl } from '@/api/auth'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'

interface Props {
  // 로그인 성공 후 백엔드가 돌려보낼 프론트 경로("/"로 시작). 로그인 팝업을 연 지점(메뉴 클릭,
  // 커스텀 모드 토글, 커스텀 페이지 직접 진입)의 목적지를 그대로 넘긴다.
  returnTo: string
  // true면 안내 문구를 보여주지 않는다(오른쪽 위 로그인 버튼으로 연 경우).
  hideMessage?: boolean
  onClose: () => void
}

// ScreenshotModal과 동일한 팝업 톤(어두운 배경 오버레이 + var(--surface) 패널, nes-btn 버튼)을
// 그대로 재사용한다 — 새 시각 스타일을 만들지 않는다. 강조 버튼도 기존 accent 토큰(노랑)만 쓰고
// 등락률 전용인 red/blue 계열(--stock-up/--stock-down/--negative)은 쓰지 않는다.
export default function LoginModal({ returnTo, hideMessage = false, onClose }: Props) {
  const mainAreaRect = useMainAreaRect(true)
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
    <div className="fixed inset-0 z-50 bg-black/70" onClick={onClose}>
      {/* 어두운 배경은 화면 전체를 덮고, 창은 메인 영역 안의 가운데에 놓는다(메인 영역이 없는 화면에서는 화면 가운데). */}
      <div
        className={`flex items-center justify-center ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
        style={mainAreaRect ? { left: mainAreaRect.left, top: mainAreaRect.top, width: mainAreaRect.width, height: mainAreaRect.height } : undefined}
      >
      <div
        className="w-[calc(100%-2rem)] max-w-sm select-none border border-gray-700 bg-[var(--surface)] p-6"
        onClick={e => e.stopPropagation()}
        onDragStart={e => e.preventDefault()}
      >
        <p className="text-lg font-bold text-white">로그인</p>
        {!hideMessage && (
          <p className="mt-2 text-sm text-[var(--accent)]">
            로그인 후 이용 가능합니다.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {/* 실제 페이지 이동(전체 새로고침)이어야 하므로 버튼 클릭 핸들러가 아니라 일반 링크로 연다 —
              XHR로 처리하면 쿠키를 세팅하는 리다이렉트 체인이 브라우저 주소창에서 진행되지 않는다. */}
          <a
            href={googleLoginUrl(returnTo)}
            aria-label="Google 로그인"
            className="relative flex items-stretch overflow-hidden rounded-lg bg-cyan-700 text-sm font-bold text-white transition-colors hover:bg-cyan-600"
          >
            {/* 구글 로고는 색을 바꾸지 않고 흰 칸 위에 그대로 둔다(구글 브랜드 규정). 흰 칸은 버튼 왼쪽 끝에 붙고 나머지는 청록 칸이다(분류 배지와 같은 두 칸 모양). */}
            <span aria-hidden="true" className="absolute inset-y-0 left-0 flex w-10 items-center justify-center bg-white">
              <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
            </span>
            <span className="w-full px-10 py-2 text-center">Google</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-0 bg-zinc-600 px-4 py-2 text-sm text-white transition-colors hover:bg-zinc-500"
          >
            닫기
          </button>
        </div>
        <a href="/privacy" className="mt-4 block text-center text-xs text-gray-500 hover:text-gray-300">
          개인정보처리방침
        </a>
      </div>
      </div>
    </div>
  )
}
