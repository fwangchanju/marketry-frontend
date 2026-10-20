import { useEffect, useState, type ReactNode } from 'react'
import MarketryLogo from '@/components/MarketryLogo'

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
  // 관리자 메인처럼 불러오는 작업이 없는 정적 표시.
  still?: boolean
  stillContent?: ReactNode
}

export default function Spinner({ className, showElapsed = false, centerContent = false, showLogo = false, errorMessage, onRetry, message, still = false, stillContent }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const isLoading = !still && !errorMessage

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
      className={`@container relative ${sizeClass}`}
    >
      <div aria-hidden="true" className={`absolute inset-0 rounded-full border-[1.9cqw] border-ui-border ${isLoading ? 'animate-spin border-t-[var(--brand)]' : ''}`} />
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
            <span aria-hidden="true" className="text-[5.5cqw] leading-none tabular-nums text-ui-text">{elapsedSeconds >= 1 ? elapsedSeconds : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
