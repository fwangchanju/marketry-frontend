import { useMemo } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import client from '@/api/client'
import type { OverseasSheet } from '@/hooks/useOverseasSheet'
import { useOverseasMiddle } from '@/hooks/useOverseasMiddle'
import { useUsaGicsClassifications } from '@/hooks/useUsaGicsClassifications'
import { buildUsaGicsTree } from '@/utils/usaGicsTree'
import { overseasMarketInfo, type OverseasMarket } from '@/utils/markets'

export type OverseasCategory = { id: number; parentId: number | null; name: string }
export type OverseasClassification = { sector: string | null; industry: string | null; subIndustry: string | null }
type DraftView = { categories: OverseasCategory[]; classifications: Record<string, OverseasClassification> }

// 일본·미국 분류 데이터.
// - MARKETRY 모드: 공개된 MARKETRY 분류를 읽는다.
// - 내 기준(관리자): 사본 분류를 읽고 고친다.
// - 가운데 칸 외부 분류(미국 GICS): GICS를 읽기 전용으로 쓴다. 편집 주소는 없다(editBase null).
export function useOverseasClassificationData(market: OverseasMarket, sheet: OverseasSheet) {
  const { routeSegment } = overseasMarketInfo(market)
  const queryClient = useQueryClient()
  const [middle] = useOverseasMiddle(market)
  const isExternal = middle === 'EXTERNAL' && market === 'USA'
  const isDraft = sheet === 'MINE' && !isExternal
  const draftBase = `/admin/overseas-classification-drafts/${market}`
  const draftKey = ['overseas-draft', market] as const
  const draft = useQuery({ queryKey: draftKey, enabled: isDraft, queryFn: async () => (await client.get<DraftView>(draftBase)).data })
  const publicCategories = useQuery({ queryKey: [routeSegment, 'categories'], enabled: !isDraft && !isExternal, queryFn: async () => (await client.get<OverseasCategory[]>(`/${routeSegment}/categories`)).data })
  const publicClassifications = useQuery({ queryKey: [routeSegment, 'classifications'], enabled: !isDraft && !isExternal, queryFn: async () => (await client.get<Record<string, OverseasClassification>>(`/${routeSegment}/classifications`)).data })
  const gics = useUsaGicsClassifications(isExternal)
  const gicsTree = useMemo(() => (gics.data ? buildUsaGicsTree(gics.data) : null), [gics.data])

  const source = isExternal
    ? { categories: gicsTree?.categories, classifications: gicsTree?.classifications, isLoading: gics.isLoading, isError: gics.isError, isFetching: gics.isFetching, refetch: gics.refetch }
    : isDraft
      ? { categories: draft.data?.categories, classifications: draft.data?.classifications, isLoading: draft.isLoading, isError: draft.isError, isFetching: draft.isFetching, refetch: draft.refetch }
      : {
          categories: publicCategories.data,
          classifications: publicClassifications.data,
          isLoading: publicCategories.isLoading || publicClassifications.isLoading,
          isError: publicCategories.isError || publicClassifications.isError,
          isFetching: publicCategories.isFetching || publicClassifications.isFetching,
          refetch: () => Promise.all([publicCategories.refetch(), publicClassifications.refetch()]),
        }
  const categories = { data: source.categories, isLoading: source.isLoading, isError: source.isError, isFetching: source.isFetching, refetch: source.refetch }
  const classifications = { data: source.classifications, isLoading: source.isLoading, isError: source.isError, isFetching: source.isFetching, refetch: source.refetch }
  // 내 기준을 고치면 설정창 맨 아래 시각도 다시 받는다.
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['overseas-time', market] })
    return queryClient.invalidateQueries({ queryKey: isDraft ? draftKey : [routeSegment] })
  }
  return { categories, classifications, editBase: isDraft ? draftBase : null, invalidate }
}
