import { useMemo } from 'react'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useSectorExclusion, type SectorExclusionStore } from '@/hooks/useSectorExclusion'
import type { HeatmapSectorNode } from '@/types/api'
import type { MarketValueExclusions } from '@/utils/marketValueTier'
import { excludedNamesForIds } from '@/utils/sectorExclusion'

const NO_IDS: number[] = []
const NO_SECTORS = new Set<number>()

// 스냅샷 시장의 제외 업종은 업종 번호 목록을 계정 설정으로 저장한다. 같은 시장의 화면이 값을 함께 쓴다.
export function useSnapshotSectorExclusion(settingPrefix: string, tree: HeatmapSectorNode[], valueExclusions: MarketValueExclusions) {
  const [enabled, setEnabled] = usePageSetting<boolean>(`${settingPrefix}sectorFilterEnabled`, true)
  const [ids, setIds] = usePageSetting<number[]>(`${settingPrefix}excludedSectorIds`, NO_IDS)
  const names = useMemo(() => excludedNamesForIds(tree, ids), [tree, ids])
  const excludedIds = useMemo<ReadonlySet<number>>(() => (enabled && ids.length > 0 ? new Set(ids) : NO_SECTORS), [enabled, ids])
  const store: SectorExclusionStore = {
    names,
    excludedIds,
    exclude: sectorId => setIds(previous => (previous.includes(sectorId) ? previous : [...previous, sectorId])),
    remove: sectorId => setIds(previous => previous.filter(id => id !== sectorId)),
  }
  return useSectorExclusion({ tree, store, enabled, toggle: () => setEnabled(previous => !previous), valueExclusions, countsReady: true, suspendedStockCount: null })
}
