import assert from 'node:assert/strict'
import { test } from 'node:test'
import { keepCloseRows, latestCloseTime, resolveSnapshotOnOrBefore, snapshotTimesAsDays } from './snapshotPick.ts'

const TIMES = [
  '2026-11-24T16:00:00',
  '2026-11-25T04:05:00',
  '2026-11-25T09:30:00',
  '2026-11-25T16:00:00',
  '2026-11-25T16:05:00',
  '2026-11-25T19:55:00',
  '2026-11-27T04:05:00',
  '2026-11-27T04:10:00',
]

test('미국은 종가 줄이 있는 날은 그 줄만 남기고 아직 종가가 없는 날은 그대로 둔다', () => {
  assert.deepEqual(keepCloseRows(TIMES, '16:00'), [
    '2026-11-24T16:00:00',
    '2026-11-25T16:00:00',
    '2026-11-27T04:05:00',
    '2026-11-27T04:10:00',
  ])
})

test('종가 시각이 없는 시장은 시각 목록을 그대로 둔다', () => {
  assert.deepEqual(keepCloseRows(TIMES, null), TIMES)
})

test('다른 시장에서 고른 날짜는 종가 줄이 있는 날이면 그날 종가 줄로 옮긴다', () => {
  const days = snapshotTimesAsDays(keepCloseRows(TIMES, '16:00'))
  assert.equal(resolveSnapshotOnOrBefore(days, '2026-11-25'), '2026-11-25T16:00:00')
})

test('가장 최근 종가 줄의 시각을 찾고 없으면 null이다', () => {
  assert.equal(latestCloseTime(TIMES, '16:00'), '2026-11-25T16:00:00')
  assert.equal(latestCloseTime(['2026-11-27T04:05:00'], '16:00'), null)
})
