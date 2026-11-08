import type { JapanQuote } from '@/hooks/useJapanQuotes'

// 시작일의 전일 종가를 기준으로 종료 시세까지 계산하며, 기준가가 없는 종목은 제외한다.
export function calculateJapanPeriod(start: readonly JapanQuote[], end: readonly JapanQuote[]): JapanQuote[] {
  const baseByCode = new Map(start.map(quote => [quote.stockCode, quote.lastPrice]))
  return end.flatMap(quote => {
    const base = baseByCode.get(quote.stockCode)
    if (base === undefined || base <= 0) return []
    return [{ ...quote, lastPrice: base, changeRate: (quote.currentPrice / base - 1) * 100 }]
  })
}
