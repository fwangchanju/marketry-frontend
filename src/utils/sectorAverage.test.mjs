import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeSector } from './sectorAverage.ts'

const stock = (name, changeRate, totalMarketValue, marketValueTier = 'LARGE') => ({ stockName: name, changeRate, totalMarketValue, marketValueTier })
const none = new Set()

// 금융 = 은행(제외 아님) + 지주(제외). 제외한 하위 업종의 종목도 업종 숫자에 들어가야 PC·텔레그램과 같다.
const finance = {
  sectorId: 1,
  sectorName: '금융',
  items: [],
  children: [
    { sectorId: 2, sectorName: '은행', isExcluded: false, items: [stock('A', 2, 100), stock('B', -1, 100)], children: [] },
    { sectorId: 3, sectorName: '지주', isExcluded: true, items: [stock('H', -4, 300)], children: [] },
  ],
}

test('제외한 하위 업종의 종목도 등락률·시총·종목 수에 넣는다', () => {
  const summary = summarizeSector(finance, none)
  // 시총 가중: (2*100 - 1*100 - 4*300) / 500 = -2.2
  assert.equal(Math.round(summary.weightedAvg * 100) / 100, -2.2)
  assert.equal(summary.marketValue, 500)
  assert.deepEqual([summary.advancers, summary.decliners, summary.unchanged], [1, 2, 0])
  // 동일 가중: (2 - 1 - 4) / 3 = -1
  assert.equal(summary.simpleAvg, -1)
  assert.equal(summary.items.length, 3)
})

test('시가총액 구간 제외만 뺀다', () => {
  const summary = summarizeSector(finance, new Set(['SMALL']))
  assert.equal(summary.items.length, 3)
  const withSmall = { ...finance, children: [{ ...finance.children[0], items: [stock('A', 2, 100), stock('S', 10, 10, 'SMALL')] }] }
  const filtered = summarizeSector(withSmall, new Set(['SMALL']))
  assert.equal(filtered.items.length, 1)
  assert.equal(filtered.weightedAvg, 2)
})

test('남는 종목이 없으면 null이다', () => {
  const onlySmall = { sectorId: 9, sectorName: '작은업종', items: [stock('S', 5, 10, 'SMALL')], children: [] }
  assert.equal(summarizeSector(onlySmall, new Set(['SMALL'])), null)
})
