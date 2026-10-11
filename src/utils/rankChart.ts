import type { RankColumnItem, RankColumnsChart } from '@/components/RankColumns'

const SHOW_ALL_LIMIT = 27
const EDGE_COUNT = 15

// (key, 값) 목록을 값 내림차순 랭킹 막대그래프 데이터로 변환한다 — "현재" 그래프/"변화율" 그래프 둘
// 다 이 함수로 각각 독립적으로 정렬·스케일을 만든다(같은 포맷, 정렬 기준값만 다름).
// 지수 참조 막대는 개수에 세지 않고 값 순서 자리에 그대로 둔다. 줄인 구간 안에 들어가는 지수는 "외 N개" 칸 바로 뒤에 둔다.
export function buildRankChart(entries: RankColumnItem[]): RankColumnsChart {
  const sorted = [...entries].sort((a, b) => b.value - a.value)
  const sectors = sorted.filter(item => !item.isReference)
  let rankedItems = sorted

  if (sectors.length > SHOW_ALL_LIMIT) {
    const top = sectors.slice(0, EDGE_COUNT)
    const bottom = sectors.slice(-EDGE_COUNT)
    const hiddenCount = sectors.length - top.length - bottom.length
    const ellipsis: RankColumnItem = { key: 'hidden-sectors', sectorName: `외 ${hiddenCount}개`, value: 0, hiddenCount }
    const visible = sorted.filter(item => item.isReference || top.includes(item) || bottom.includes(item))
    const splitAt = visible.indexOf(top[top.length - 1]) + 1
    rankedItems = [...visible.slice(0, splitAt), ellipsis, ...visible.slice(splitAt)]
  }

  const rawMaxAbsValue = Math.max(1, ...rankedItems.filter(item => item.hiddenCount === undefined).map(item => Math.abs(item.value)))
  // 핀비즈처럼 축 눈금이 딱 떨어지게, 0.5%p 단위로 올림한 값을 막대 스케일에 쓴다.
  const axisMax = Math.ceil(rawMaxAbsValue * 2) / 2

  return { rankedItems, axisMax }
}
