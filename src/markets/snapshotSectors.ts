import { useMemo } from 'react'
import type { SnapshotCategory, SnapshotClassification } from '@/markets/useSnapshotClassificationData'
import type { SectorItem } from '@/types/api'
import type { SectorStats } from '@/utils/sectorOrder'

export const SNAPSHOT_MAX_DEPTH = 2

export function categoryPath(categories: readonly SnapshotCategory[], target: SnapshotCategory): string[] {
  const path: string[] = []
  for (let current: SnapshotCategory | undefined = target; current; current = categories.find(item => item.id === current?.parentId)) path.unshift(current.name)
  return path
}

export function toSectorItems(categories: readonly SnapshotCategory[]): SectorItem[] {
  return categories.map(category => ({ ...category, depth: Math.min(categoryPath(categories, category).length - 1, SNAPSHOT_MAX_DEPTH) }))
}

// 이 업종(하위 포함)에 든 종목.
export function stocksUnder(path: readonly string[], stockCodes: readonly string[], classifications: Record<string, SnapshotClassification> | undefined): string[] {
  return stockCodes.filter(code => {
    const value = classifications?.[code]
    const names = [value?.sector, value?.industry, value?.subIndustry]
    return path.every((name, index) => names[index] === name)
  })
}

export function buildSnapshotSectorStats(sectors: readonly SectorItem[], stockCodes: readonly string[], classifications: Record<string, SnapshotClassification> | undefined, quotes: readonly { stockCode: string; totalMarketValue: number }[] | undefined): SectorStats {
  const marketValueByCode = new Map((quotes ?? []).map(quote => [quote.stockCode, quote.totalMarketValue]))
  return new Map(sectors.map(sector => {
    const codes = stocksUnder(categoryPath(sectors, sector), stockCodes, classifications)
    return [sector.id, { marketValue: codes.reduce((sum, code) => sum + (marketValueByCode.get(code) ?? 0), 0), stockCount: codes.length }]
  }))
}

// 업종 목록과 업종별 시가총액 합·종목 수.
export function useSnapshotSectors(categories: readonly SnapshotCategory[] | undefined, stockCodes: readonly string[], classifications: Parameters<typeof buildSnapshotSectorStats>[2], quotes: Parameters<typeof buildSnapshotSectorStats>[3]) {
  const sectors = useMemo(() => toSectorItems(categories ?? []), [categories])
  const sectorStats = useMemo(() => buildSnapshotSectorStats(sectors, stockCodes, classifications, quotes), [sectors, stockCodes, classifications, quotes])
  return { sectors, sectorStats }
}
