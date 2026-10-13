import { useEffect, useState } from 'react'
import MarketryLogo from '@/components/MarketryLogo'

interface Props {
  className?: string
  // true면 아주 큰 원 안에 로고와 경과 시간(숫자)을 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있게 한다.
  // 시간은 1초가 지난 뒤부터 보인다.
  showElapsed?: boolean
  // 설정창처럼 좁은 영역에서는 얇은 원 안에 로고와 경과 시간(숫자)만 표시한다.
  showLogo?: boolean
  // 데이터를 불러오지 못했을 때 — 로딩 화면과 같은 자리·크기로 로고 아래에 이 문구를 보여준다(원은 돌지 않고 시간도 없다).
  errorMessage?: string
  // 오류 화면에서 문구 아래에 "다시 시도" 버튼을 보여 준다 — 서버가 회복돼도 화면이 저절로 다시 불러오지는 않으므로 직접 누르게 한다.
  onRetry?: () => void
  // showElapsed 로딩에서 로고 위쪽에 따로 보여 줄 안내 문구 — 없으면 문구 없이 로고와 경과 시간(숫자)만 보인다.
  message?: string
  // 로딩·오류를 좁은 영역(캘린더 등)에 맞춰 얇은 테두리·작은 글자로 그린다.
  compact?: boolean
}

export default function Spinner({ className, showElapsed = false, showLogo = false, errorMessage, onRetry, message, compact = false }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!showElapsed && !showLogo) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed, showLogo])

  if (errorMessage) {
    return (
      <div role="alert" className={`@container relative ${className ?? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]'}`}>
        <div className={`absolute inset-0 rounded-full border-gray-600 ${compact ? 'border-[3px]' : 'border-[6px]'}`} />
        <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
          <div />
          {/* 로딩 화면(안내 문구 없음)과 같은 로고 크기·같은 칸·같은 아래 여백이라, 오류 문구가 경과 시간 숫자가 있던 바로 그 자리에 놓인다.
              compact(달력)는 원이 작아 문구와 버튼이 들어갈 자리를 더 주려고 로고를 줄이고 버튼을 작게 그린다. */}
          <MarketryLogo className={`h-auto ${compact ? 'w-[56%]' : 'w-[84%]'}`} />
          <div className={`flex flex-col items-center justify-center gap-1 ${compact ? 'pb-[8cqw]' : 'pb-[10cqw]'}`}>
            {/* 문구 크기도 경과 시간 숫자와 같이 원 너비에 비례한다(큰 원 기준 5.5%, 11~24px). */}
            <span className="relative text-center text-[clamp(11px,5.5cqw,24px)] leading-tight text-gray-300">
              {errorMessage}
              {/* 버튼은 문구 아래에 띄워 둔다 — 문구가 숫자 자리에서 밀리지 않게 한다. 평소에도 강조색 테두리·글자이고, 마우스를 올리면 안을 강조색으로 채운다. */}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className={`absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap ${compact ? 'mt-[13px]' : 'mt-[15px]'} rounded border border-[var(--brand)] bg-transparent text-[var(--brand)] font-semibold transition-colors hover:bg-[var(--brand)] hover:text-black ${compact ? 'px-2 py-px text-[11px]' : 'px-3 py-0.5 text-xs'}`}
                >
                  다시 시도
                </button>
              )}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (!showElapsed && !showLogo) {
    return <div className={`animate-spin rounded-full border-2 border-gray-600 border-t-[var(--brand)] ${className ?? 'h-8 w-8'}`} />
  }

  // 시간을 보여주는 로딩은 화면 한가운데에서 오래 보게 되므로 원을 아주 크게(작은 화면에서는 화면 짧은 변의 60%까지) 그린다.
  // 숫자와 로고가 같이 돌지 않도록 도는 테두리와 안쪽 내용을 따로 겹쳐 놓는다.
  // 안쪽은 [빈 칸 / 로고 / 문구·숫자]의 3줄 격자다. 위·아래 빈 칸이 같은 크기(1fr)라 로고가 원의 정확한 가운데에 오고,
  // 숫자(경과 초)는 로고 아래 칸(로고 아래쪽 끝~원 아래쪽 끝)의 한가운데보다 조금 위에 놓인다. 문구는 message를 줄 때만 숫자 위에 붙는다.
  // 설정창처럼 좁은 영역(showLogo만 준 경우)은 얇은 테두리·작은 글자로 같은 모양을 그린다.
  const isThin = compact || !showElapsed
  return (
    <div role="status" aria-label={showElapsed ? '데이터를 불러오는 중입니다.' : '설정 처리 중'} className={`@container relative ${className ?? (showElapsed ? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]' : 'h-24 w-24')}`}>
      <div aria-hidden="true" className={`absolute inset-0 animate-spin rounded-full border-gray-600 border-t-[var(--brand)] ${isThin ? 'border-[3px]' : 'border-[6px]'}`} />
      <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
        <div />
        <MarketryLogo className={`h-auto ${compact ? 'w-[56%]' : message ? 'w-[72%]' : 'w-[84%]'}`} />
        {/* pb-[10cqw]로 숫자를 칸 한가운데보다 조금 위에 둔다. */}
        <div className="flex flex-col items-center justify-center gap-1 pb-[10cqw]">
          {message && <span className={`leading-tight text-gray-300 ${isThin ? 'text-base' : 'text-[clamp(11px,5.5cqw,24px)]'}`}>{message}</span>}
          {/* 숫자 크기는 원 너비에 비례한다(원이 작아도 11px 밑으로는 내려가지 않는다). 큰 원(메인 영역)은 숫자가 두드러지지 않게 더 작게 그린다. */}
          <span className={`min-h-[1em] leading-none tabular-nums text-gray-300 ${isThin ? 'text-[clamp(11px,7cqw,28px)]' : 'text-[clamp(11px,5.5cqw,24px)]'}`}>{elapsedSeconds >= 1 ? elapsedSeconds : ''}</span>
        </div>
      </div>
    </div>
  )
}
