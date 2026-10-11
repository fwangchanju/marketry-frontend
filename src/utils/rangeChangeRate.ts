import type { MarketMapItem, MarketMapSectorNode } from '@/types/api'

export interface RangeChangeRateResult {
  items: MarketMapSectorNode[]
  // 시작일 지도에 없어서 계산하지 못하고 뺀 종목 수(신규 상장 등).
  excludedStockCount: number
}

const roundTo2 = (value: number) => Math.round(value * 100) / 100

// 시작일 종가 지도(startRoots)의 "전일종가"가 시작일 하루 전 종가다. 끝일 종가 지도(endRoots)의 현재가(=끝일 종가)를 그 값과 비교해
// 기간 등락률을 만든다 — 2일~8일이면 1일 종가 대비 8일 종가다. 분류 트리와 시가총액은 끝일 지도 그대로 쓴다.
// 시작일 지도에 없는 종목은 계산할 수 없어 빼고, 종목이 하나도 안 남은 업종은 함께 지운다.
// baseKind — 'close'는 기준일 종가 지도의 종가(현재가)를, 'previousClose'는 시작일 지도의 전일종가를 기준 가격으로 쓴다(앞선 거래일이 없을 때의 대비책).
export type RangeBaseKind = 'close' | 'previousClose'

export function buildRangeChangeRateTree(endRoots: MarketMapSectorNode[], startRoots: MarketMapSectorNode[], baseKind: RangeBaseKind = 'close'): RangeChangeRateResult {
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

  let excludedStockCount = 0
  const convertItem = (item: MarketMapItem): MarketMapItem | null => {
    const basePrice = basePriceByCode.get(item.stockCode)
    if (basePrice === undefined) {
      excludedStockCount += 1
      return null
    }
    return { ...item, lastPrice: basePrice, changeRate: roundTo2((item.currentPrice / basePrice - 1) * 100) }
  }
  const convertNodes = (nodes: MarketMapSectorNode[]): MarketMapSectorNode[] =>
    nodes.flatMap(node => {
      const items = node.items.flatMap(item => convertItem(item) ?? [])
      const children = convertNodes(node.children)
      if (items.length === 0 && children.length === 0) return []
      const totalMarketValue = items.reduce((sum, item) => sum + item.totalMarketValue, 0) + children.reduce((sum, child) => sum + child.totalMarketValue, 0)
      return [{ ...node, items, children, totalMarketValue }]
    })

  return { items: convertNodes(endRoots), excludedStockCount }
}
