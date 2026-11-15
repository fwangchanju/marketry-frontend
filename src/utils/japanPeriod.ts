// 시작일의 전일 종가를 기준으로 종료 시세까지 계산하며, 기준가가 없는 종목은 제외한다. 일본·미국 기간 보기가 함께 쓴다.
type PeriodQuote = { stockCode: string; currentPrice: number; lastPrice: number; changeRate: number }

export interface PeriodExcludedStock {
  stockCode: string
  // 종료일 시가총액 — 제외 종목을 시가총액 순으로 적기 위해 쓴다.
  marketValue: number
}

// 기준가가 없어 뺀 종목(신규 상장 등)을 함께 돌려준다. 시가총액이 큰 순서다.
export function calculatePeriodDetailed<T extends PeriodQuote & { totalMarketValue?: number }>(start: readonly T[], end: readonly T[]): { quotes: T[]; excluded: PeriodExcludedStock[] } {
  const baseByCode = new Map(start.map(quote => [quote.stockCode, quote.lastPrice]))
  const quotes: T[] = []
  const excluded: PeriodExcludedStock[] = []
  for (const quote of end) {
    const base = baseByCode.get(quote.stockCode)
    if (base === undefined || base <= 0) {
      excluded.push({ stockCode: quote.stockCode, marketValue: quote.totalMarketValue ?? 0 })
      continue
    }
    quotes.push({ ...quote, lastPrice: base, changeRate: (quote.currentPrice / base - 1) * 100 })
  }
  return { quotes, excluded: excluded.sort((a, b) => b.marketValue - a.marketValue) }
}

export function calculateJapanPeriod<T extends PeriodQuote>(start: readonly T[], end: readonly T[]): T[] {
  return calculatePeriodDetailed(start, end).quotes
}
