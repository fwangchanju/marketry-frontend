import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sampleDaysUpTo } from './trendDates.ts'

test('한도 이하면 그대로 돌려준다', () => {
  assert.deepEqual(sampleDaysUpTo([1, 2, 3], 5), [1, 2, 3])
})

test('한도를 넘으면 첫날과 마지막 날을 포함해 균등하게 고른다', () => {
  const days = Array.from({ length: 250 }, (_, index) => index)
  const sampled = sampleDaysUpTo(days, 30)
  assert.equal(sampled.length, 30)
  assert.equal(sampled[0], 0)
  assert.equal(sampled.at(-1), 249)
  assert.deepEqual([...sampled].sort((a, b) => a - b), sampled)
})
