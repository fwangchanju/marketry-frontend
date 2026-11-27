import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { registerExcludedSector, unregisterExcludedSector } from '@/api/heatmap'
import { customHeatmapKeys } from '@/hooks/queryKeys'
import { usePageSetting } from '@/hooks/usePageSetting'
import { useSectorExclusion, type SectorExclusionStore } from '@/hooks/useSectorExclusion'
import type { HeatmapSectorNode, SectorItem } from '@/types/api'
import type { MarketValueExclusions } from '@/utils/marketValueTier'
import type { SnapshotMarket } from '@/utils/markets'
import { excludedNamesForIds } from '@/utils/sectorExclusion'

const NO_IDS: number[] = []
const NO_KEYS: string[] = []
const NO_SECTORS = new Set<number>()

function flatten(nodes: readonly HeatmapSectorNode[], out: HeatmapSectorNode[] = []): HeatmapSectorNode[] {
  for (const node of nodes) {
    out.push(node)
    flatten(node.children, out)
  }
  return out
}

// 스냅샷 시장의 제외 업종. 시장마다 같은 화면(지도·그래프·서머리·MOBILE)이 값을 함께 쓴다.
// - 내 기준(mineMarket): 한국처럼 서버의 업종에 바로 저장한다.
// - MARKETRY: 이 브라우저에 업종의 고정 이름표로 저장한다. 업데이트·롤백으로 업종 번호가 바뀌어도 풀리지 않는다.
//   옛 저장값(업종 번호)은 처음 한 번 이름표로 옮기고 그대로 남겨 둔다(앞 버전으로 되돌려도 옛 값을 읽을 수 있게).
//   업종에 이름표가 없으면(MARKETRY를 아직 새 자리로 옮기기 전) 예전처럼 번호로 저장한다.
export function useSnapshotSectorExclusion(settingPrefix: string, tree: HeatmapSectorNode[], valueExclusions: MarketValueExclusions, mineMarket: SnapshotMarket | null = null) {
  const queryClient = useQueryClient()
  const [enabled, setEnabled] = usePageSetting<boolean>(`${settingPrefix}sectorFilterEnabled`, true)
  const [ids, setIds] = usePageSetting<number[]>(`${settingPrefix}excludedSectorIds`, NO_IDS)
  const [keys, setKeys] = usePageSetting<string[]>(`${settingPrefix}excludedSectorKeys`, NO_KEYS)
  const [keysMigrated, setKeysMigrated] = usePageSetting<boolean>(`${settingPrefix}excludedSectorKeysMigrated`, false)
  const nodes = useMemo(() => flatten(tree), [tree])
  const usesKeys = mineMarket === null && nodes.some(node => node.stableKey)

  useEffect(() => {
    if (!usesKeys || keysMigrated) return
    const byId = new Map<number, HeatmapSectorNode>()
    for (const node of nodes) {
      byId.set(node.sectorId, node)
      if (node.legacySectorId != null) byId.set(node.legacySectorId, node)
    }
    const migrated = ids.map(id => byId.get(id)?.stableKey).filter((key): key is string => Boolean(key))
    setKeys(previous => [...new Set([...previous, ...migrated])])
    setKeysMigrated(true)
  }, [usesKeys, keysMigrated, nodes, ids, setKeys, setKeysMigrated])

  const selectedIds = useMemo(() => {
    if (mineMarket !== null) return nodes.filter(node => node.isExcluded).map(node => node.sectorId)
    if (usesKeys) {
      const selected = new Set(keys)
      return nodes.filter(node => node.stableKey && selected.has(node.stableKey)).map(node => node.sectorId)
    }
    return ids
  }, [mineMarket, usesKeys, nodes, keys, ids])
  const names = useMemo(() => excludedNamesForIds(tree, selectedIds), [tree, selectedIds])
  const excludedIds = useMemo<ReadonlySet<number>>(() => (enabled && selectedIds.length > 0 ? new Set(selectedIds) : NO_SECTORS), [enabled, selectedIds])

  const setMineExcluded = (sectorId: number, excluded: boolean) => {
    if (mineMarket === null) return
    // 화면은 바로 바꾸고 서버에 저장한다. 실패하면 서버 값을 다시 받는다.
    queryClient.setQueryData<SectorItem[]>(customHeatmapKeys.sectors(mineMarket), old => old?.map(sector => (sector.id === sectorId ? { ...sector, excluded } : sector)))
    const request = excluded ? registerExcludedSector(sectorId, mineMarket) : unregisterExcludedSector(sectorId, mineMarket)
    request.catch(() => queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors(mineMarket) }))
  }
  const keyOf = (sectorId: number) => nodes.find(node => node.sectorId === sectorId)?.stableKey ?? null
  const store: SectorExclusionStore = {
    names,
    excludedIds,
    exclude: sectorId => {
      if (mineMarket !== null) return setMineExcluded(sectorId, true)
      const key = keyOf(sectorId)
      if (usesKeys && key) setKeys(previous => (previous.includes(key) ? previous : [...previous, key]))
      else setIds(previous => (previous.includes(sectorId) ? previous : [...previous, sectorId]))
    },
    remove: sectorId => {
      if (mineMarket !== null) return setMineExcluded(sectorId, false)
      const key = keyOf(sectorId)
      if (usesKeys && key) setKeys(previous => previous.filter(item => item !== key))
      else setIds(previous => previous.filter(id => id !== sectorId))
    },
  }
  return useSectorExclusion({ tree, store, enabled, toggle: () => setEnabled(previous => !previous), valueExclusions, countsReady: true, suspendedStockCount: null })
}
