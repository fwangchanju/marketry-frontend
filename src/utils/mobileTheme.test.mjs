import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseMobileTheme } from './mobileTheme.ts'

test('저장된 값이 light일 때만 주간모드이고 나머지는 야간모드다', () => {
  assert.equal(parseMobileTheme('light'), 'light')
  assert.equal(parseMobileTheme('dark'), 'dark')
  assert.equal(parseMobileTheme(null), 'dark')
  assert.equal(parseMobileTheme(undefined), 'dark')
  assert.equal(parseMobileTheme('LIGHT'), 'dark')
  assert.equal(parseMobileTheme('system'), 'dark')
})
