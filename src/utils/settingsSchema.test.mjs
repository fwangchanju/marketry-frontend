import assert from 'node:assert/strict'
import { test } from 'node:test'
import { migratePreferences, profileDefaultForSettingKey, profileFromSettingKey, profileSettingKey } from './settingsSchema.ts'

test('새 기본값 조회 키는 MARKETRY·거래소 설정만 프로필 기본값으로 연결한다', () => {
  assert.deepEqual(profileFromSettingKey(profileSettingKey('marketry', 'heatmap.boxSizeMarketCapRatio')), {
    profile: 'marketry', key: 'boxSizeMarketCapRatio',
  })
  assert.deepEqual(profileFromSettingKey(profileSettingKey('exchange', 'heatmap.tierRangeMaxValue')), {
    profile: 'exchange', key: 'tierRangeMaxValue',
  })
  assert.equal(profileFromSettingKey(profileSettingKey('mine', 'heatmap.boxSizeMarketCapRatio')), null)
  assert.equal(profileFromSettingKey('heatmap.colorScale'), null)
})

test('비어 있거나 false인 명시적 기본값도 저장된 값으로 구분한다', () => {
  const defaults = { marketry: { excludedSectorKeys: [], colorCustomOn: false, tierRangeMaxValue: null } }
  assert.deepEqual(profileDefaultForSettingKey(defaults, profileSettingKey('marketry', 'heatmap.excludedSectorKeys'), ['seed']), { found: true, value: [] })
  assert.deepEqual(profileDefaultForSettingKey(defaults, profileSettingKey('marketry', 'heatmap.colorCustomOn'), true), { found: true, value: false })
  assert.deepEqual(profileDefaultForSettingKey(defaults, profileSettingKey('marketry', 'heatmap.tierRangeMaxValue'), 500), { found: true, value: null })
  assert.deepEqual(profileDefaultForSettingKey(defaults, profileSettingKey('exchange', 'heatmap.boxSizeMarketCapRatio'), 45), { found: false, value: 45 })
})

test('기존 분류 설정을 세 프로필의 최초 값으로 복사하고 이미 생성된 프로필 값은 보존한다', () => {
  const result = migratePreferences({
    'settings.version': 1,
    'heatmap.selectedMaxDepth': 2,
    [profileSettingKey('marketry', 'heatmap.selectedMaxDepth')]: 1,
    'heatmap.boxSizeMarketCapRatio': 45,
  })

  assert.equal(result.changed, true)
  assert.equal(result.preferences['settings.version'], 4)
  assert.equal(result.preferences[profileSettingKey('exchange', 'heatmap.selectedMaxDepth')], 2)
  assert.equal(result.preferences[profileSettingKey('marketry', 'heatmap.selectedMaxDepth')], 1)
  assert.equal(result.preferences[profileSettingKey('mine', 'heatmap.selectedMaxDepth')], 2)
  assert.equal(result.preferences['heatmap.boxSizeMarketCapRatio'], 45)
})

test('새 스키마는 다시 이관하지 않는다', () => {
  const raw = { 'settings.version': 4, [profileSettingKey('exchange', 'heatmap.selectedMaxDepth')]: 1 }
  const result = migratePreferences(raw)
  assert.equal(result.changed, false)
  assert.equal(result.preferences, raw)
})

test('기존 공통 지도 표시값도 세 프로필로 복사해 전환 시 섞이지 않게 한다', () => {
  const result = migratePreferences({
    'settings.version': 2,
    'heatmap.boxSizeMarketCapRatio': 45,
    'heatmap.decimalPlacesIndex': 2,
  })

  assert.equal(result.preferences['settings.version'], 4)
  for (const profile of ['exchange', 'marketry', 'mine']) {
    assert.equal(result.preferences[profileSettingKey(profile, 'heatmap.boxSizeMarketCapRatio')], 45)
    assert.equal(result.preferences[profileSettingKey(profile, 'heatmap.decimalPlacesIndex')], 2)
  }
})

test('공통 시가총액 범위를 각 프로필에 복사하고 기존 프로필 값은 유지한다', () => {
  const mine = profileSettingKey('mine', 'heatmap.tierRangeMinValue')
  const { preferences } = migratePreferences({ 'settings.version': 3, 'heatmap.tierRangeMinValue': 500, 'heatmap.tierRangeMaxValue': null, [mine]: 1000 })
  assert.equal(preferences[mine], 1000)
  for (const profile of ['exchange', 'marketry']) {
    assert.equal(preferences[profileSettingKey(profile, 'heatmap.tierRangeMinValue')], 500)
    assert.equal(preferences[profileSettingKey(profile, 'heatmap.tierRangeMaxValue')], null)
  }
})
