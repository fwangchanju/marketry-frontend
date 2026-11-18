import type { HeatmapSectorNode } from '@/types/api'
import { collectExcludedSectorCounts } from './excludedSectorCounts.ts'
import { isMarketValueExcluded, type MarketValueExclusions } from './marketValueTier.ts'
import { compareKoreanText } from './koreanSort.ts'

// 설정창 "업종 제외" 목록의 한 줄(SettingsExcludeSection이 받는 모양).
export interface ExcludedSectorRow {
  sectorId: number
  sectorName: string
  stockCount: number | null
  coveredByParent: boolean
}

// 업종 id의 이름 경로(대분류부터). 없으면 null.
export function findSectorPath(nodes: HeatmapSectorNode[], targetId: number, ancestors: string[] = []): string[] | null {
  for (const node of nodes) {
    const path = [...ancestors, node.sectorName]
    if (node.sectorId === targetId) return path
    const found = findSectorPath(node.children, targetId, path)
    if (found) return found
  }
  return null
}

// 상위 업종도 같이 제외된 업종의 id — 이 업종의 종목은 상위 업종 줄의 종목 수에 이미 들어 있어서 목록에서 흐리게 보여 준다.
export function collectCoveredExcludedIds(nodes: HeatmapSectorNode[], excluded: ReadonlySet<number>, covered = false, out: Set<number> = new Set()): Set<number> {
  for (const node of nodes) {
    const isExcluded = excluded.has(node.sectorId)
    if (isExcluded && covered) out.add(node.sectorId)
    collectCoveredExcludedIds(node.children, excluded, covered || isExcluded, out)
  }
  return out
}

// 제외 목록 줄 — 이름순. 트리에서 사라진 업종 id(분류가 바뀐 경우)는 목록에 보이지 않는다.
export function buildExcludedSectorRows(tree: HeatmapSectorNode[], excludedIds: readonly number[], exclusions: MarketValueExclusions): ExcludedSectorRow[] {
  if (excludedIds.length === 0) return []
  const counts = collectExcludedSectorCounts(tree, exclusions)
  const covered = collectCoveredExcludedIds(tree, new Set(excludedIds))
  const rows: ExcludedSectorRow[] = []
  for (const sectorId of excludedIds) {
    const path = findSectorPath(tree, sectorId)
    if (!path) continue
    rows.push({ sectorId, sectorName: path.join(' > '), stockCount: counts.get(sectorId) ?? 0, coveredByParent: covered.has(sectorId) })
  }
  return rows.sort((a, b) => compareKoreanText(a.sectorName, b.sectorName))
}

// 제외 업종과 시가총액 범위를 거친 뒤 화면에 남는 종목 수(설정창의 "n/m종목"에 쓴다).
export function countVisibleItems(nodes: HeatmapSectorNode[], excludedSectorIds: ReadonlySet<number>, exclusions: MarketValueExclusions): number {
  let count = 0
  for (const node of nodes) {
    if (excludedSectorIds.has(node.sectorId)) continue
    count += node.items.filter(item => item.totalMarketValue > 0 && !isMarketValueExcluded(item, exclusions)).length
    count += countVisibleItems(node.children, excludedSectorIds, exclusions)
  }
  return count
}
