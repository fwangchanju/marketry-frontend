import assert from 'node:assert/strict'
import { test } from 'node:test'
import { indexChangeRate, indexRange, shiftDate } from './indexChange.ts'

const near = (actual, expected) => assert.ok(actual !== null && Math.abs(actual - expected) < 1e-9, `${actual} !== ${expected}`)
const closes = [
  { date: '2026-11-05', close: 100 },
  { date: '2026-11-06', close: 110 },
  { date: '2026-11-09', close: 99 },
]

test('하루 보기는 바로 앞 거래일 종가 대비 등락률을 구한다', () => {
  near(indexChangeRate(closes, '2026-11-06', '2026-11-06'), 10)
  near(indexChangeRate(closes, '2026-11-09', '2026-11-09'), -10)
})

test('기간 보기는 시작일 앞 거래일 종가에서 종료일 종가까지의 누적 등락률을 구한다', () => {
  near(indexChangeRate(closes, '2026-11-06', '2026-11-09'), -1)
})

test('주말과 휴장일은 건너뛰고 그 앞의 가장 가까운 종가를 기준으로 삼는다', () => {
  near(indexChangeRate(closes, '2026-11-07', '2026-11-09'), -10)
})

test('기준 종가나 종료일 종가가 없으면 null이다', () => {
  assert.equal(indexChangeRate(closes, '2026-11-05', '2026-11-05'), null)
  assert.equal(indexChangeRate(closes, '2026-11-09', '2026-11-10'), null)
  assert.equal(indexChangeRate([], '2026-11-09', '2026-11-09'), null)
})

test('기준 종가가 0이면 null이다', () => {
  assert.equal(indexChangeRate([{ date: '2026-11-05', close: 0 }, { date: '2026-11-06', close: 10 }], '2026-11-06', '2026-11-06'), null)
})

test('달력 날짜를 더하고 뺀다', () => {
  assert.equal(shiftDate('2026-11-06', -14), '2026-10-23')
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28')
})

test('기간을 골랐으면 시작일과 종료일 구간을 돌려준다', () => {
  assert.deepEqual(indexRange('2026-11-02T15:30', '2026-11-09T15:30', '2026-11-13T15:30'), { startDate: '2026-11-02', endDate: '2026-11-09' })
})

test('지난 날짜를 골랐으면 그날 하루 구간을 돌려준다', () => {
  assert.deepEqual(indexRange(null, '2026-11-09T15:30', '2026-11-13T15:30'), { startDate: '2026-11-09', endDate: '2026-11-09' })
})

test('오늘 화면과 시세가 없는 화면은 구간이 없다', () => {
  assert.equal(indexRange(null, '2026-11-13T10:05', '2026-11-13T10:05'), null)
  assert.equal(indexRange(null, null, null), null)
})
