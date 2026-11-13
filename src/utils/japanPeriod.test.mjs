import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateJapanPeriod } from './japanPeriod.ts'

const quote = (stockCode, currentPrice, lastPrice) => ({ stockCode, currentPrice, lastPrice, changeRate: 0, totalMarketValue: 1000 })
test('시작일 전일 종가부터 종료 시세까지 기간 등락률을 계산한다', () => {
  const result = calculateJapanPeriod([quote('A', 100, 80)], [quote('A', 120, 110)])
  assert.equal(result[0].changeRate, 50)
  assert.equal(result[0].lastPrice, 80)
  assert.equal(result[0].totalMarketValue, 1000)
})
test('기준가가 없거나 0인 종목은 기간 결과에서 제외한다', () => {
  assert.deepEqual(calculateJapanPeriod([quote('A', 100, 0)], [quote('A', 120, 110), quote('B', 10, 9)]), [])
})
test('미국 종목처럼 다른 필드가 붙은 시세에도 같은 계산을 하고 필드를 그대로 둔다', () => {
  const us = (stockCode, currentPrice, lastPrice) => ({ stockCode, currentPrice, lastPrice, changeRate: 0, totalMarketValue: 5000, closeVerified: null })
  const result = calculateJapanPeriod([us('NVDA', 190, 200)], [us('NVDA', 180, 185), us('NEW', 10, 9)])
  assert.equal(result.length, 1)
  assert.equal(result[0].stockCode, 'NVDA')
  assert.equal(result[0].lastPrice, 200)
  assert.ok(Math.abs(result[0].changeRate - -10) < 1e-9)
  assert.equal(result[0].closeVerified, null)
})
