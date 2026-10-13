import client from './client'
import { MarketSummaryResponseSchema } from '@/types/api'

export const getMarketSummary = () =>
  client.get('/summary').then(r => MarketSummaryResponseSchema.parse(r.data))
