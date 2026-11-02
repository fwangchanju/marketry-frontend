import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveTelegramPreference } from './telegramImageSetting.ts'

test('캡처에는 저장된 발송값을 쓰며 false와 0도 유지한다', () => {
  const values = { enabled: false, ratio: 0 }
  assert.equal(resolveTelegramPreference(true, values, 'enabled', true), false)
  assert.equal(resolveTelegramPreference(true, values, 'ratio', 45), 0)
})

test('발송값이 없거나 일반 화면이면 기존 관리자 설정을 사용한다', () => {
  assert.equal(resolveTelegramPreference(true, undefined, 'ratio', 45), 45)
  assert.equal(resolveTelegramPreference(false, { ratio: 100 }, 'ratio', 45), 45)
})
