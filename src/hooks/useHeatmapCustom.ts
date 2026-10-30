import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import {
  getSectors,
  resetCustomClassification,
  createSector,
  renameSector,
  reparentSector,
  getSectorDeletePreview,
  deleteSector,
  getSnapshots,
  getCurrentSnapshot,
  saveSnapshot,
  overwriteSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  assignStockSector,
  updateStockAlias,
  bulkAssignStockSector,
  getStockSectors,
  createCustomScaleThreshold,
  updateCustomScaleThreshold,
  deleteCustomScaleThreshold,
} from '@/api/custom'
import { customHeatmapKeys, heatmapKeys } from './queryKeys'
import { STATIC_REFERENCE_CACHE, INFREQUENT_DATA_CACHE } from './cacheConfig'
import type { StockSectorListItem } from '@/types/api'

interface StockSectorListResponse {
  snapshotTime: string | null
  items: StockSectorListItem[]
}

export function invalidateCustomTaxonomy(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    queryKey: heatmapKeys.all,
    predicate: ({ queryKey }) =>
      (queryKey[1] === 'map' || queryKey[1] === 'sectorPair') && queryKey[3] === 'MINE',
  })
}

export function useCustomSectors(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: customHeatmapKeys.sectors(),
    queryFn: getSectors,
    enabled: options?.enabled ?? true,
    ...INFREQUENT_DATA_CACHE,
  })
}

export function useResetCustomClassification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resetCustomClassification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.stockSectors() })
      invalidateCustomTaxonomy(queryClient)
    },
    meta: { skipGlobalError: true },
  })
}

export function useSectorDeletePreview() {
  return useMutation({
    mutationFn: (id: number) => getSectorDeletePreview(id),
    meta: { skipGlobalError: true },
  })
}

export function useCreateSector(options?: { skipGlobalError?: boolean; deferInvalidation?: boolean }) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { failure: '업종을 추가하지 못했습니다.', skipGlobalError: options?.skipGlobalError },
    mutationFn: ({ name, parentId }: { name: string; parentId: number | null }) => createSector(name, parentId),
    onSuccess: () => {
      if (options?.deferInvalidation) return
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
      invalidateCustomTaxonomy(queryClient)
    },
    onError: () => {
      if (!options?.deferInvalidation) return queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
    },
  })
}

export function useRenameSector() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { failure: '업종명을 바꾸지 못했습니다.' },
    mutationFn: ({ id, name }: { id: number; name: string }) => renameSector(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
      invalidateCustomTaxonomy(queryClient)
    },
  })
}

export function useReparentSector() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { failure: '업종을 옮기지 못했습니다.' },
    mutationFn: ({ id, parentId }: { id: number; parentId: number | null }) => reparentSector(id, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
      invalidateCustomTaxonomy(queryClient)
    },
  })
}

export function useDeleteSector() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, expectedMoveCount }: { id: number; expectedMoveCount?: number }) => deleteSector(id, expectedMoveCount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
      // 담겨 있던 종목이 미분류로 옮겨지므로 종목 표의 분류도 다시 받는다.
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.stockSectors() })
      invalidateCustomTaxonomy(queryClient)
    },
    meta: { skipGlobalError: true },
  })
}

export function useSnapshots() {
  return useQuery({
    queryKey: customHeatmapKeys.snapshots(),
    queryFn: getSnapshots,
    ...STATIC_REFERENCE_CACHE,
  })
}

export function useCurrentSnapshot() {
  return useQuery({
    queryKey: customHeatmapKeys.currentSnapshot(),
    queryFn: getCurrentSnapshot,
    ...STATIC_REFERENCE_CACHE,
  })
}

export function useSaveSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (label: string) => saveSnapshot(label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.snapshots() })
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.currentSnapshot() })
    },
  })
}

export function useOverwriteSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) => overwriteSnapshot(id, label),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.snapshots() })
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.currentSnapshot() })
    },
  })
}

export function useRestoreSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => restoreSnapshot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors() })
      queryClient.invalidateQueries({ queryKey: customHeatmapKeys.currentSnapshot() })
      invalidateCustomTaxonomy(queryClient)
    },
  })
}

export function useDeleteSnapshot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteSnapshot(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customHeatmapKeys.snapshots() }),
  })
}

// 서버 재조회 대신 캐시에 있는 그 종목의 sectorId만 직접 패치한다 — 화면에 보이는 대/중/소분류는
// sectorId를 섹터 트리에서 찾아 렌더 시점에 계산하므로 이 필드만 바꿔도 바로 정확히 반영된다.
// 재조회(invalidate)를 하면 필터링 중이던 목록에서 방금 바꾼 종목이 새 섹터 기준으로 곧장
// 걸러져 사라져버리는 문제가 있었다 — 목록 자체(필터링된 종목 집합)를 다시 계산하는 건 필터 조건을
// 바꾸거나 명시적으로 새로고침할 때만 일어나야 한다.
function patchStockSectorId(queryClient: ReturnType<typeof useQueryClient>, stockCodes: string[], sectorId: number, deferInvalidation = false) {
  const stockCodeSet = new Set(stockCodes)
  queryClient.setQueryData<StockSectorListResponse>(customHeatmapKeys.stockSectors(), old =>
    old
      ? { ...old, items: old.items.map(item => (stockCodeSet.has(item.stockCode) ? { ...item, sectorId } : item)) }
      : old,
  )
  if (!deferInvalidation) invalidateCustomTaxonomy(queryClient)
}

export function useAssignStockSector() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { failure: '종목의 업종을 바꾸지 못했습니다.' },
    mutationFn: ({ stockCode, sectorId }: { stockCode: string; sectorId: number }) =>
      assignStockSector(stockCode, sectorId),
    onSuccess: (_data, { stockCode, sectorId }) => patchStockSectorId(queryClient, [stockCode], sectorId),
  })
}

export function useBulkAssignStockSector(options?: { skipGlobalError?: boolean; deferInvalidation?: boolean }) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { failure: '종목의 업종을 바꾸지 못했습니다.', skipGlobalError: options?.skipGlobalError },
    mutationFn: ({ stockCodes, sectorId }: { stockCodes: string[]; sectorId: number }) =>
      bulkAssignStockSector(stockCodes, sectorId),
    onSuccess: (data, { stockCodes, sectorId }) => {
      const failed = new Set(data.failedStockCodes)
      patchStockSectorId(queryClient, stockCodes.filter(code => !failed.has(code)), sectorId, options?.deferInvalidation)
    },
    // 응답을 못 받은 요청도 서버에는 적용됐을 수 있으므로 실제 값을 다시 받는다.
    onError: () => {
      if (!options?.deferInvalidation) return queryClient.invalidateQueries({ queryKey: customHeatmapKeys.stockSectors() })
    },
  })
}

export function useUpdateStockAlias() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { failure: '종목 약칭을 바꾸지 못했습니다.' },
    mutationFn: ({ stockCode, alias }: { stockCode: string; alias: string | null }) =>
      updateStockAlias(stockCode, alias),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: customHeatmapKeys.stockSectors() }),
  })
}

export function useStockSectors(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: customHeatmapKeys.stockSectors(),
    queryFn: getStockSectors,
    enabled: options?.enabled ?? true,
    ...STATIC_REFERENCE_CACHE,
  })
}

// 색상 스케일 기준값 단건 CRUD — 캐시 동기화는 여기서 하지 않는다. 이 화면(MapPage)의
// 실제 렌더 소스는 react-query 캐시가 아니라 로컬 colorScaleDraft라서, 페이지가 각 CRUD 호출 결과를
// 받아 draft를 직접 갱신하고 필요하면 그때 캐시도 같이 맞춘다(한 번의 "적용"이 여러 건의 create/
// update/delete로 나뉠 수 있어서, 낱개 뮤테이션마다 캐시를 건드리면 중간 상태가 잠깐씩 노출된다).
export function useCreateCustomScaleThreshold(options: { skipGlobalError?: boolean } = {}) {
  return useMutation({ mutationFn: createCustomScaleThreshold, meta: { failure: '등락률 색상을 저장하지 못했습니다.', ...options } })
}

// 서버에 이미 없는 기준값이다 — 다른 화면·탭에서 지웠거나 초기화해서 이 화면의 id가 낡았을 때 생긴다("이미 삭제되었거나 존재하지 않는 색상 기준값입니다.").
const isScaleThresholdMissing = (error: unknown) => isAxiosError(error) && (error.response?.status === 404 || JSON.stringify(error.response?.data ?? '').includes('이미 삭제'))

// 수정하려는 기준값이 서버에 이미 없으면 오류 창을 띄우지 않고 같은 값으로 새로 만든다(결과적으로 원하는 값이 저장된다).
export function useUpdateCustomScaleThreshold(options: { skipGlobalError?: boolean } = {}) {
  return useMutation({
    meta: { failure: '등락률 색상을 저장하지 못했습니다.', ...options },
    mutationFn: async ({ id, payload }: { id: number; payload: Parameters<typeof updateCustomScaleThreshold>[1] }) => {
      try {
        return await updateCustomScaleThreshold(id, payload)
      } catch (error) {
        if (!isScaleThresholdMissing(error)) throw error
        return createCustomScaleThreshold(payload)
      }
    },
  })
}

// 지우려는 기준값이 서버에 이미 없으면 목적(없애기)이 이미 이뤄진 것이라 오류로 보지 않는다 — "초기화"가 낡은 id 때문에 막히지 않는다.
export function useDeleteCustomScaleThreshold(options: { skipGlobalError?: boolean } = {}) {
  return useMutation({
    meta: { failure: '등락률 색상을 삭제하지 못했습니다.', ...options },
    mutationFn: async (id: number) => {
      try {
        await deleteCustomScaleThreshold(id)
      } catch (error) {
        if (!isScaleThresholdMissing(error)) throw error
      }
    },
  })
}
