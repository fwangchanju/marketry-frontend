import { useMemo } from 'react'
import type { MarketFilters } from '@/markets/marketContract'
import type { HeatmapSectorNode } from '@/types/api'
import type { MarketValueExclusions } from '@/utils/marketValueTier'
import { buildExcludedSectorRows } from '@/utils/sectorExclusion'

// 제외 업종을 저장하고 읽는 곳. 시장·모드마다 이것만 다르다.
export interface SectorExclusionStore {
  // 제외한 업종 번호 → 목록에 보일 이름.
  names: ReadonlyMap<number, string>
  // 지금 실제로 적용되는 업종 번호(스위치가 꺼져 있으면 비어 있다).
  excludedIds: ReadonlySet<number>
  exclude: (sectorId: number, sectorName: string) => void
  remove: (sectorId: number) => void
}

// 업종 제외 — 켜기·끄기, 목록, 종목 수 계산을 모든 시장이 같이 쓴다.
export function useSectorExclusion({ tree, store, enabled, toggle, valueExclusions, countsReady, suspendedStockCount }: {
  tree: HeatmapSectorNode[]
  store: SectorExclusionStore
  enabled: boolean
  toggle: () => void
  valueExclusions: MarketValueExclusions
  countsReady: boolean
  suspendedStockCount: number | null
}): MarketFilters['sectorExclusion'] {
  const rows = useMemo(() => buildExcludedSectorRows(tree, store.names, valueExclusions, countsReady), [tree, store.names, valueExclusions, countsReady])
  return { enabled, toggle, excludedIds: store.excludedIds, rows, exclude: store.exclude, remove: store.remove, suspendedStockCount }
}
