import type { JapanCategory, JapanClassification } from '@/utils/japanMap'

// 미국 GICS 분류(종목 → 섹터·산업)를 지도 트리 부품(buildJapanTree)이 읽는 모양으로 바꾼다.
// 1단계는 GICS 섹터, 2단계는 GICS 산업(하위 산업). 읽기 전용이라 운영 분류와 섞이지 않는다.
export type GicsClassificationMap = Readonly<Record<string, { sector: string | null; industry: string | null; subIndustry: string | null }>>

export function buildUsaGicsTree(gics: GicsClassificationMap): { categories: JapanCategory[]; classifications: Record<string, JapanClassification> } {
  const sectors = [...new Set(Object.values(gics).map(value => value.sector).filter((name): name is string => Boolean(name)))].sort()
  const sectorId = new Map<string, number>(sectors.map((name, index) => [name, index + 1]))
  const industryPairs = new Map<string, { sector: string; industry: string }>()
  for (const value of Object.values(gics)) {
    if (!value.sector || !value.industry) continue
    industryPairs.set(`${value.sector}\u0000${value.industry}`, { sector: value.sector, industry: value.industry })
  }
  const industries = [...industryPairs.values()].sort((a, b) => a.sector.localeCompare(b.sector) || a.industry.localeCompare(b.industry))
  const industryId = new Map<string, number>(industries.map((pair, index) => [`${pair.sector}\u0000${pair.industry}`, sectors.length + index + 1]))
  const categories: JapanCategory[] = [
    ...sectors.map(name => ({ id: sectorId.get(name)!, parentId: null, name })),
    ...industries.map(pair => ({ id: industryId.get(`${pair.sector}\u0000${pair.industry}`)!, parentId: sectorId.get(pair.sector)!, name: pair.industry })),
  ]
  const classifications: Record<string, JapanClassification> = {}
  for (const [code, value] of Object.entries(gics)) {
    classifications[code] = { sector: value.sector, industry: value.industry, subIndustry: null }
  }
  return { categories, classifications }
}
