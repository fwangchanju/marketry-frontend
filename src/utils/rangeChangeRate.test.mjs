import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildRangeChangeRateTree } from './rangeChangeRate.ts'

const tree = (code, currentPrice, lastPrice = currentPrice) => [{ sectorId: 1, sectorName: '업종', totalMarketValue: 100, children: [], items: [{ stockCode: code, stockName: code, alias: null, currentPrice, lastPrice, totalMarketValue: 100, marketValueTier: '', changeRate: 0, snapshotTime: '' }] }]
const rateOf = result => result.items[0].items[0].changeRate

test('분할 비율이 없으면 종가끼리 나눈다', () => {
  assert.equal(rateOf(buildRangeChangeRateTree(tree('A', 110), tree('A', 100))), 10)
})

test('50대 1 분할이 낀 기간은 기준가를 맞춰 -98%로 나오지 않는다', () => {
  const result = buildRangeChangeRateTree(tree('A', 55_000), tree('A', 2_500_000), 'close', '종가', { A: 0.02 })
  assert.equal(rateOf(result), 10)
  assert.equal(result.items[0].items[0].lastPrice, 50_000)
})

test('다른 종목의 비율은 영향을 주지 않는다', () => {
  assert.equal(rateOf(buildRangeChangeRateTree(tree('A', 110), tree('A', 100), 'close', '종가', { B: 0.5 })), 10)
})
