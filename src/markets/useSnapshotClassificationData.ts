import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import type { SnapshotSheet } from '@/markets/useSnapshotSheet'
import { snapshotMarketInfo, type SnapshotMarket } from '@/utils/markets'

export type SnapshotCategory = { id: number; parentId: number | null; name: string }
export type SnapshotClassification = { sector: string | null; industry: string | null; subIndustry: string | null }
type DraftView = { categories: SnapshotCategory[]; classifications: Record<string, SnapshotClassification> }

// 일본·미국 분류 데이터 — MARKETRY 모드는 공개된 운영 분류를 읽기만 하고, 내 기준(관리자)은 초안을 읽고 고친다.
// 초안은 한 번에 업종과 종목 분류를 함께 받는다. 편집은 draftBase 아래 주소로 보낸다(MARKETRY 모드는 null — 편집 없음).
export function useSnapshotClassificationData(market: SnapshotMarket, sheet: SnapshotSheet) {
  const { routeSegment } = snapshotMarketInfo(market)
  const queryClient = useQueryClient()
  const isDraft = sheet === 'MINE'
  const draftBase = `/admin/overseas-classification-drafts/${market}`
  const draftKey = ['overseas-draft', market] as const
  const draft = useQuery({ queryKey: draftKey, enabled: isDraft, queryFn: async () => (await client.get<DraftView>(draftBase)).data })
  const publicCategories = useQuery({ queryKey: [routeSegment, 'categories'], enabled: !isDraft, queryFn: async () => (await client.get<SnapshotCategory[]>(`/${routeSegment}/categories`)).data })
  const publicClassifications = useQuery({ queryKey: [routeSegment, 'classifications'], enabled: !isDraft, queryFn: async () => (await client.get<Record<string, SnapshotClassification>>(`/${routeSegment}/classifications`)).data })
  const categories = isDraft
    ? { data: draft.data?.categories, isLoading: draft.isLoading, isError: draft.isError, isFetching: draft.isFetching, refetch: draft.refetch }
    : { data: publicCategories.data, isLoading: publicCategories.isLoading, isError: publicCategories.isError, isFetching: publicCategories.isFetching, refetch: publicCategories.refetch }
  const classifications = isDraft
    ? { data: draft.data?.classifications, isLoading: draft.isLoading, isError: draft.isError, isFetching: draft.isFetching, refetch: draft.refetch }
    : { data: publicClassifications.data, isLoading: publicClassifications.isLoading, isError: publicClassifications.isError, isFetching: publicClassifications.isFetching, refetch: publicClassifications.refetch }
  // 편집이 끝나면 현재 모드의 데이터를 다시 받는다.
  // 내 기준을 고치면 설정창 맨 아래 시각도 다시 받는다.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['overseas-time', market] })
    return queryClient.invalidateQueries({ queryKey: isDraft ? draftKey : [routeSegment] })
  }
  return { categories, classifications, editBase: isDraft ? draftBase : null, invalidate }
}
