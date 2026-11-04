import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildJapanTree, parseJapanChange, parseJapanMarketCap } from './japanMap.ts'

test('등락 표기는 등락폭의 부호를 등락률에 붙인다', () => {
  assert.deepEqual(parseJapanChange('-23.00(0.68%)'), { amount: -23, rate: -0.68 })
  assert.deepEqual(parseJapanChange('+1,023.50(2.10%)'), { amount: 1023.5, rate: 2.1 })
  assert.deepEqual(parseJapanChange('0.00(0.00%)'), { amount: 0, rate: 0 })
})

test('시가총액 표기는 엔 단위 숫자로 바꾼다', () => {
  assert.equal(parseJapanMarketCap('¥44조 1천억'), 44.1e12)
  assert.equal(parseJapanMarketCap('¥1조 2,345억'), 1.2345e12)
  assert.equal(parseJapanMarketCap('¥2,656억'), 2656e8)
})

const stock = (code, name = code) => ({ code, name, price: '¥100.00', change: '+10.00(11.11%)', marketCap: '¥1조' })
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
  }, { 8750: '다이이치' })
  const finance = tree.find(node => node.sectorName === '금융')
  const insurance = finance.children[0]
  assert.equal(finance.totalMarketValue, 2e12)
  assert.deepEqual(insurance.items.map(item => item.stockCode), ['8766'])
  assert.equal(insurance.children[0].items[0].stockName, '다이이치')
  assert.equal(insurance.children[0].items[0].lastPrice, 90)
})

test('분류가 없거나 목록에 없는 종목은 미분류에 넣는다', () => {
  const tree = buildJapanTree([stock('1111'), stock('2222')], categories, {
    2222: { sector: '없는 분류', industry: null, subIndustry: null },
  }, {})
  assert.deepEqual(tree.find(node => node.sectorName === '미분류').items.map(item => item.stockCode), ['1111', '2222'])
})
