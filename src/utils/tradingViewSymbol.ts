// 미국 종목 코드를 TradingView 위젯이 알아보는 이름으로 바꾼다. 티커를 그대로 쓰면 되고, 거래소 접두어 없이도 위젯이 알아본다(AAPL·KO·BRK.B 확인).
// 한국·일본 종목은 TradingView가 위젯 임베드를 막아서 위젯을 쓰지 않고 우리 일봉 차트(StockCandleChart)로 그린다.
export const toUsaTradingViewSymbol = (stockCode: string): string => stockCode

// 미국 차트의 시간대 — 뉴욕.
export const USA_CHART_TIMEZONE = 'America/New_York'
