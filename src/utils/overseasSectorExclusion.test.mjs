import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildExcludedSectorRows, collectCoveredExcludedIds, countVisibleItems, findSectorPath } from './overseasSectorExclusion.ts'

const item = (code, value) => ({ stockCode: code, stockName: code, alias: null, lastPrice: 1, totalMarketValue: value, marketValueTier: '', changeRate: 0 })
const node = (sectorId, sectorName, items, children = []) => ({ sectorId, sectorName, totalMarketValue: 0, items, children })
const tree = [
  node(1, '금융', [item('A', 10)], [node(11, '은행', [item('B', 20), item('C', 30)])]),
  node(2, '반도체', [item('D', 40)]),
]
const NONE = new Set()

test('업종 id의 이름 경로를 대분류부터 돌려준다', () => {
  assert.deepEqual(findSectorPath(tree, 11), ['금융', '은행'])
  assert.equal(findSectorPath(tree, 99), null)
})

test('제외한 업종과 그 하위 종목은 종목 수에서 빠진다', () => {
  assert.equal(countVisibleItems(tree, NONE, NONE), 4)
  assert.equal(countVisibleItems(tree, new Set([11]), NONE), 2)
  assert.equal(countVisibleItems(tree, new Set([1]), NONE), 1)
})

test('시가총액 범위도 함께 적용한다', () => {
  const range = Object.assign(new Set(), { marketValueRange: { min: 25, max: null } })
  assert.equal(countVisibleItems(tree, NONE, range), 2)
})

test('상위 업종도 제외된 업종은 흐리게 보이도록 표시한다', () => {
  assert.deepEqual([...collectCoveredExcludedIds(tree, new Set([1, 11]))], [11])
  assert.deepEqual([...collectCoveredExcludedIds(tree, new Set([11]))], [])
})

test('제외 목록 줄은 이름순이고 종목 수를 담으며 사라진 업종은 뺀다', () => {
  const rows = buildExcludedSectorRows(tree, [2, 11, 99], NONE)
  assert.deepEqual(rows.map(row => [row.sectorName, row.stockCount, row.coveredByParent]), [['금융 > 은행', 2, false], ['반도체', 1, false]])
  assert.deepEqual(buildExcludedSectorRows(tree, [], NONE), [])
})
