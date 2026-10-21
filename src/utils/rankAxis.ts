// 신규 상장 이외 항목의 최대 등락폭(상승·하락 모두)까지는 그대로 두고, 그 너머의 길이만 10% 비율로 압축한다.
// 큰 값은 해당 상승률 지점에서 간격을 두고 압축 구간을 이어 그린다. 사선은 쓰지 않는다.
// 숫자 라벨과 순위는 원래 등락률을 사용한다.
const EXTREME_RATE_COMPRESSION = 0.1

export const RANK_AXIS_BREAK_CUT_PX = 6
export const RANK_AXIS_BREAK_BRIDGE_PX = 8
// 가운데 막대는 양쪽 테두리 1px씩을 포함해 8px로 그려 내부 색상이 6px 남아, 눈에 보이는 폭이 빈틈 6px과 같다.
// 빈틈 6px + 막대 8px + 빈틈 6px.
export const RANK_AXIS_BREAK_GAP_PX = RANK_AXIS_BREAK_CUT_PX * 2 + RANK_AXIS_BREAK_BRIDGE_PX

export function rankAxisBreakAt(items: readonly { sectorName: string; value: number; hiddenCount?: number }[]): number {
  return Math.max(0, ...items.filter(item => item.hiddenCount === undefined && item.sectorName !== '신규 상장').map(item => Math.abs(item.value)))
}

export function rankAxisMagnitude(magnitude: number, breakAt: number): number {
  if (magnitude <= breakAt) return magnitude
  return breakAt + (magnitude - breakAt) * EXTREME_RATE_COMPRESSION
}
