// 신규 상장 랭킹 막대만 ±10% 안쪽을 그대로 두고, 그 너머의 길이는 10% 비율로 압축한다.
// 큰 값은 10% 지점에서 간격을 두고 압축 구간을 이어 그린다. 사선은 쓰지 않는다.
// 숫자 라벨과 순위는 원래 등락률을 사용하며 양·음 값에 같은 규칙을 쓴다.
const RATE_AXIS_BREAK = 10
const EXTREME_RATE_COMPRESSION = 0.1

export const RANK_AXIS_BREAK = RATE_AXIS_BREAK
export const RANK_AXIS_BREAK_CUT_PX = 8
export const RANK_AXIS_BREAK_BRIDGE_PX = 6
// 가운데 막대는 양쪽 테두리 1px씩을 포함해 6px로 그려 내부 색상이 4px 남는다.
// 빈틈 8px + 막대 6px + 빈틈 8px.
export const RANK_AXIS_BREAK_GAP_PX = RANK_AXIS_BREAK_CUT_PX * 2 + RANK_AXIS_BREAK_BRIDGE_PX

export function rankAxisMagnitude(magnitude: number): number {
  if (magnitude <= RATE_AXIS_BREAK) return magnitude
  return RATE_AXIS_BREAK + (magnitude - RATE_AXIS_BREAK) * EXTREME_RATE_COMPRESSION
}
