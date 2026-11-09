import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toPctSigned, toPctSignedGrouped } from './format.ts'

test('등락률 천 단위를 구분하면서 부호와 소수 자릿수를 유지한다', () => {
  assert.equal(toPctSignedGrouped(1234.5, 2), '+1,234.50%')
  assert.equal(toPctSignedGrouped(-1234.5, 1), '-1,234.5%')
  assert.equal(toPctSignedGrouped(1000, 0), '+1,000%')
  assert.equal(toPctSignedGrouped(1.005, 2), toPctSigned(1.005, 2))
})
