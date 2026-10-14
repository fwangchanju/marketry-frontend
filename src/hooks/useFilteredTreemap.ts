import { useMemo } from 'react'
import type { TreemapSectorNode, TreemapItem } from '@/types/api'
import { computeSectorAverage } from '@/utils/sectorAverage'

export type StockChangeFilter = 'all' | 'rising' | 'falling'
export type SectorChangeFilter = StockChangeFilter

interface DirectionFilters {
  stockChangeFilter: StockChangeFilter
  sectorChangeFilter: SectorChangeFilter
  sectorChangeDepth: number
  sectorUseSimpleAverage: boolean
}

// 필터링(섹터 제외/시가총액 구간/등락 방향)까지 반영된 뒤에도 화면이 필요로 하는 등락률 평균 두 개를 들고
// 있는 노드 — 종목을 매번 다시 순회하지 않도록 필터링 시점에 한 번만 계산해서 붙여둔다.
// weightedAvgChangeRate/simpleAvgChangeRate가 null이면 지금 선택된 구간에 해당하는 종목이 하나도
// 없다는 뜻이다.
export interface FilteredTreemapSectorNode extends TreemapSectorNode {
  weightedAvgChangeRate: number | null
  simpleAvgChangeRate: number | null
  children: FilteredTreemapSectorNode[]
}

// 섹터 exclude는 하위 전체로 자동 전파된다 — 제외된 노드는 자식을 아예 살펴보지 않고 통째로 버리므로,
// 자식이 스스로 isExcluded=false여도 부모가 제외되면 같이 사라진다.
// 시총 0(또는 tier/방향으로 다 걸러진) 종목/섹터는 트리맵에 빈 슬리버로 남지 않도록 재귀적으로 가지치기한다.
function filterNodes(
  nodes: TreemapSectorNode[],
  excludedSectorIds: Set<number>,
  excludedMarketValueTiers: Set<string>,
  filters: DirectionFilters,
  depth = 0,
): FilteredTreemapSectorNode[] {
  const result: FilteredTreemapSectorNode[] = []
  for (const node of nodes) {
    if (excludedSectorIds.has(node.sectorId)) continue

    // 업종은 선택한 업종 단계에서만 판정한다. 종목 방향과 독립적으로 유지하기 위해
    // 해당 업종의 원래 평균(시총 구간 제외는 반영)을 먼저 사용한다.
    const originalAverage = computeSectorAverage(node, excludedMarketValueTiers)
    if (filters.sectorChangeFilter !== 'all' && depth === filters.sectorChangeDepth) {
      const directionValue = filters.sectorUseSimpleAverage ? originalAverage.simpleAvg : originalAverage.weightedAvg
      if (directionValue === null || (filters.sectorChangeFilter === 'rising' ? directionValue <= 0 : directionValue >= 0)) continue
    }

    // 선택 단계보다 위에 직접 속한 종목은 선택된 업종에 속하지 않으므로 표시하지 않는다.
    const items = filters.sectorChangeFilter !== 'all' && depth < filters.sectorChangeDepth ? [] : node.items.filter(
      item => item.totalMarketValue > 0 && !excludedMarketValueTiers.has(item.marketValueTier) &&
        (filters.stockChangeFilter === 'all' || (filters.stockChangeFilter === 'rising' ? item.changeRate > 0 : item.changeRate < 0)),
    )
    const children = filterNodes(node.children, excludedSectorIds, excludedMarketValueTiers, filters, depth + 1)
    const totalMarketValue =
      items.reduce((sum, item) => sum + item.totalMarketValue, 0) +
      children.reduce((sum, child) => sum + child.totalMarketValue, 0)
    if (totalMarketValue <= 0) continue

    // 전체 모드는 기존 집계 규칙을 보존한다. 등락 필터가 켜진 동안에는 화면에 남은 종목으로 계산한다.
    const { weightedAvg, simpleAvg } = filters.stockChangeFilter === 'all' && filters.sectorChangeFilter === 'all'
      ? originalAverage
      : (() => {
          const visibleItems = [...items, ...children.flatMap(collectAllItems)]
          const totalValue = visibleItems.reduce((sum, item) => sum + item.totalMarketValue, 0)
          return {
            weightedAvg: totalValue > 0
              ? visibleItems.reduce((sum, item) => sum + item.changeRate * item.totalMarketValue, 0) / totalValue
              : null,
            simpleAvg: visibleItems.length > 0
              ? visibleItems.reduce((sum, item) => sum + item.changeRate, 0) / visibleItems.length
              : null,
          }
        })()
    result.push({
      ...node,
      items,
      children,
      totalMarketValue,
      weightedAvgChangeRate: weightedAvg,
      simpleAvgChangeRate: simpleAvg,
    })
  }
  return result
}

// 등락 방향 필터 없이 업종 제외·시가총액 구간 제외만 지도와 같은 규칙(하위 업종 제외 포함)으로 걸러낸 트리.
// 그룹 페이지가 지도 설정창과 같은 기준으로 종목 수를 세는 데 쓴다.
export function filterTreeByExclusions(
  nodes: TreemapSectorNode[],
  excludedSectorIds: Set<number>,
  excludedMarketValueTiers: Set<string>,
): FilteredTreemapSectorNode[] {
  return filterNodes(nodes, excludedSectorIds, excludedMarketValueTiers, {
    stockChangeFilter: 'all',
    sectorChangeFilter: 'all',
    sectorChangeDepth: 0,
    sectorUseSimpleAverage: false,
  })
}

// depth === maxDepth인 노드는 이 뎁스까지만 태그를 보여준다는 뜻 — 그 밑에 있던 하위 섹터들의
// 태그(헤더)는 없애되, 안에 있던 종목은 사라지지 않고 전부 이 노드 박스 안으로 펼쳐서 보여준다.
export function collectAllItems(node: FilteredTreemapSectorNode): TreemapItem[] {
  const items = [...node.items]
  for (const child of node.children) items.push(...collectAllItems(child))
  return items
}

// 루트 섹터를 절대 depth 0으로 보고, 화면에서 접어 보이는지와 무관하게 해당 단계의 섹터만 모은다.
// 업종 톱픽은 드릴다운한 현재 화면이 아니라 필터가 적용된 전체 트리 기준으로 순위를 매겨야 하므로,
// limitDepth 이후의 화면용 트리가 아니라 이 함수에 filteredRootNodes를 직접 넘겨 쓴다.
export function collectSectorsAtDepth(
  nodes: FilteredTreemapSectorNode[],
  targetDepth: number,
  depth = 0,
): FilteredTreemapSectorNode[] {
  if (depth === targetDepth) return nodes
  if (depth > targetDepth) return []
  return nodes.flatMap(node => collectSectorsAtDepth(node.children, targetDepth, depth + 1))
}

// "업종 단계" 슬라이더가 "끄기"일 때(뎁스 제한 0) 쓰는 완전 평탄화 — 섹터 구분 없이 지금
// 보이는 위치(형제 노드들 또는 드릴다운으로 들어온 노드 하나) 아래 종목을 전부 하나로 모은다.
export function flattenAllItems(nodes: FilteredTreemapSectorNode[]): TreemapItem[] {
  const result: TreemapItem[] = []
  for (const node of nodes) result.push(...collectAllItems(node))
  return result
}

// depth는 nodes를 1로 보는 기준(= "업종 단계" 슬라이더 값과 동일 단위) — 진짜 루트가 아니라 "지금
// 보고 있는 위치"를 1로 삼아 호출부(MapPage)가 드릴다운할 때마다 새로 호출한다. 그래야
// 뎁스 제한이 절대(진짜 루트 기준)가 아니라 항상 지금 위치 기준 상대값으로 적용된다 — 안 그러면 뎁스
// 제한이 드릴다운 경로 탐색에 쓰는 트리(useTreemapDrilldown)까지 미리 잘라버려서, maxDepth를 줄일
// 때 이미 진입해 있던 깊은 섹터가 트리에서 통째로 사라져 경로 매칭이 중간에 끊기는 문제가 있었다.
export function limitDepth(
  nodes: FilteredTreemapSectorNode[],
  maxDepth: number,
  depth = 1,
): FilteredTreemapSectorNode[] {
  const result: FilteredTreemapSectorNode[] = []
  for (const node of nodes) {
    if (depth >= maxDepth) {
      const items = collectAllItems(node)
      const totalMarketValue = items.reduce((sum, item) => sum + item.totalMarketValue, 0)
      if (totalMarketValue <= 0) continue
      result.push({ ...node, items, children: [], totalMarketValue })
      continue
    }
    const children = limitDepth(node.children, maxDepth, depth + 1)
    const totalMarketValue =
      node.items.reduce((sum, item) => sum + item.totalMarketValue, 0) +
      children.reduce((sum, child) => sum + child.totalMarketValue, 0)
    if (totalMarketValue <= 0) continue
    result.push({ ...node, children, totalMarketValue })
  }
  return result
}

function computeMaxDepth(nodes: FilteredTreemapSectorNode[], depth = 1): number {
  let max = depth
  for (const node of nodes) {
    if (node.children.length > 0) max = Math.max(max, computeMaxDepth(node.children, depth + 1))
  }
  return max
}

export function useFilteredTreemap(
  rootNodes: TreemapSectorNode[],
  excludedSectorIds: Set<number>,
  excludedMarketValueTiers: Set<string>,
  filters: DirectionFilters,
) {
  const excludeTierFiltered = useMemo(
    () => filterNodes(rootNodes, excludedSectorIds, excludedMarketValueTiers, filters),
    [rootNodes, excludedSectorIds, excludedMarketValueTiers, filters],
  )
  // 슬라이더 분모(전체 뎁스) — exclude/tier 필터링까지 반영된 트리 기준으로, 실제로 의미 있는 뎁스만
  // 센다. 뎁스 제한(limitDepth)은 여기서 미리 적용하지 않는다 — 드릴다운이 실제 뎁스를 그대로 오갈 수
  // 있어야 하고, 화면에 그릴 시점(MapPage)에 "지금 보고 있는 위치" 기준으로 매번 새로
  // 적용한다.
  const availableMaxDepth = useMemo(() => computeMaxDepth(excludeTierFiltered), [excludeTierFiltered])
  return { filteredRootNodes: excludeTierFiltered, availableMaxDepth }
}
