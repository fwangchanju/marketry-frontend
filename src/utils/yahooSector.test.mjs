import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { yahooSectorKo } from './yahooSector.ts'

test('야후 섹터 11개를 한글로 바꾼다', () => {
  assert.equal(yahooSectorKo('Financial Services'), '금융')
  assert.equal(yahooSectorKo('Basic Materials'), '소재')
  assert.equal(yahooSectorKo('Communication Services'), '통신·미디어')
  assert.equal(yahooSectorKo('Industrials'), '산업재')
})

test('표에 없는 이름은 영어 그대로 둔다', () => {
  assert.equal(yahooSectorKo('Unknown Sector'), 'Unknown Sector')
  assert.equal(yahooSectorKo(''), '')
})

test('일본 종목 데이터의 야후 섹터가 전부 한글로 바뀐다', () => {
  const stocks = JSON.parse(readFileSync(new URL('../data/japanStocks.json', import.meta.url), 'utf8'))
  for (const stock of stocks) {
    assert.notEqual(yahooSectorKo(stock.sector), stock.sector, `${stock.code} ${stock.sector}`)
  }
})
