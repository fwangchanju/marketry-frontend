import type { JapanCategory, JapanClassification } from '@/utils/japanMap'

// 미국 GICS 분류(종목 → 섹터·산업)를 지도 트리 부품(buildJapanTree)이 읽는 모양으로 바꾼다.
// 1단계는 GICS 섹터, 2단계는 GICS 산업(하위 산업). 읽기 전용이라 운영 분류와 섞이지 않는다.
export type GicsClassificationMap = Readonly<Record<string, { sector: string | null; industryGroup: string | null; industry: string | null; subIndustry: string | null; gicsCode?: string }>>

export function buildUsaGicsTree(gics: GicsClassificationMap): { categories: JapanCategory[]; classifications: Record<string, JapanClassification> } {
  // 1단계(섹터)와 2단계(산업그룹)만 쓴다. 3·4단계는 지도에 넣지 않는다.
  const sectors = [...new Set(Object.values(gics).map(value => value.sector).filter((name): name is string => Boolean(name)))].sort()
  const sectorId = new Map<string, number>(sectors.map((name, index) => [name, index + 1]))
  const groupPairs = new Map<string, { sector: string; group: string }>()
  for (const value of Object.values(gics)) {
    if (!value.sector || !value.industryGroup) continue
    groupPairs.set(`${value.sector}\u0000${value.industryGroup}`, { sector: value.sector, group: value.industryGroup })
  }
  const groups = [...groupPairs.values()].sort((a, b) => a.sector.localeCompare(b.sector) || a.group.localeCompare(b.group))
  const groupId = new Map<string, number>(groups.map((pair, index) => [`${pair.sector}\u0000${pair.group}`, sectors.length + index + 1]))
  const categories: JapanCategory[] = [
    ...sectors.map(name => ({ id: sectorId.get(name)!, parentId: null, name })),
    ...groups.map(pair => ({ id: groupId.get(`${pair.sector}\u0000${pair.group}`)!, parentId: sectorId.get(pair.sector)!, name: pair.group })),
  ]
  const classifications: Record<string, JapanClassification> = {}
  for (const [code, value] of Object.entries(gics)) {
    classifications[code] = { sector: value.sector, industry: value.industryGroup, subIndustry: null }
  }
  return { categories, classifications }
}
