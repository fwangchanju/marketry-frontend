import type { MarketMapItem, MarketMapSectorNode } from '@/types/api'

export interface ExcludedStock {
  stockCode: string
  stockName: string
}

export interface RangeChangeRateResult {
  items: MarketMapSectorNode[]
  // 기준일 지도에 없어서 계산하지 못하고 뺀 종목(신규 상장 등) — 시가총액이 큰 순서다.
  excludedStocks: ExcludedStock[]
}

const roundTo2 = (value: number) => Math.round(value * 100) / 100

// 시작일 종가 지도(startRoots)의 "전일종가"가 시작일 하루 전 종가다. 종료일 종가 지도(endRoots)의 현재가(=종료일 종가)를 그 값과 비교해
// 기간 등락률을 만든다 — 2일~8일이면 1일 종가 대비 8일 종가다. 분류 트리와 시가총액은 종료일 지도 그대로 쓴다.
// 시작일 지도에 없는 종목은 계산할 수 없어 빼고, 종목이 하나도 안 남은 업종은 함께 지운다.
// baseKind — 'close'는 기준일 종가 지도의 종가(현재가)를, 'previousClose'는 시작일 지도의 전일종가를 기준 가격으로 쓴다(앞선 거래일이 없을 때의 대비책).
export type RangeBaseKind = 'close' | 'previousClose'

// endPriceLabel — 종료일 가격의 이름(종료일의 종가 지도면 '종가', 장중 실시간 지도면 '현재가'). 종목 팝업에 보인다.
export function buildRangeChangeRateTree(endRoots: MarketMapSectorNode[], startRoots: MarketMapSectorNode[], baseKind: RangeBaseKind = 'close', endPriceLabel = '종가'): RangeChangeRateResult {
  const basePriceByCode = new Map<string, number>()
  const collectBasePrices = (nodes: MarketMapSectorNode[]) => {
    for (const node of nodes) {
      for (const item of node.items) {
        const price = baseKind === 'close' ? item.currentPrice : item.lastPrice
        if (price > 0) basePriceByCode.set(item.stockCode, price)
      }
      collectBasePrices(node.children)
    }
  }
  collectBasePrices(startRoots)

  const excluded: { stock: ExcludedStock; marketValue: number }[] = []
  const convertItem = (item: MarketMapItem): MarketMapItem | null => {
    const basePrice = basePriceByCode.get(item.stockCode)
    if (basePrice === undefined) {
      excluded.push({ stock: { stockCode: item.stockCode, stockName: item.alias ?? item.stockName }, marketValue: item.totalMarketValue })
      return null
    }
    return { ...item, lastPrice: basePrice, changeRate: roundTo2((item.currentPrice / basePrice - 1) * 100), rangeLabels: { base: '기준가', end: endPriceLabel } }
  }
  const convertNodes = (nodes: MarketMapSectorNode[]): MarketMapSectorNode[] =>
    nodes.flatMap(node => {
      const items = node.items.flatMap(item => convertItem(item) ?? [])
      const children = convertNodes(node.children)
      if (items.length === 0 && children.length === 0) return []
      const totalMarketValue = items.reduce((sum, item) => sum + item.totalMarketValue, 0) + children.reduce((sum, child) => sum + child.totalMarketValue, 0)
      return [{ ...node, items, children, totalMarketValue }]
    })

  const items = convertNodes(endRoots)
  return { items, excludedStocks: excluded.sort((a, b) => b.marketValue - a.marketValue).map(entry => entry.stock) }
}
