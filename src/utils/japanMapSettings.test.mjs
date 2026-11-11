import assert from 'node:assert/strict'
import { test } from 'node:test'
import { JAPAN_MAP_DEFAULTS, JAPAN_MAP_FIXED, readJapanMapPreferences } from './japanMapSettings.ts'
import { settingDefaultsFor } from './settingDefaults.ts'

test('일본 지도의 강조 색상은 국내 MARKETRY 모드와 같다', () => {
  assert.equal(JAPAN_MAP_FIXED.strongIndustryColor, settingDefaultsFor(true, 'marketry').strongIndustryColor)
  assert.equal(JAPAN_MAP_FIXED.strongIndustryColor, '#12b8a6')
})

test('상위 업종 강조 기본값은 국내 MARKETRY와 같은 중분류 3개이고 저장된 값이 있으면 그 값을 쓴다', () => {
  assert.deepEqual(
    [JAPAN_MAP_DEFAULTS.topPickEnabled, JAPAN_MAP_DEFAULTS.topPickDepth, JAPAN_MAP_DEFAULTS.topPickCount],
    [true, 1, 3],
  )
  const stored = readJapanMapPreferences(JSON.stringify({ topPickEnabled: false, topPickDepth: 0, topPickCount: 2 }))
  assert.deepEqual([stored.topPickEnabled, stored.topPickDepth, stored.topPickCount], [false, 0, 2])
  // 형식이 맞지 않는 저장값은 기본값으로 둔다.
  assert.equal(readJapanMapPreferences(JSON.stringify({ topPickCount: 'many' })).topPickCount, 3)
})
