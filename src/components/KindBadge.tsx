import { useEffect, useRef, useState } from 'react'
import { useTaxonomySelection } from '@/hooks/useTaxonomySelection'
import { FLASH_HOLD_MS } from '@/components/numberEffectTiming'

// 종목/업종 구분 배지 — 지도에서 업종 헤더·종목 박스를 우클릭했을 때 뜨는 팝업의 제목 앞 배지와 같은 모양이다.
// 설정창 위쪽의 "nn/nn종목" 개수 표시도 글자 대신 이 배지를 쓴다.
export type Kind = '종목' | '업종'

// onDark: 어두운 바탕(설정창)에서는 업종·종목 모두 분류 배지의 "분류" 칸과 같은 청록 채움에 흰 글자다. 팝업의 연한 바탕에서는 업종은 짙은 청록 채움, 종목은 회색 채움이고 둘 다 흰 글자다.
export default function KindBadge({ kind, onDark = false, className = '' }: { kind: Kind; onDark?: boolean; className?: string }) {
  const shape = onDark
    ? 'inline-flex items-center rounded bg-cyan-700 px-1.5 py-[3px] font-semibold text-white'
    : `rounded px-1.5 py-[3px] font-semibold text-white ${kind === '업종' ? 'bg-cyan-700' : 'bg-zinc-600'}`
  return (
    <span className={`shrink-0 text-xs leading-none ${shape} ${className}`}>
      {kind}
    </span>
  )
}

// "12/30종목" 같은 개수 글자를 "12/30 [종목]"(숫자가 앞, 배지가 바로 뒤)으로 그린다. 숫자의 천 단위 쉼표는 뺀다. 끝이 종목/업종이 아니면 글자 그대로 둔다.
// 분자가 바뀔 때 청록색으로 잠깐 보이게 하고, 숫자도 이전 값에서 새 값까지 올라가거나 내려가며 보여주는 훅 — 설정(제외 업종·구간 등)을 바꿔 숫자가 변했다는 신호다.
// 번쩍이지도 움직이지도 않는 경우: 처음 그릴 때, 분모가 같이 바뀔 때(시장 변경·데이터 로딩), 분류 기준을 바꾼 직후 1.5초(새 데이터가 도착하며 분자가 달라지는 때).
// 슬라이더처럼 연속으로 바뀌는 동안은 청록색을 유지하고(숫자는 지금 보이는 값에서 새 목표로 이어서 움직인다), 멈춘 뒤 1.5초 지나면 원래 색으로 돌아온다.
const FLASH_SUPPRESS_AFTER_TAXONOMY_MS = 1500
const COUNT_TWEEN_MS = 1000

function useCountChange(numerator: string, denominator: string) {
  const [taxonomy] = useTaxonomySelection()
  const [isFlashing, setIsFlashing] = useState(false)
  // 움직이는 중에 보여줄 숫자. null이면 받은 숫자를 그대로 보여준다.
  const [tweenValue, setTweenValue] = useState<number | null>(null)
  const previous = useRef<{ numerator: string; denominator: string; taxonomy: string } | null>(null)
  const suppressUntil = useRef(0)
  const timer = useRef<number | undefined>(undefined)
  const frame = useRef<number | undefined>(undefined)
  const shownValue = useRef<number | null>(null)

  useEffect(() => {
    const before = previous.current
    previous.current = { numerator, denominator, taxonomy }
    if (!before) return
    const stopTween = () => {
      if (frame.current === undefined) return
      window.cancelAnimationFrame(frame.current)
      frame.current = undefined
      shownValue.current = null
      setTweenValue(null)
    }
    if (before.taxonomy !== taxonomy) {
      suppressUntil.current = Date.now() + FLASH_SUPPRESS_AFTER_TAXONOMY_MS
      stopTween()
      return
    }
    if (before.denominator !== denominator || before.numerator === numerator) {
      if (before.denominator !== denominator) stopTween()
      return
    }
    if (Date.now() < suppressUntil.current) {
      stopTween()
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 값이 바뀐 순간에만 켜고 타이머로 끄는 일회성 시각 효과라 렌더 중에 계산할 수 없다
    setIsFlashing(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setIsFlashing(false), FLASH_HOLD_MS)

    const from = shownValue.current ?? Number(before.numerator)
    const to = Number(numerator)
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      stopTween()
      return
    }
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current)
    const startedAt = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / COUNT_TWEEN_MS)
      if (progress >= 1) {
        frame.current = undefined
        shownValue.current = null
        setTweenValue(null)
        return
      }
      const eased = 1 - (1 - progress) ** 3
      shownValue.current = from + (to - from) * eased
      setTweenValue(Math.round(shownValue.current))
      frame.current = window.requestAnimationFrame(step)
    }
    frame.current = window.requestAnimationFrame(step)
  }, [numerator, denominator, taxonomy])

  useEffect(() => () => {
    window.clearTimeout(timer.current)
    if (frame.current !== undefined) window.cancelAnimationFrame(frame.current)
  }, [])
  return { isFlashing, shownNumerator: tweenValue === null ? numerator : String(tweenValue) }
}

// "449/2741종목" → "449/2741 [종목]"(숫자가 앞, 배지가 바로 뒤). align이 end면 숫자와 배지를 칸의 오른쪽 끝에 붙인다.
// 배지는 글자 수가 같은(2글자) 종목/업종이라 칸 오른쪽 끝에서 항상 같은 자리에 오고, 숫자만 자릿수만큼 왼쪽으로 늘어난다.
export function CountLabelWithBadge({ label, alignEnd = false }: { label: string; alignEnd?: boolean }) {
  const match = /^(.*?)(종목|업종)$/.exec(label)
  const [numerator = '', denominator = ''] = (match?.[1] ?? '').replaceAll(',', '').split('/')
  const { isFlashing, shownNumerator } = useCountChange(numerator, denominator)
  if (!match) return <>{label}</>
  return (
    <span className={`items-center gap-1.5 ${alignEnd ? 'flex w-full justify-end' : 'inline-flex'}`}>
      <span>
        <span className={`tabular-nums transition-colors duration-500 ${isFlashing ? 'text-[var(--brand)]' : ''}`}>{shownNumerator}</span>
        {denominator && `/${denominator}`}
      </span>
      <KindBadge kind={match[2] as Kind} onDark />
    </span>
  )
}
