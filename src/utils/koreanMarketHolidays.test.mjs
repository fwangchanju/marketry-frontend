import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KOREAN_MARKET_ADDITIONAL_HOLIDAYS } from './koreanMarketHolidays.ts'
import { KOREAN_PUBLIC_HOLIDAY_DATES } from './koreanPublicHolidayDates.ts'

test('확인한 선거일과 임시공휴일을 한국 증시 휴장일로 표시한다', () => {
  for (const date of ['2020-04-15', '2020-08-17', '2022-03-09', '2022-06-01', '2023-10-02', '2024-04-10', '2024-10-01', '2025-01-27', '2025-06-03', '2026-06-03']) {
    assert.ok(KOREAN_PUBLIC_HOLIDAY_DATES.has(date) || KOREAN_MARKET_ADDITIONAL_HOLIDAYS.has(date), date)
  }
})

test('근로자의 날과 연말 증시 휴장일을 일반 공휴일과 별도로 표시한다', () => {
  for (const date of ['2020-05-01', '2023-05-01', '2024-05-01', '2025-05-01', '2026-05-01', '2020-12-31', '2021-12-31', '2022-12-30', '2023-12-29', '2024-12-31', '2025-12-31']) {
    assert.ok(KOREAN_MARKET_ADDITIONAL_HOLIDAYS.has(date), date)
    assert.equal(KOREAN_PUBLIC_HOLIDAY_DATES.has(date), false, date)
  }
  assert.equal(KOREAN_MARKET_ADDITIONAL_HOLIDAYS.has('2020-01-02'), false)
})
