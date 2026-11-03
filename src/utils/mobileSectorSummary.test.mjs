import assert from 'node:assert/strict'
import { test } from 'node:test'
import { summarizeMobileSector } from './mobileSectorSummary.ts'

const stock = (stockCode, totalMarketValue, changeRate = 0, marketValueTier = 'LARGE') => ({ stockCode, stockName: stockCode, totalMarketValue, changeRate, marketValueTier })

test('모바일 업종 집계는 하위 분류를 포함하되 중복 종목코드는 한 번만 합산한다', () => {
  const shared = stock('A', 100, 2)
  const node = {
    sectorId: 1,
    sectorName: 'S7',
    items: [shared],
    children: [{ sectorId: 2, sectorName: '삼성 그룹', items: [shared, stock('B', 300, -1)], children: [] }],
  }

  const summary = summarizeMobileSector(node, new Set())

  assert.equal(summary.marketValue, 400)
  assert.equal(summary.items.length, 2)
  assert.equal(summary.weightedAvg, -0.25)
  assert.deepEqual([summary.advancers, summary.decliners, summary.unchanged], [1, 1, 0])
})

test('모바일 업종 집계는 제외 구간을 반영한다', () => {
  const node = { sectorId: 1, sectorName: '업종', items: [stock('A', 100), stock('B', 300, 0, 'SMALL')], children: [] }
  const summary = summarizeMobileSector(node, new Set(['SMALL']))

  assert.equal(summary.marketValue, 100)
  assert.equal(summary.items.length, 1)
})
