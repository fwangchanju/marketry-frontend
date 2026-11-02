import assert from 'node:assert/strict'
import { test } from 'node:test'
import { layoutOverviewLabel } from './overviewLabel.ts'

test('PC 홈은 이름을 줄여 등락률을 함께 표시한다', () => {
  const result = layoutOverviewLabel('금융', '+1.0%', 150, 40, 0, { large: true })
  assert.deepEqual(result.lines, ['금융'])
  assert.equal(result.nameSize, 14)
  assert.equal(result.rateSize, 13)
})

test('둘 다 들어가지 않으면 이름만 유지하고 모바일 규칙은 바꾸지 않는다', () => {
  const small = layoutOverviewLabel('금융', '+1.0%', 150, 25, 0, { large: true })
  assert.deepEqual(small.lines, ['금융'])
  assert.equal(small.rateSize, null)
  const mobile = layoutOverviewLabel('금융', '+1.0%', 150, 40, 0)
  assert.equal(mobile.nameSize, 15)
  assert.equal(mobile.rateSize, null)
})
