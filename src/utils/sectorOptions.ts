import type { SectorItem } from '@/types/api'
import { compareKoreanText } from '@/utils/koreanSort'

// 섹터를 부모-자식 순서로 펼쳐서 검색 옵션으로 만든다 (자식은 들여쓰기 표시).
export function buildSectorOptions(sectors: readonly SectorItem[]): SectorOption[] {
  const byParent = new Map<number | null, SectorItem[]>()
  for (const c of sectors) {
    const list = byParent.get(c.parentId)
    if (list) list.push(c)
    else byParent.set(c.parentId, [c])
  }
  for (const list of byParent.values()) list.sort((a, b) => compareKoreanText(a.name, b.name))

  const options: SectorOption[] = []
  const walk = (parentId: number | null, depth: number) => {
    for (const c of byParent.get(parentId) ?? []) {
      options.push({
        id: c.id,
        parentId: c.parentId,
        name: c.name,
        label: `${'　'.repeat(depth)}${depth > 0 ? '- ' : ''}${c.name}`,
      })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return options
}

export interface SectorOption {
  id: number
  parentId: number | null
  name: string
  label: string
}

// 종목 응답엔 sectorId(실제 배정된 섹터, 뎁스 무관)만 있어서, 대분류/중분류/소분류 3칸에 어떻게
// 나눠 보여줄지는 이미 받아온 섹터 트리를 parentId로 거슬러 올라가며 프론트에서 직접 계산한다.
// 백엔드가 뎁스별 이름 필드를 따로 내려줄 필요가 없어서, 나중에 뎁스가 더 늘어나도 여기만 고치면 된다.
interface SectorChain {
  rootId: number | null
  rootName: string
  midId: number | null
  midName: string | null
  leafId: number | null
  leafName: string | null
}

export function resolveSectorChain(sectorOptionsById: Map<number, SectorOption>, sectorId: number | null): SectorChain {
  const chain: SectorOption[] = []
  let current = sectorId == null ? undefined : sectorOptionsById.get(sectorId)
  while (current) {
    chain.unshift(current)
    current = current.parentId != null ? sectorOptionsById.get(current.parentId) : undefined
  }
  return {
    rootId: chain[0]?.id ?? null,
    rootName: chain[0]?.name ?? '-',
    midId: chain[1]?.id ?? null,
    midName: chain[1]?.name ?? null,
    leafId: chain[2]?.id ?? null,
    leafName: chain[2]?.name ?? null,
  }
}
