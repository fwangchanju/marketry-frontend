import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FLAT_RANGE_PERCENT, changeDirectionOf } from './changeDirection.ts'

test('±0.5% 이내(경계 포함)는 보합이다', () => {
  assert.equal(FLAT_RANGE_PERCENT, 0.5)
  for (const rate of [0, 0.01, -0.01, 0.5, -0.5, 0.3, -0.49]) assert.equal(changeDirectionOf(rate), 'flat', String(rate))
})

test('0.5%를 넘으면 상승, -0.5%보다 작으면 하락이다', () => {
  for (const rate of [0.51, 1, 29.9, 0.5000001]) assert.equal(changeDirectionOf(rate), 'up', String(rate))
  for (const rate of [-0.51, -1, -29.9, -0.5000001]) assert.equal(changeDirectionOf(rate), 'down', String(rate))
})
