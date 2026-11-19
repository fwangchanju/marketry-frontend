// 지도의 종목 코드를 TradingView 위젯이 알아보는 이름으로 바꾼다.
// - 한국: 코스피·코스닥 모두 KRX 하나로 묶인다(위젯에서는 TradingView가 한국 거래소 종목의 임베드를 막아 현재 표시되지 않는다).
// - 미국: 티커를 그대로 쓴다. 거래소 접두어 없이도 위젯이 알아본다(AAPL·KO·BRK.B 확인).
// - 일본: 도쿄 거래소(TSE) 코드(위젯에서는 한국처럼 TradingView가 임베드를 막아 현재 표시되지 않는다).
export type ChartMarket = 'korea' | 'usa' | 'japan'

export function toTradingViewSymbol(market: ChartMarket, stockCode: string): string {
  switch (market) {
    case 'korea':
      return `KRX:${stockCode}`
    case 'usa':
      return stockCode
    case 'japan':
      return `TSE:${stockCode}`
  }
}

// 차트의 시간대 — 한국은 서울, 미국은 뉴욕.
export const CHART_TIMEZONE: Record<ChartMarket, string> = { korea: 'Asia/Seoul', usa: 'America/New_York', japan: 'Asia/Tokyo' }
