import { useEffect, useState, type ReactNode } from 'react'
import MarketryLogo from '@/components/MarketryLogo'

// 모바일 810px 판 안에서 쓰는 로딩 원 크기(2026-11-22 사용자 결정). 판이 화면 폭의 390/810으로 줄어들어 판 안 499px가 화면 240px로 보인다.
// 이 앱은 루트 글자 크기가 12.8px라 rem 대신 px로 지정한다(128vmin은 390px 화면에서 499px).
// 한국 업종·그룹과 일본·미국 서머리·그래프의 모바일 로딩원이 같은 크기가 되도록 이 상수를 공유한다(PC 로딩원은 기본 크기 유지).
export const MOBILE_LOADING_SIZE_CLASS = 'h-[min(499px,128vmin)] w-[min(499px,128vmin)]'

interface Props {
  className?: string
  // 1초 뒤부터 경과 시간을 보여 주는 메인 영역 로딩.
  showElapsed?: boolean
  // 배지나 프레임 등 기준점의 정중앙에 로고와 경과 시간을 둔다.
  centerContent?: boolean
  // 설정창처럼 좁은 공간의 로고·경과 시간 표시.
  showLogo?: boolean
  errorMessage?: string
  onRetry?: () => void
  message?: string
  // 페이지를 열 때의 로딩원만 켠다 — LOADING_REVEAL_DELAY_MS 동안 숨겨 짧은 로딩의 깜빡임을 없앤다.
  delayReveal?: boolean
  // 관리자 메인처럼 불러오는 작업이 없는 정적 표시.
  still?: boolean
  stillContent?: ReactNode
}

// 페이지를 열 때의 로딩원(delayReveal)은 이 시간 동안 자리만 잡고 숨긴다. 금방 끝나는 로딩에서 원이 잠깐 비쳤다 사라지는 깜빡임을 없앤다
// (2026-11-27 사용자 결정 0.5초, 운영 PC 실측 0.14~0.39초). 버튼으로 시작하는 작업(캡처·게시·엑셀·달력·텔레그램·되돌리기)은
// 누른 반응이 바로 보여야 하므로 쓰지 않는다(같은 날 사용자 결정). 오류·정지 표시는 바로 보인다. 경과 초는 처음부터 센다.
export const LOADING_REVEAL_DELAY_MS = 500

export default function Spinner({ className, showElapsed = false, centerContent = false, showLogo = false, errorMessage, onRetry, message, still = false, stillContent, delayReveal = false }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const isLoading = !still && !errorMessage
  const delaysReveal = isLoading && showElapsed && delayReveal
  const [revealed, setRevealed] = useState(!delaysReveal)
  useEffect(() => {
    if (!delaysReveal) return
    const timer = window.setTimeout(() => setRevealed(true), LOADING_REVEAL_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [delaysReveal])

  useEffect(() => {
    if (!isLoading || (!showElapsed && !showLogo)) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed, showLogo, isLoading])

  // 버튼 안의 작은 진행 표시는 글자를 읽을 공간이 없으므로 링만 쓴다.
  if (isLoading && !showElapsed && !showLogo) {
    return <div role="status" aria-label="처리 중" className={`animate-spin rounded-full border-2 border-ui-border border-t-[var(--brand)] ${className ?? 'h-8 w-8'}`} />
  }

  const sizeClass = className ?? (showLogo ? 'h-24 w-24' : 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]')

  // 원·심볼·로고·슬로건·상태 표시가 모두 원 너비(cqw)에 비례한다.
  // 로딩 숫자와 오류 버튼은 높이가 같은 상태 칸을 공유해 전환해도 로고가 움직이지 않는다.
  return (
    <div
      role={still ? undefined : errorMessage ? 'alert' : 'status'}
      aria-label={still ? 'MARKETRY' : errorMessage ?? message ?? (showElapsed ? '데이터를 불러오는 중입니다.' : '설정 처리 중')}
      className={`@container relative ${sizeClass} ${delaysReveal && !revealed ? 'invisible' : ''}`}
    >
      {/* 회전하는 사각 경계가 부모의 스크롤 영역을 늘리지 않도록 링만 고정 영역 안에서 자른다. */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full">
        <div className={`absolute inset-0 rounded-full border-[1.9cqw] border-ui-border ${isLoading ? 'animate-spin border-t-[var(--brand)]' : ''}`} />
      </div>
      {message && isLoading && (
        <span className="absolute inset-x-[12%] top-[8%] text-center text-[4.25cqw] leading-tight text-ui-text">{message}</span>
      )}
      <div className={`absolute inset-0 flex flex-col items-center justify-center gap-[5cqw] ${centerContent ? '' : 'translate-y-[2cqw]'}`}>
        <MarketryLogo layout="stacked" className="h-auto w-[76%]" />
        <div className="relative flex h-[5.5cqw] w-full translate-y-[2cqw] shrink-0 items-center justify-center">
          {errorMessage ? (
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded border-0 bg-[var(--brand-surface)] px-[2.6cqw] py-[0.8cqw] text-[4.25cqw] font-bold text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)]"
              >
                다시 시도
              </button>
            ) : (
              <span className="absolute left-1/2 top-1/2 w-[76%] -translate-x-1/2 -translate-y-1/2 text-center text-[4.25cqw] leading-tight text-ui-white">{errorMessage}</span>
            )
          ) : still ? stillContent : (
            <span aria-hidden="true" className="text-[max(16px,5.5cqw)] leading-none tabular-nums text-ui-text">{elapsedSeconds >= 1 ? elapsedSeconds : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
