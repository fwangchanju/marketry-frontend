import type { MarketQuote } from '@/markets/useMarketQuotes'

// 하루에 시세가 여러 개인 스냅샷 시장(미국)의 "애프터 마켓 등락률 기준"(한국의 종가·합산·별도와 같다, 2026-11-27 사용자 결정).
// 종가 줄(예: 미국 16:00)이 있는 날의 애프터마켓 시세가 최신일 때, 그 시각부터 다음 프리마켓 시세가 올 때까지 기준을 고를 수 있다.

// 기준 선택을 보여 줄지. 가장 최근 시세가 그날 종가 줄보다 늦으면(애프터마켓) true다. 다음 프리마켓 시세가 들어오면(날짜의 종가 줄이 아직 없다) false다.
export function isAfterHoursBasisVisible(times: readonly string[] | undefined, closeClock: string | null): boolean {
  if (times === undefined || closeClock === null || times.length === 0) return false
  const latest = times[times.length - 1]
  const close = `${latest.slice(0, 10)}T${closeClock}:00`
  return latest > close && times.includes(close)
}

// 별도(그날 종가 대비 현재가): 등락률의 기준을 전일 종가가 아니라 그날 종가 줄의 가격으로 바꾼다. 종가 줄에 없는 종목은 그대로 둔다.
export function applyAfterHoursBasis(latest: readonly MarketQuote[], close: readonly MarketQuote[]): MarketQuote[] {
  const closeByCode = new Map(close.map(quote => [quote.stockCode, quote]))
  return latest.map(quote => {
    const base = closeByCode.get(quote.stockCode)
    if (!base || base.currentPrice <= 0) return quote
    const changeRate = Math.round(((quote.currentPrice - base.currentPrice) / base.currentPrice) * 10000) / 100
    return { ...quote, lastPrice: base.currentPrice, changeRate }
  })
}
