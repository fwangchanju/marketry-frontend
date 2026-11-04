import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildJapanTree } from './japanMap.ts'

const TIME = '2026-11-04T15:30:00'
const stock = code => ({ code, name: code })
const quote = stockCode => ({ stockCode, currentPrice: 100, lastPrice: 90, changeRate: 11.11, totalMarketValue: 1e12 })
const categories = [
  { id: 1, parentId: null, name: '금융' },
  { id: 2, parentId: 1, name: '보험' },
  { id: 3, parentId: 2, name: '생명 보험' },
  { id: 4, parentId: null, name: '미분류' },
]

test('분류 단계대로 종목을 넣고 시가총액을 위로 합친다', () => {
  const tree = buildJapanTree([stock('8750'), stock('8766')], categories, {
    8750: { sector: '금융', industry: '보험', subIndustry: '생명 보험' },
    8766: { sector: '금융', industry: '보험', subIndustry: null },
  }, { 8750: '다이이치' }, [quote('8750'), quote('8766')], TIME)
  const finance = tree.find(node => node.sectorName === '금융')
  const insurance = finance.children[0]
  assert.equal(finance.totalMarketValue, 2e12)
  assert.deepEqual(insurance.items.map(item => item.stockCode), ['8766'])
  assert.equal(insurance.children[0].items[0].stockName, '다이이치')
  assert.equal(insurance.children[0].items[0].snapshotTime, TIME)
})

test('분류가 없거나 목록에 없는 종목은 미분류에 넣는다', () => {
  const tree = buildJapanTree([stock('1111'), stock('2222')], categories, {
    2222: { sector: '없는 분류', industry: null, subIndustry: null },
  }, {}, [quote('1111'), quote('2222')], TIME)
  assert.deepEqual(tree.find(node => node.sectorName === '미분류').items.map(item => item.stockCode), ['1111', '2222'])
})

test('그 시각에 시세가 없는 종목은 그리지 않는다', () => {
  const tree = buildJapanTree([stock('1111'), stock('2222')], categories, {}, {}, [quote('1111')], TIME)
  assert.deepEqual(tree.find(node => node.sectorName === '미분류').items.map(item => item.stockCode), ['1111'])
})
