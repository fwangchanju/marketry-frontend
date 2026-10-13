import { useEffect, useState } from 'react'
import MarketryLogo from '@/components/MarketryLogo'

interface Props {
  className?: string
  // true면 아주 큰 원 안에 로고와 경과 시간(숫자)을 보여준다 — 오래 걸려도 "진행 중"임을 알 수 있게 한다.
  // 시간은 1초가 지난 뒤부터 보인다.
  showElapsed?: boolean
  // 설정창처럼 좁은 영역에서는 얇은 원 안에 로고와 경과 시간(숫자)만 표시한다.
  showLogo?: boolean
  // 데이터를 불러오지 못했을 때 — 로딩 화면과 같은 자리·크기의 원(돌지 않는다)을 그린다. 이 문구는 onRetry가 없을 때만 화면에 적고, 버튼이 있으면 스크린 리더용 aria-label에만 둔다.
  errorMessage?: string
  // 오류 화면에서 경과 시간 숫자가 있던 자리에 "다시 시도" 버튼을 보여 준다 — 서버가 회복돼도 화면이 저절로 다시 불러오지는 않으므로 직접 누르게 한다.
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
      <div role="alert" aria-label={errorMessage} className={`@container relative ${className ?? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]'}`}>
        <div className="absolute inset-0 rounded-full border-[1.9cqw] border-gray-600" />
        <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
          <div />
          {/* 로딩 화면(안내 문구 없음)과 같은 로고 크기·같은 칸·같은 아래 여백(14%)이라, "다시 시도" 버튼이 경과 시간 숫자가 있던 바로 그 자리에 놓인다. 오류 문구는 화면에 적지 않고(스크린 리더용으로만 role="alert"의 aria-label에 둔다),
              onRetry가 없는 곳만 버튼이 없어 아무것도 알 수 없으므로 그때는 문구를 보여 준다. */}
          <div className="flex flex-col items-center justify-center pb-[14cqw]">
            {onRetry ? (
              // 색은 설정창의 "적용" 버튼·확인 팝업의 확인 버튼과 같다(청록 채움 + 흰 글자, 마우스를 올리면 한 단계 밝아짐).
              <button
                type="button"
                onClick={onRetry}
                className="whitespace-nowrap rounded border-0 bg-cyan-700 px-[2.6cqw] py-[0.8cqw] text-[4.25cqw] font-bold text-white transition-colors hover:bg-cyan-600"
              >
                다시 시도
              </button>
            ) : (
              <span className="text-center text-[5.5cqw] leading-tight text-white">{errorMessage}</span>
            )}
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
  // 설정창(showLogo만 준 경우)도 같은 비율로 같은 모양을 그린다. 원이 아주 작으면(수십 px) 글자가 읽히지 않으므로 그런 곳은 로고 없는 작은 링(옵션 없음)을 쓴다.
  return (
    <div role="status" aria-label={showElapsed ? '데이터를 불러오는 중입니다.' : '설정 처리 중'} className={`@container relative ${className ?? (showElapsed ? 'h-[min(20rem,60vmin)] w-[min(20rem,60vmin)]' : 'h-24 w-24')}`}>
      <div aria-hidden="true" className={`absolute inset-0 animate-spin rounded-full border-gray-600 border-t-[var(--brand)] border-[1.9cqw]`} />
      <div className="absolute inset-0 grid grid-rows-[1fr_auto_1fr] justify-items-center">
        <div />
        <MarketryLogo className={`h-auto ${message ? 'w-[72%]' : 'w-[84%]'}`} />
        {/* pb-[14cqw]로 숫자를 칸 한가운데보다 조금 위에 둔다. 오류 화면의 문구와 같은 값이라 숫자와 문구가 같은 높이에 온다. */}
        <div className="flex flex-col items-center justify-center gap-1 pb-[14cqw]">
          {message && <span className={`leading-tight text-gray-300 text-[5.5cqw]`}>{message}</span>}
          {/* 숫자 크기는 원 너비에 비례한다(큰 원 기준 5.5%). */}
          <span className={`min-h-[1em] leading-none tabular-nums text-gray-300 text-[5.5cqw]`}>{elapsedSeconds >= 1 ? elapsedSeconds : ''}</span>
        </div>
      </div>
    </div>
  )
}
