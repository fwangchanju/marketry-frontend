import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildJapanTree, excludePreviousCloseQuotes, findJapanCloseSnapshotTime, japanFilterQueryState, shouldFilterJapanQuotes } from './japanMap.ts'

const TIME = '2026-11-04T15:30:00'
const stock = code => ({ code, name: code })
const quote = stockCode => ({ stockCode, currentPrice: 100, lastPrice: 90, changeRate: 11.11, totalMarketValue: 1e12 })
const categories = [
  { id: 1, parentId: null, name: '금융' },
  { id: 2, parentId: 1, name: '보험' },
  { id: 3, parentId: 2, name: '생명 보험' },
  { id: 4, parentId: null, name: '미분류' },
]

test('전일 가격과 등락률이 모두 같은 종목만 지도에서 제외한다', () => {
  const previous = [quote('2914'), quote('4519'), quote('5214')].map(item => ({ ...item, closeVerified: true }))
  const current = [quote('2914'), { ...quote('4519'), changeRate: 0 }, { ...quote('5214'), currentPrice: 101 }, quote('9999')]
  assert.deepEqual(excludePreviousCloseQuotes(current, previous).map(item => item.stockCode), ['4519', '5214', '9999'])
})

test('직전 거래일 종가가 확인되지 않은 종목은 비교 대상에서 제외하지 않는다', () => {
  const previous = [{ ...quote('2914'), closeVerified: false }]
  const current = [quote('2914')]
  assert.deepEqual(excludePreviousCloseQuotes(current, previous), current)
})

test('직전 거래일 15시 30분 종가가 없으면 더 오래된 날짜를 대신 선택하지 않는다', () => {
  assert.equal(findJapanCloseSnapshotTime([
    '2026-11-05T15:30:00',
    '2026-11-09T15:30:00',
  ], '2026-11-06'), null)
  assert.equal(findJapanCloseSnapshotTime([
    '2026-11-06T15:25:00',
    '2026-11-06T15:30:00',
  ], '2026-11-06'), '2026-11-06T15:30:00')
})

test('전일과 당일이 모두 0%면 가격이 같아도 표시한다', () => {
  const unchanged = { ...quote('2914'), changeRate: 0, closeVerified: true }
  assert.deepEqual(excludePreviousCloseQuotes([unchanged], [unchanged]), [unchanged])
})

test('당일 하루 지도에만 전일값 필터를 적용한다', () => {
  assert.equal(shouldFilterJapanQuotes('2026-11-09T09:10:00', '2026-11-09', null), true)
  assert.equal(shouldFilterJapanQuotes('2026-11-06T15:30:00', '2026-11-09', null), false)
  assert.equal(shouldFilterJapanQuotes('2026-11-09T15:30:00', '2026-11-09', '2026-11-06T15:30:00'), false)
  assert.equal(shouldFilterJapanQuotes(null, '2026-11-09', null), false)
})

test('전일 비교 조회 상태는 당일 필터가 켜졌을 때만 지도를 막는다', () => {
  assert.deepEqual(japanFilterQueryState(false, true, true, '2026-11-06T15:30:00', true, true), { isLoading: false, isError: false })
  assert.deepEqual(japanFilterQueryState(true, true, false, null, false, false), { isLoading: true, isError: false })
  assert.deepEqual(japanFilterQueryState(true, false, false, '2026-11-06T15:30:00', false, true), { isLoading: false, isError: true })
})

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
