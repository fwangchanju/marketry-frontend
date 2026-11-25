import type { MarketQuote as TreeQuote } from '@/markets/useMarketQuotes'
import type { HeatmapItem, HeatmapSectorNode } from '@/types/api'

export type TreeStock = { code: string; name: string }
export type TreeCategory = { id: number; parentId: number | null; name: string }
export type TreeClassification = { sector: string | null; industry: string | null; subIndustry: string | null }

export function shouldFilterStaleQuotes(snapshotTime: string | null, today: string, rangeStart: string | null): boolean {
  return rangeStart === null && snapshotTime?.slice(0, 10) === today
}

export function staleQuoteQueryState(enabled: boolean, snapshotLoading: boolean, snapshotError: boolean, previousTime: string | null, previousLoading: boolean, previousError: boolean) {
  return {
    isLoading: enabled && (snapshotLoading || (previousTime !== null && previousLoading)),
    isError: enabled && (snapshotError || (previousTime !== null && previousError)),
  }
}

export function findCloseSnapshotTime(snapshotTimes: readonly string[], date: string): string | null {
  return snapshotTimes.find(time => time.slice(0, 10) === date && time.slice(11, 16) === '15:30') ?? null
}

export function excludePreviousCloseQuotes(quotes: readonly TreeQuote[], previous: readonly TreeQuote[]): TreeQuote[] {
  const previousByCode = new Map(previous.filter(quote => quote.closeVerified === true).map(quote => [quote.stockCode, quote]))
  return quotes.filter(quote => {
    const close = previousByCode.get(quote.stockCode)
    return !close || (quote.changeRate === 0 && close.changeRate === 0) || quote.currentPrice !== close.currentPrice || quote.changeRate !== close.changeRate
  })
}

function toItem(quote: TreeQuote, name: string, snapshotTime: string): HeatmapItem {
  return {
    stockCode: quote.stockCode,
    stockName: name,
    alias: null,
    currentPrice: quote.currentPrice,
    lastPrice: quote.lastPrice,
    totalMarketValue: quote.totalMarketValue,
    marketValueTier: '',
    changeRate: quote.changeRate,
    snapshotTime,
  }
}

// 분류 목록과 종목 분류로 지도 트리를 만든다. 분류가 없거나 목록에 없는 값을 가진 종목은 미분류에 넣는다. 그 시각에 시세가 없는 종목은 지도에 그리지 않는다.
export function buildSnapshotTree(
  stocks: readonly TreeStock[],
  categories: readonly TreeCategory[],
  classifications: Readonly<Record<string, TreeClassification>>,
  names: Readonly<Record<string, string>>,
  quotes: readonly TreeQuote[],
  snapshotTime: string,
): HeatmapSectorNode[] {
  const nodes = new Map<number, HeatmapSectorNode>(categories.map(category => [category.id, { sectorId: category.id, sectorName: category.name, totalMarketValue: 0, isExcluded: false, children: [], items: [] }]))
  const roots: HeatmapSectorNode[] = []
  for (const category of categories) {
    const node = nodes.get(category.id)
    if (!node) continue
    const parent = category.parentId === null ? undefined : nodes.get(category.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const unclassified = roots.find(root => root.sectorName === '미분류')
  const quoteByCode = new Map(quotes.map(quote => [quote.stockCode, quote]))
  for (const stock of stocks) {
    const quote = quoteByCode.get(stock.code)
    if (!quote) continue
    const item = toItem(quote, names[stock.code] ?? stock.name, snapshotTime)
    const classification = classifications[stock.code]
    let current = roots.find(root => root.sectorName === classification?.sector)
    for (const name of [classification?.industry, classification?.subIndustry]) {
      if (!current || !name) break
      current = current.children.find(child => child.sectorName === name)
    }
    const target = current ?? unclassified
    if (target) target.items.push(item)
  }
  const sum = (node: HeatmapSectorNode): number => {
    node.totalMarketValue = node.items.reduce((total, item) => total + item.totalMarketValue, 0) + node.children.reduce((total, child) => total + sum(child), 0)
    return node.totalMarketValue
  }
  roots.forEach(sum)
  return roots
}
