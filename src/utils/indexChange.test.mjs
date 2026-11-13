import assert from 'node:assert/strict'
import { test } from 'node:test'
import { graphIndexValue, indexChangeRate, indexRange, intradayRateAt, shiftDate } from './indexChange.ts'

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

const intraday = [
  { snapshotTime: '2026-11-13T09:05:00', changeRate: 0.4 },
  { snapshotTime: '2026-11-13T09:20:00', changeRate: 0.9 },
]

test('같은 분의 장중 지수 등락률을 찾고 없으면 null이다', () => {
  assert.equal(intradayRateAt(intraday, '2026-11-13T09:20'), 0.9)
  assert.equal(intradayRateAt(intraday, '2026-11-13T09:20:00'), 0.9)
  assert.equal(intradayRateAt(intraday, '2026-11-13T09:10'), null)
  assert.equal(intradayRateAt([], '2026-11-13T09:05'), null)
  assert.equal(intradayRateAt(undefined, '2026-11-13T09:05'), null)
  assert.equal(intradayRateAt(intraday, null), null)
})

test('지금 보기는 장중 값이 있으면 그것을 쓰고 없으면 종가 기준 값을 쓴다', () => {
  assert.equal(graphIndexValue({ showDelta: false, nowRate: 0.9, beforeRate: null, dailyRate: -1.2 }), 0.9)
  assert.equal(graphIndexValue({ showDelta: false, nowRate: null, beforeRate: null, dailyRate: -1.2 }), -1.2)
  assert.equal(graphIndexValue({ showDelta: false, nowRate: null, beforeRate: null, dailyRate: null }), null)
})

test('장중 값이 0%여도 값이 있는 것으로 보고 종가 기준 값으로 바꾸지 않는다', () => {
  assert.equal(graphIndexValue({ showDelta: false, nowRate: 0, beforeRate: null, dailyRate: -1.2 }), 0)
})

test('N분 전 대비는 지금과 N분 전이 모두 있을 때만 그 차이를 쓴다', () => {
  near(graphIndexValue({ showDelta: true, nowRate: 0.9, beforeRate: 0.4, dailyRate: -1.2 }), 0.5)
  assert.equal(graphIndexValue({ showDelta: true, nowRate: 0.9, beforeRate: null, dailyRate: -1.2 }), null)
  assert.equal(graphIndexValue({ showDelta: true, nowRate: null, beforeRate: 0.4, dailyRate: -1.2 }), null)
})
