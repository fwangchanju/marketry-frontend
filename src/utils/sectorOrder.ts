import type { HeatmapSectorNode, SectorItem } from '@/types/api'
import { compareKoreanText } from '@/utils/koreanSort'
import { collectItems } from '@/utils/sectorAverage'

// 업종별 시가총액 합(원)과 종목 수 — 하위 업종의 종목까지 모두 센다. MARKETRY·거래소 업종 표와 같은 계산이다.
export interface SectorStat {
  marketValue: number
  stockCount: number
}
export type SectorStats = ReadonlyMap<number, SectorStat>

export const EMPTY_SECTOR_STATS: SectorStats = new Map()

// 지도 데이터(필터 전 전체 종목)의 업종 트리에서 업종 번호별 시가총액 합·종목 수를 만든다. 종목이 하나도 없는 업종은 트리에 없을 수 있어 없는 값은 0으로 본다.
export function buildSectorStats(nodes: readonly HeatmapSectorNode[] | undefined): SectorStats {
  const stats = new Map<number, SectorStat>()
  const walk = (node: HeatmapSectorNode) => {
    const items = collectItems(node)
    stats.set(node.sectorId, { marketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0), stockCount: items.length })
    node.children.forEach(walk)
  }
  nodes?.forEach(walk)
  return stats
}

// 같은 부모 아래 업종의 기본 순서 — 시가총액 합이 큰 업종부터, 같으면 가나다 순(그다음 id 순)이다. 전달한 배열을 그 자리에서 정렬해 돌려준다.
export function orderSectors(items: SectorItem[], stats: SectorStats): SectorItem[] {
  return items.sort((a, b) =>
    (stats.get(b.id)?.marketValue ?? 0) - (stats.get(a.id)?.marketValue ?? 0) || compareKoreanText(a.name, b.name) || a.id - b.id)
}

// 대·중·소분류 이름을 깊이별로, 위에서 아래로 펼친 순서대로 모은다(같은 이름은 처음 나온 자리). 머리글 필터의 "시가총액 순" 보기 순서에 쓴다.
export function sectorNamesByDepth(sectors: SectorItem[], stats: SectorStats): string[][] {
  const children = new Map<number | null, SectorItem[]>()
  for (const sector of sectors) {
    const list = children.get(sector.parentId)
    if (list) list.push(sector)
    else children.set(sector.parentId, [sector])
  }
  const byDepth: string[][] = [[], [], []]
  const walk = (parentId: number | null, depth: number) => {
    for (const sector of orderSectors(children.get(parentId) ?? [], stats)) {
      if (depth < byDepth.length) byDepth[depth].push(sector.name)
      walk(sector.id, depth + 1)
    }
  }
  walk(null, 0)
  return byDepth
}

// 업종 선택 목록(번호·이름만 있으면 되는 항목)을 시가총액 합이 큰 순서로 돌려준다 — 같으면 가나다 순이다. 원본 배열은 바꾸지 않는다.
export function sortByMarketValue<T extends { id: number; name: string }>(options: readonly T[], stats: SectorStats): T[] {
  return [...options].sort((a, b) =>
    (stats.get(b.id)?.marketValue ?? 0) - (stats.get(a.id)?.marketValue ?? 0) || compareKoreanText(a.name, b.name) || a.id - b.id)
}
