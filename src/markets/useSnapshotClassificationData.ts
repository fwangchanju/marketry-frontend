import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import { useCustomSectors, useStockAssignments } from '@/hooks/useHeatmapCustom'
import { customHeatmapKeys } from '@/hooks/queryKeys'
import type { SnapshotSheet } from '@/markets/useSnapshotSheet'
import type { SectorItem } from '@/types/api'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'

// stableKey·legacyId는 MARKETRY를 새 자리로 옮긴 뒤에만 온다. excluded는 내 기준 업종의 제외 여부다.
export type SnapshotCategory = { id: number; parentId: number | null; name: string; stableKey?: string | null; legacyId?: number | null; excluded?: boolean }
export type SnapshotClassification = { sector: string | null; industry: string | null; subIndustry: string | null }

// 내 기준 업종과 종목 배정을 MARKETRY와 같은 모양(업종 목록 + 종목별 분류 이름)으로 바꾼다.
function toClassifications(sectors: readonly SectorItem[], assignments: Readonly<Record<string, number>>): Record<string, SnapshotClassification> {
  const byId = new Map(sectors.map(sector => [sector.id, sector]))
  const pathOf = (id: number) => {
    const names: string[] = []
    for (let current = byId.get(id); current; current = current.parentId === null ? undefined : byId.get(current.parentId)) names.unshift(current.name)
    return names
  }
  return Object.fromEntries(Object.entries(assignments).map(([code, sectorId]) => {
    const path = pathOf(sectorId)
    return [code, { sector: path[0] ?? null, industry: path[1] ?? null, subIndustry: path[2] ?? null }]
  }))
}

// 일본·미국 분류 데이터 — MARKETRY 모드는 공개된 MARKETRY 분류를 읽기만 하고, 내 기준은 한국과 같은 회원 분류(시장만 다르다)를 읽는다.
// 편집은 한국과 같은 훅(시장을 넘긴다)이 하고, 끝나면 그 훅이 이 데이터를 다시 받게 한다.
export function useSnapshotClassificationData(market: SnapshotMarket, sheet: SnapshotSheet) {
  const { routeSegment } = snapshotMarketInfo(market)
  const queryClient = useQueryClient()
  const isMine = sheet === 'MINE'
  const sectors = useCustomSectors({ market, enabled: isMine })
  const assignments = useStockAssignments(market, { enabled: isMine })
  const publicCategories = useQuery({ queryKey: [routeSegment, 'categories'], enabled: !isMine, queryFn: async () => (await client.get<SnapshotCategory[]>(`/${routeSegment}/categories`)).data })
  const publicClassifications = useQuery({ queryKey: [routeSegment, 'classifications'], enabled: !isMine, queryFn: async () => (await client.get<Record<string, SnapshotClassification>>(`/${routeSegment}/classifications`)).data })
  const mineCategories = useMemo(() => sectors.data?.map((sector): SnapshotCategory => ({ id: sector.id, parentId: sector.parentId, name: sector.name, excluded: sector.excluded ?? false })), [sectors.data])
  const mineClassifications = useMemo(() => (sectors.data && assignments.data ? toClassifications(sectors.data, assignments.data) : undefined), [sectors.data, assignments.data])
  const categories = isMine
    ? { data: mineCategories, isLoading: sectors.isLoading, isError: sectors.isError, isFetching: sectors.isFetching, refetch: sectors.refetch }
    : { data: publicCategories.data, isLoading: publicCategories.isLoading, isError: publicCategories.isError, isFetching: publicCategories.isFetching, refetch: publicCategories.refetch }
  const classifications = isMine
    ? { data: mineClassifications, isLoading: sectors.isLoading || assignments.isLoading, isError: sectors.isError || assignments.isError, isFetching: sectors.isFetching || assignments.isFetching, refetch: () => Promise.all([sectors.refetch(), assignments.refetch()]) }
    : { data: publicClassifications.data, isLoading: publicClassifications.isLoading, isError: publicClassifications.isError, isFetching: publicClassifications.isFetching, refetch: publicClassifications.refetch }
  // 업종마다 담긴 종목 — 내 기준 표의 행이 업종 번호를 바로 쓴다.
  const sectorIdByCode = isMine ? assignments.data : undefined
  // 지금 모드의 데이터를 다시 받는다. 설정창 맨 아래 시각도 다시 받는다.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['overseas-time', market] })
    return isMine
      ? Promise.all([queryClient.invalidateQueries({ queryKey: customHeatmapKeys.sectors(market) }), queryClient.invalidateQueries({ queryKey: customHeatmapKeys.stockAssignments(market) })])
      : queryClient.invalidateQueries({ queryKey: [routeSegment] })
  }
  return { categories, classifications, sectorIdByCode, invalidate }
}
