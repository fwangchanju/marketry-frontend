import { useQuery, useQueryClient } from '@tanstack/react-query'
import client from '@/api/client'
import type { OverseasSheet } from '@/hooks/useOverseasSheet'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'

export type OverseasCategory = { id: number; parentId: number | null; name: string }
export type OverseasClassification = { sector: string | null; industry: string | null; subIndustry: string | null }
type DraftView = { categories: OverseasCategory[]; classifications: Record<string, OverseasClassification> }

// 일본·미국 분류 데이터 — MARKETRY 모드는 공개된 운영 분류를 읽기만 하고, 내 기준(관리자)은 초안을 읽고 고친다.
// 초안은 한 번에 업종과 종목 분류를 함께 받는다. 편집은 draftBase 아래 주소로 보낸다(MARKETRY 모드는 null — 편집 없음).
export function useOverseasClassificationData(market: OverseasMarket, sheet: OverseasSheet) {
  const { routeSegment } = overseasMarketInfo(market)
  const queryClient = useQueryClient()
  const isDraft = sheet === 'MINE'
  const draftBase = `/admin/overseas-classification-drafts/${market}`
  const draftKey = ['overseas-draft', market] as const
  const draft = useQuery({ queryKey: draftKey, enabled: isDraft, queryFn: async () => (await client.get<DraftView>(draftBase)).data })
  const publicCategories = useQuery({ queryKey: [routeSegment, 'categories'], enabled: !isDraft, queryFn: async () => (await client.get<OverseasCategory[]>(`/${routeSegment}/categories`)).data })
  const publicClassifications = useQuery({ queryKey: [routeSegment, 'classifications'], enabled: !isDraft, queryFn: async () => (await client.get<Record<string, OverseasClassification>>(`/${routeSegment}/classifications`)).data })
  const categories = isDraft
    ? { data: draft.data?.categories, isLoading: draft.isLoading, isError: draft.isError, refetch: draft.refetch }
    : { data: publicCategories.data, isLoading: publicCategories.isLoading, isError: publicCategories.isError, refetch: publicCategories.refetch }
  const classifications = isDraft
    ? { data: draft.data?.classifications, isLoading: draft.isLoading, isError: draft.isError, refetch: draft.refetch }
    : { data: publicClassifications.data, isLoading: publicClassifications.isLoading, isError: publicClassifications.isError, refetch: publicClassifications.refetch }
  // 편집이 끝나면 현재 모드의 데이터를 다시 받는다.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: isDraft ? draftKey : [routeSegment] })
  return { categories, classifications, editBase: isDraft ? draftBase : null, invalidate }
}
