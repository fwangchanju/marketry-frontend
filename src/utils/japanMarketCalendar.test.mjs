import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JAPAN_MARKET_HOLIDAYS_2026, isJapanMarketClosed } from './japanMarketCalendar.ts'

test('휴장일과 주말은 닫혀 있고 평일 거래일은 열려 있다', () => {
  assert.equal(isJapanMarketClosed('2026-11-03'), true)
  assert.equal(isJapanMarketClosed('2026-11-07'), true)
  assert.equal(isJapanMarketClosed('2026-11-04'), false)
})

test('휴장일 목록은 모두 평일이다', () => {
  for (const date of JAPAN_MARKET_HOLIDAYS_2026) {
    const weekday = new Date(`${date}T00:00:00`).getDay()
    assert.ok(weekday >= 1 && weekday <= 5, date)
  }
})
