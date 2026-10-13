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
}

export default function Spinner({ className, showElapsed = false, showLogo = false, errorMessage, onRetry, message }: Props) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!showElapsed && !showLogo) return
    const startedAt = Date.now()
    const timer = window.setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [showElapsed, showLogo])

  // 로딩·오류 화면의 모든 크기(테두리·로고·글자·버튼 여백)는 원 너비에 대한 비율이다. 메인 영역의 큰 원(320px)을 기준으로 정했고,
  // 달력처럼 작은 원도 같은 비율로 줄어 로고·문구·숫자·버튼의 배치가 어느 크기에서나 같다.
  if (errorMessage) {
    return (
      <div role="alert" className={`@container relative ${className ?? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]'}`}>
        <div className="absolute inset-0 rounded-full border-[1.9cqw] border-gray-600" />
        <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
          <div />
          {/* 로딩 화면(안내 문구 없음)과 같은 로고 크기·같은 칸·같은 아래 여백이라, 오류 문구가 경과 시간 숫자가 있던 바로 그 자리에 놓인다. */}
          <MarketryLogo className="h-auto w-[84%]" />
          <div className="flex flex-col items-center justify-center gap-1 pb-[10cqw]">
            <span className="relative text-center text-[5.5cqw] leading-tight text-white">
              {errorMessage}
              {/* 버튼은 문구 아래에 띄워 둔다 — 문구가 숫자 자리에서 밀리지 않게 한다. 평소에는 안이 강조색으로 채워진 검정 글자이고, 마우스를 올리면 안이 비고 강조색 테두리·글자가 된다. */}
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="absolute left-1/2 top-full mt-[4.7cqw] -translate-x-1/2 whitespace-nowrap rounded border border-[var(--brand)] bg-[var(--brand)] px-[2.2cqw] py-[0.6cqw] text-[3.75cqw] font-bold text-black transition-colors hover:bg-transparent hover:text-[var(--brand)]"
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
  const isThin = !showElapsed
  return (
    <div role="status" aria-label={showElapsed ? '데이터를 불러오는 중입니다.' : '설정 처리 중'} className={`@container relative ${className ?? (showElapsed ? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]' : 'h-24 w-24')}`}>
      <div aria-hidden="true" className={`absolute inset-0 animate-spin rounded-full border-gray-600 border-t-[var(--brand)] ${isThin ? 'border-[3px]' : 'border-[1.9cqw]'}`} />
      <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
        <div />
        <MarketryLogo className={`h-auto ${message ? 'w-[72%]' : 'w-[84%]'}`} />
        {/* pb-[10cqw]로 숫자를 칸 한가운데보다 조금 위에 둔다. */}
        <div className="flex flex-col items-center justify-center gap-1 pb-[10cqw]">
          {message && <span className={`leading-tight text-gray-300 ${isThin ? 'text-base' : 'text-[5.5cqw]'}`}>{message}</span>}
          {/* 숫자 크기는 원 너비에 비례한다(큰 원 기준 5.5%). 설정창의 얇은 원은 작아서 11px 밑으로 내려가지 않게 한다. */}
          <span className={`min-h-[1em] leading-none tabular-nums text-gray-300 ${isThin ? 'text-[clamp(11px,7cqw,28px)]' : 'text-[5.5cqw]'}`}>{elapsedSeconds >= 1 ? elapsedSeconds : ''}</span>
        </div>
      </div>
    </div>
  )
}
