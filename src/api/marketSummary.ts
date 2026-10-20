import client from './client'
import { z } from 'zod'
import { MarketSummaryResponseSchema, MarketOverviewItemSchema } from '@/types/api'

export const getMarketSummary = () =>
  client.get('/summary').then(r => MarketSummaryResponseSchema.parse(r.data))

export const getMarketIndexHistory = (month: string) =>
  client.get('/market-index-history', { params: { month } }).then(r => z.array(MarketOverviewItemSchema).parse(r.data))
