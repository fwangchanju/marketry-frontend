// 등락률 랭킹 그래프는 ±10% 안쪽을 그대로 두고, 그 너머의 막대 길이는 20% 비율로 압축한다.
// 숫자 라벨과 순위는 원래 등락률을 사용한다. 양·음 값에 같은 규칙을 쓰며 축을 나타내는 사선은 그리지 않는다.
const RATE_AXIS_BREAK = 10
const EXTREME_RATE_COMPRESSION = 0.2
const EXTREME_AXIS_HEADROOM = 3

export function rankAxisMagnitude(magnitude: number): number {
  if (magnitude <= RATE_AXIS_BREAK) return magnitude
  return RATE_AXIS_BREAK + (magnitude - RATE_AXIS_BREAK) * EXTREME_RATE_COMPRESSION
}

export function rankAxisMaximum(rawAxisMaximum: number): number {
  const compressedMaximum = rankAxisMagnitude(rawAxisMaximum)
  return compressedMaximum + (rawAxisMaximum > RATE_AXIS_BREAK ? EXTREME_AXIS_HEADROOM : 0)
}
