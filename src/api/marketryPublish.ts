import { marketParams } from './custom'
import type { ClassificationMarket } from '@/utils/markets'
import client from './client'
import { z } from 'zod'

// MARKETRY 올리기·버전 목록·되돌리기 — 관리자(ADMIN)만 쓸 수 있다(서버가 /api/admin/** 규칙으로 막는다).
const MarketryPublicationSchema = z.object({
  id: z.number(),
  label: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type MarketryPublication = z.infer<typeof MarketryPublicationSchema>

export const publishMarketry = (label: string, market: ClassificationMarket = 'KOREA') =>
  client.post('/admin/marketry/publications', { label }, { params: marketParams(market) }).then(r => MarketryPublicationSchema.parse(r.data))

export const getMarketryPublications = (market: ClassificationMarket = 'KOREA') =>
  client.get('/admin/marketry/publications', { params: marketParams(market) }).then(r => z.array(MarketryPublicationSchema).parse(r.data))

export const restoreMarketryPublication = (publicationId: number, market: ClassificationMarket = 'KOREA') =>
  client.post(`/admin/marketry/publications/${publicationId}/restore`, undefined, { params: marketParams(market) })
