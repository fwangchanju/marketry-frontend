import type { HeatmapItem, HeatmapSectorNode } from '@/types/api'

export type JapanStock = { code: string; name: string; price: string; change: string; marketCap: string }
export type JapanCategory = { id: number; parentId: number | null; name: string }
export type JapanClassification = { sector: string | null; industry: string | null; subIndustry: string | null }

const toNumber = (text: string) => Number(text.replace(/[¥,]/g, ''))

// 제공받은 등락 표기("-23.00(0.68%)")의 등락폭과 등락률을 읽는다. 괄호 안 비율에는 부호가 없어 앞의 등락폭 부호를 쓴다.
export function parseJapanChange(change: string): { amount: number; rate: number } {
  const match = change.match(/^([+-]?[\d,.]+)\(([\d.]+)%\)$/)
  if (!match) return { amount: 0, rate: 0 }
  const amount = toNumber(match[1])
  return { amount, rate: amount < 0 ? -Number(match[2]) : Number(match[2]) }
}

// 제공받은 시가총액 표기("¥44조 1천억", "¥2,656억")를 엔 단위 숫자로 바꾼다.
export function parseJapanMarketCap(value: string): number {
  const text = value.replaceAll(',', '')
  const jo = Number(text.match(/(\d+)조/)?.[1] ?? 0)
  const rest = text.split('조').at(-1) ?? ''
  const eok = Number(rest.match(/(\d+)억/)?.[1] ?? 0)
  const thousandEok = Number(rest.match(/(\d+)천억/)?.[1] ?? 0)
  return (jo * 10000 + eok + thousandEok * 1000) * 100_000_000
}

function toItem(stock: JapanStock, name: string): HeatmapItem {
  const currentPrice = toNumber(stock.price)
  const { amount, rate } = parseJapanChange(stock.change)
  return {
    stockCode: stock.code,
    stockName: name,
    alias: null,
    currentPrice,
    lastPrice: currentPrice - amount,
    totalMarketValue: parseJapanMarketCap(stock.marketCap),
    marketValueTier: '',
    changeRate: rate,
    snapshotTime: '',
  }
}

// 분류 목록과 종목 분류로 지도 트리를 만든다. 분류가 없거나 목록에 없는 값을 가진 종목은 미분류에 넣어 225종목이 빠지지 않게 한다.
export function buildJapanTree(
  stocks: readonly JapanStock[],
  categories: readonly JapanCategory[],
  classifications: Readonly<Record<string, JapanClassification>>,
  names: Readonly<Record<string, string>>,
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
  for (const stock of stocks) {
    const item = toItem(stock, names[stock.code] ?? stock.name)
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
