import type { SectorItem } from '@/types/api'
import { compareKoreanText } from '@/utils/koreanSort'

// 내 분류 섹터 순서 — 업종 화면에서 끌어서 바꾼 형제 순서를 브라우저에 저장해 둔다(부모 id → 자식 id 순서). 저장되지 않은 항목은 가나다순으로 뒤에 붙는다.
export type SectorOrder = Record<string, number[]>

export const SECTOR_ORDER_STORAGE_KEY = 'marketry:custom-sector-order'

export function loadSectorOrder(): SectorOrder {
  try { return JSON.parse(localStorage.getItem(SECTOR_ORDER_STORAGE_KEY) ?? '{}') as SectorOrder } catch { return {} }
}

export function orderSectors(items: SectorItem[], parentId: number | null, order: SectorOrder): SectorItem[] {
  const saved = order[String(parentId)] ?? []
  const rank = new Map(saved.map((id, index) => [id, index]))
  return items.sort((a, b) => {
    const rankA = rank.get(a.id)
    const rankB = rank.get(b.id)
    if (rankA !== undefined || rankB !== undefined) {
      if (rankA === undefined) return 1
      if (rankB === undefined) return -1
      if (rankA !== rankB) return rankA - rankB
    }
    return compareKoreanText(a.name, b.name) || a.id - b.id
  })
}

// 대·중·소분류 이름을 깊이별로, 위에서 아래로 펼친 순서대로 모은다(같은 이름은 처음 나온 자리). 머리글 필터의 보기 순서에 쓴다.
export function sectorNamesByDepth(sectors: SectorItem[], order: SectorOrder): string[][] {
  const children = new Map<number | null, SectorItem[]>()
  for (const sector of sectors) {
    const list = children.get(sector.parentId)
    if (list) list.push(sector)
    else children.set(sector.parentId, [sector])
  }
  const byDepth: string[][] = [[], [], []]
  const walk = (parentId: number | null, depth: number) => {
    for (const sector of orderSectors(children.get(parentId) ?? [], parentId, order)) {
      if (depth < byDepth.length) byDepth[depth].push(sector.name)
      walk(sector.id, depth + 1)
    }
  }
  walk(null, 0)
  return byDepth
}
