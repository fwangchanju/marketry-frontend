// 설정창 "등락률 색상"의 등락률 막대 — 0%부터 30%까지를 제곱근 눈금으로 그린다. 자주 쓰는 0~10% 구간이 막대의 약 60%를 차지해
// 손잡이가 덜 붙고 끌기 쉽다. 손잡이는 상승 구간의 경계(2/5/8/12% 등)이고, 하락 구간은 같은 값의 거울로만 정한다(대칭).
export const BAR_MIN_PERCENT = 1
export const BAR_MAX_PERCENT = 30
// 막대에 눈금 글자를 붙이는 값.
export const BAR_TICKS = [0, 2, 5, 10, 20, 30]

const SQRT_MAX = Math.sqrt(BAR_MAX_PERCENT)

// 값(%) → 막대 위 위치(0~1).
export function percentToPosition(percent: number): number {
  return Math.sqrt(Math.min(BAR_MAX_PERCENT, Math.max(0, percent))) / SQRT_MAX
}

// 막대 위 위치(0~1) → 값(%, 정수).
export function positionToPercent(position: number): number {
  const clamped = Math.min(1, Math.max(0, position))
  return Math.round((clamped * SQRT_MAX) ** 2)
}

// 손잡이는 이웃 손잡이를 넘거나 겹치지 못한다 — values는 작은 값부터 정렬된 경계들이고 rank번째 값을 wanted로 옮기려 할 때 허용되는 값으로 맞춘다.
export function clampBetweenNeighbors(values: readonly number[], rank: number, wanted: number): number {
  const min = rank === 0 ? BAR_MIN_PERCENT : values[rank - 1] + 1
  const max = rank === values.length - 1 ? BAR_MAX_PERCENT : values[rank + 1] - 1
  return Math.min(max, Math.max(min, Math.round(wanted)))
}
