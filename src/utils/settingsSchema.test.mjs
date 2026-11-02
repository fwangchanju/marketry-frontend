import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migratePreferences, profileSettingKey } from './settingsSchema.ts'

test('기존 분류 설정을 세 프로필의 최초 값으로 복사하고 이미 생성된 프로필 값은 보존한다', () => {
  const result = migratePreferences({
    'settings.version': 1,
    'heatmap.selectedMaxDepth': 2,
    [profileSettingKey('marketry', 'heatmap.selectedMaxDepth')]: 1,
    'heatmap.boxSizeMarketCapRatio': 45,
  })

  assert.equal(result.changed, true)
  assert.equal(result.preferences['settings.version'], 2)
  assert.equal(result.preferences[profileSettingKey('exchange', 'heatmap.selectedMaxDepth')], 2)
  assert.equal(result.preferences[profileSettingKey('marketry', 'heatmap.selectedMaxDepth')], 1)
  assert.equal(result.preferences[profileSettingKey('mine', 'heatmap.selectedMaxDepth')], 2)
  assert.equal(result.preferences['heatmap.boxSizeMarketCapRatio'], 45)
})

test('새 스키마는 다시 이관하지 않는다', () => {
  const raw = { 'settings.version': 2, [profileSettingKey('exchange', 'heatmap.selectedMaxDepth')]: 1 }
  const result = migratePreferences(raw)
  assert.equal(result.changed, false)
  assert.equal(result.preferences, raw)
})
