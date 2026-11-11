import type { FilteredHeatmapSectorNode } from '../hooks/useFilteredHeatmap.ts'
import type { DepthMetric } from '../hooks/useGlobalSettings.ts'

// 강세 업종은 업종 탭 표시 지표를 따른다. 평균이 아닌 지표를 고르면 시총 가중으로 계산한다.
export function topPickAverage(node: FilteredHeatmapSectorNode, metric: DepthMetric): number | null {
  return metric === 'simpleAvgChangeRate' ? node.simpleAvgChangeRate : node.weightedAvgChangeRate
}

// 고른 단계의 업종 후보 중 등락률이 높은 순(같으면 시가총액, 그래도 같으면 원래 순서)으로 count개의 키를 돌려준다.
// 국내 지도와 일본 지도가 같은 순위 규칙을 쓰도록 한 곳에 둔다.
// KRX 업종은 모두 sectorId=0이므로 이름까지 포함해 구별한다.
export function pickTopSectorKeys(candidates: FilteredHeatmapSectorNode[], count: number, metric: DepthMetric): Set<string> {
  const ranked = candidates
    .map((node, index) => ({ node, index, average: topPickAverage(node, metric) }))
    .filter((candidate): candidate is { node: FilteredHeatmapSectorNode; index: number; average: number } => candidate.average !== null)
    .sort((a, b) => b.average - a.average || b.node.totalMarketValue - a.node.totalMarketValue || a.index - b.index)
  return new Set(ranked.slice(0, count).map(candidate => JSON.stringify([candidate.node.sectorId, candidate.node.sectorName])))
}
