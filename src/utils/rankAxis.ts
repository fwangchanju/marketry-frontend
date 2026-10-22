// 신규 상장 이외 항목의 최대 등락폭(상승·하락 모두)까지는 그대로 두고, 그 너머의 길이만 30% 비율로 압축한다.
// 큰 값은 해당 상승률 지점에서 간격을 두고 압축 구간(꼬리)을 이어 그린다. 사선은 쓰지 않는다.
// 숫자 라벨과 순위는 원래 등락률을 사용한다.
const EXTREME_RATE_COMPRESSION = 0.3
// 꼬리는 자르는 지점의 1배를 넘지 않는다. 상장 당일 +300%처럼 큰 값이 나와도 나머지 막대가 눌리지 않게 하며
// (이때 나머지 최대 막대는 축의 약 50%), 크기는 끊김 표시와 숫자 라벨로 전한다.
const MAX_TAIL_RATIO = 1

export const RANK_AXIS_BREAK_CUT_PX = 6
export const RANK_AXIS_BREAK_BRIDGE_PX = 8
// 가운데 막대는 양쪽 테두리 1px씩을 포함해 8px로 그려 내부 색상이 6px 남아, 눈에 보이는 폭이 빈틈 6px과 같다.
// 빈틈 6px + 막대 8px + 빈틈 6px.
export const RANK_AXIS_BREAK_GAP_PX = RANK_AXIS_BREAK_CUT_PX * 2 + RANK_AXIS_BREAK_BRIDGE_PX

// 다른 항목 최대치가 이보다 작아도 이 값(%·%p)까지는 자르지 않는다.
// N분 전 대비처럼 값이 작은 그래프에서 신규 상장이 조금만 커도 끊김 표시가 붙는 것을 막는다.
const RANK_AXIS_BREAK_MIN = 2

export function rankAxisBreakAt(items: readonly { sectorName: string; value: number; hiddenCount?: number }[]): number {
  const othersMax = Math.max(0, ...items.filter(item => item.hiddenCount === undefined && item.sectorName !== '신규 상장').map(item => Math.abs(item.value)))
  return othersMax > 0 ? Math.max(othersMax, RANK_AXIS_BREAK_MIN) : 0
}

export function rankAxisMagnitude(magnitude: number, breakAt: number): number {
  if (magnitude <= breakAt) return magnitude
  return breakAt + Math.min((magnitude - breakAt) * EXTREME_RATE_COMPRESSION, breakAt * MAX_TAIL_RATIO)
}
