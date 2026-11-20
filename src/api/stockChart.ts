import client from './client'
import { z } from 'zod'

// 종목 일봉 한 칸 — 서버(/api/stocks/{code}/daily-candles)가 오래된 날부터 준다. 한국 원주가라 분할 전후의 가격은 이어 붙이지 않는다.
const StockDailyCandleSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
  // 아직 일봉이 저장되지 않은 날(장중)의 임시 봉 — 5분 시세로 만들어 시가·고가·저가가 실제와 다를 수 있고 거래량은 0이다.
  provisional: z.boolean().optional(),
})
export type StockDailyCandle = z.infer<typeof StockDailyCandleSchema>

export const getStockDailyCandles = (stockCode: string, days: number, signal?: AbortSignal) =>
  client
    .get(`/stocks/${encodeURIComponent(stockCode)}/daily-candles`, { params: { days }, signal })
    .then(r => z.array(StockDailyCandleSchema).parse(r.data))

// 일본 종목 일봉 — 야후에서 받아 저장한 값이다.
export const getJapanStockDailyCandles = (stockCode: string, days: number, signal?: AbortSignal) =>
  client
    .get(`/stocks/japan/${encodeURIComponent(stockCode)}/daily-candles`, { params: { days }, signal })
    .then(r => z.array(StockDailyCandleSchema).parse(r.data))

// 미국 종목 일봉 — 야후에서 받아 저장한 값이다.
export const getUsaStockDailyCandles = (stockCode: string, days: number, signal?: AbortSignal) =>
  client
    .get(`/stocks/usa/${encodeURIComponent(stockCode)}/daily-candles`, { params: { days }, signal })
    .then(r => z.array(StockDailyCandleSchema).parse(r.data))
