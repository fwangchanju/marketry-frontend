import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectExcludedSectorCounts } from './excludedSectorCounts.ts'

const stock = (totalMarketValue, marketValueTier = 'SMALL') => ({ totalMarketValue, marketValueTier })
const tree = [{ sectorId: 1, items: [stock(500), stock(0)], children: [
  { sectorId: 2, items: [stock(50), stock(150)], children: [] },
] }]

test('시가총액 범위와 0원 종목을 제외하고 하위 업종까지 센다', () => {
  const exclusions = Object.assign(new Set(), { marketValueRange: { min: 100, max: 400 } })
  const counts = collectExcludedSectorCounts(tree, exclusions)
  assert.equal(counts.get(1), 1)
  assert.equal(counts.get(2), 1)
})

test('등급 제외와 빈 업종을 반영한다', () => {
  const counts = collectExcludedSectorCounts(tree, new Set(['SMALL']))
  assert.equal(counts.get(1), 0)
  assert.equal(counts.get(2), 0)
})
