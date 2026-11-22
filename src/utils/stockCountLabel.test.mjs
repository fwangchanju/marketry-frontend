import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatStockCountLabel } from './stockCountLabel.ts'

test('종목 수 라벨은 두 값 모두 쉼표를 붙인다', () => {
  assert.equal(formatStockCountLabel(123, 456), '123/456종목')
  assert.equal(formatStockCountLabel(1234, 5678), '1,234/5,678종목')
  assert.equal(formatStockCountLabel(0, 0), '0/0종목')
})
