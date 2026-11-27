import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyAfterHoursBasis, isAfterHoursBasisVisible } from './afterHoursBasis.ts'

test('애프터마켓 시세가 최신이고 그날 종가 줄이 있으면 기준 선택을 보인다', () => {
  const times = ['2026-11-25T16:00:00', '2026-11-25T16:05:00', '2026-11-25T19:55:00']
  assert.equal(isAfterHoursBasisVisible(times, '16:00'), true)
})

test('정규장 중이거나 종가 줄이 없거나 다음 날 프리마켓이 최신이면 보이지 않는다', () => {
  assert.equal(isAfterHoursBasisVisible(['2026-11-25T09:30:00', '2026-11-25T10:00:00'], '16:00'), false)
  assert.equal(isAfterHoursBasisVisible(['2026-11-25T16:00:00'], '16:00'), false)
  assert.equal(isAfterHoursBasisVisible(['2026-11-25T16:00:00', '2026-11-25T19:55:00', '2026-11-26T04:05:00'], '16:00'), false)
  assert.equal(isAfterHoursBasisVisible(['2026-11-25T16:00:00', '2026-11-25T16:05:00'], null), false)
  assert.equal(isAfterHoursBasisVisible(undefined, '16:00'), false)
})

test('별도는 그날 종가 대비 현재가로 등락률을 다시 계산하고 종가 줄에 없는 종목은 그대로 둔다', () => {
  const latest = [
    { stockCode: 'AAPL', currentPrice: 110, lastPrice: 100, changeRate: 10, totalMarketValue: 1 },
    { stockCode: 'NEW', currentPrice: 50, lastPrice: 49, changeRate: 2.04, totalMarketValue: 1 },
  ]
  const close = [{ stockCode: 'AAPL', currentPrice: 105, lastPrice: 100, changeRate: 5, totalMarketValue: 1 }]
  const [aapl, fresh] = applyAfterHoursBasis(latest, close)
  assert.equal(aapl.lastPrice, 105)
  assert.equal(aapl.changeRate, 4.76)
  assert.equal(aapl.currentPrice, 110)
  assert.deepEqual(fresh, latest[1])
})
