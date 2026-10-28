import type { DisplayGroup } from '@/hooks/useHeatmapLayout'
import type { HeatmapItem } from '@/types/api'

// 실험 탭의 "종목 이동" — 종목 코드 → 도착 업종(sectorId). 화면에서만 쓰는 값이라 서버와 브라우저 어디에도 저장하지 않는다.
export type StockMoves = Record<string, number>

function collectAllItems(group: DisplayGroup): HeatmapItem[] {
  return [...group.items, ...group.children.flatMap(collectAllItems)]
}

// 바뀐 업종의 합계·평균을 종목에서 다시 계산한다(바뀌지 않은 업종은 원래 값을 그대로 쓴다).
function withTotals(group: DisplayGroup): DisplayGroup {
  const all = collectAllItems(group)
  const totalMarketValue = all.reduce((sum, item) => sum + item.totalMarketValue, 0)
  const weightedSum = all.reduce((sum, item) => sum + item.changeRate * item.totalMarketValue, 0)
  const simpleSum = all.reduce((sum, item) => sum + item.changeRate, 0)
  return {
    ...group,
    totalMarketValue,
    weightedAvgChangeRate: totalMarketValue > 0 ? weightedSum / totalMarketValue : null,
    simpleAvgChangeRate: all.length > 0 ? simpleSum / all.length : null,
  }
}

// 이동한 종목을 원래 업종에서 빼서 도착 업종에 넣은 새 트리를 돌려준다. 도착 업종이 지금 화면에 없으면 그 이동은 건너뛰고,
// 이미 그 업종에 있는 종목은 그대로 둔다. 바뀌지 않은 업종 객체는 그대로 재사용한다.
export function applyStockMoves(groups: DisplayGroup[], moves: StockMoves): DisplayGroup[] {
  if (Object.keys(moves).length === 0) return groups
  const visibleSectorIds = new Set<number>()
  const collectSectorIds = (list: DisplayGroup[]) => {
    for (const group of list) {
      visibleSectorIds.add(group.sectorId)
      collectSectorIds(group.children)
    }
  }
  collectSectorIds(groups)

  const arrivals = new Map<number, HeatmapItem[]>()
  const movedCodes = new Set<string>()
  const scan = (list: DisplayGroup[]) => {
    for (const group of list) {
      for (const item of group.items) {
        const targetId = moves[item.stockCode]
        if (targetId === undefined || targetId === group.sectorId || !visibleSectorIds.has(targetId)) continue
        movedCodes.add(item.stockCode)
        arrivals.set(targetId, [...(arrivals.get(targetId) ?? []), item])
      }
      scan(group.children)
    }
  }
  scan(groups)
  if (movedCodes.size === 0) return groups

  const rebuild = (group: DisplayGroup): DisplayGroup => {
    const children = group.children.map(rebuild)
    const added = arrivals.get(group.sectorId) ?? []
    const childrenChanged = children.some((child, index) => child !== group.children[index])
    const removed = group.items.some(item => movedCodes.has(item.stockCode))
    if (!childrenChanged && !removed && added.length === 0) return group
    return withTotals({ ...group, items: [...group.items.filter(item => !movedCodes.has(item.stockCode)), ...added], children })
  }
  return groups.map(rebuild)
}
