// 종목의 등락 방향 — 업종 지표의 오른·내린·보합 종목 수를 세는 규칙이다.
// 등락률이 ±0.5% 이내(경계 포함)면 보합이다(2026-11-14 사용자 결정). 예전에는 정확히 0일 때만 보합이라 보합이 거의 없었다
// (일본 225종목 중 2개, 미국 499종목 중 2개). 한국(전체·코스피·코스닥)·일본·미국 지도와 모바일 요약이 이 규칙 하나를 쓴다.
// 색칠(0%를 회색으로 칠하는 것)과 "상승·하락 종목만 보기" 필터는 이 규칙과 별개다.
export const FLAT_RANGE_PERCENT = 0.5

export type ChangeDirection = 'up' | 'down' | 'flat'

export function changeDirectionOf(changeRate: number): ChangeDirection {
  if (changeRate > FLAT_RANGE_PERCENT) return 'up'
  if (changeRate < -FLAT_RANGE_PERCENT) return 'down'
  return 'flat'
}
