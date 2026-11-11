import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  JAPAN_MAP_DEFAULTS,
  JAPAN_MAP_FIXED,
  japanMapDisplayValues,
  japanMapManagedDefaults,
  japanMapPublishPayload,
  pickJapanMapPreferenceValues,
  readJapanMapOverrides,
  readJapanMapPreferences,
} from './japanMapSettings.ts'
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

test('관리자가 정한 일본 기본값은 코드 기본값 위에 얹고 형식이 맞지 않는 값은 쓰지 않는다', () => {
  const managed = japanMapManagedDefaults({ japan: { topPickEnabled: false, topPickCount: 1, topPickDepth: 'x', unknown: 9 } })
  assert.deepEqual([managed.topPickEnabled, managed.topPickCount, managed.topPickDepth], [false, 1, JAPAN_MAP_DEFAULTS.topPickDepth])
  assert.equal('unknown' in managed, false)
  assert.deepEqual(japanMapManagedDefaults(undefined), JAPAN_MAP_DEFAULTS)
  assert.deepEqual(japanMapManagedDefaults({ marketry: { topPickCount: 1 } }), JAPAN_MAP_DEFAULTS)
})

test('이 브라우저에서 바꾼 값만 읽어 기본값 위에 얹는다', () => {
  assert.deepEqual(readJapanMapOverrides(JSON.stringify({ topPickCount: 2 })), { topPickCount: 2 })
  assert.deepEqual(readJapanMapOverrides('깨진 값'), {})
  const base = { ...JAPAN_MAP_DEFAULTS, topPickCount: 1 }
  assert.equal(readJapanMapPreferences(null, base).topPickCount, 1)
  assert.equal(readJapanMapPreferences(JSON.stringify({ topPickCount: 2 }), base).topPickCount, 2)
  assert.deepEqual(pickJapanMapPreferenceValues({ maxDepth: null }), { maxDepth: null })
})

test('서버에 저장하는 값은 일본 설정의 모든 이름을 그대로 담는다', () => {
  const payload = japanMapPublishPayload({ ...JAPAN_MAP_DEFAULTS, topPickCount: 2 })
  assert.deepEqual(Object.keys(payload).sort(), Object.keys(JAPAN_MAP_DEFAULTS).sort())
  assert.equal(payload.topPickCount, 2)
})

test('기본값 화면에는 국내와 같은 이름으로 일본 설정을 옮겨 보여 준다', () => {
  const { preferences, excludedSectors } = japanMapDisplayValues({ ...JAPAN_MAP_DEFAULTS, topPickCount: 2, maxDepth: null })
  assert.equal(preferences['heatmap.topPickCount'], 2)
  assert.equal(preferences['heatmap.selectedMaxDepth'], null)
  assert.equal(preferences['heatmap.decimalPlacesIndex'], JAPAN_MAP_DEFAULTS.decimalPlaces)
  assert.equal(preferences['heatmap.strongIndustryColor'], JAPAN_MAP_FIXED.strongIndustryColor)
  assert.deepEqual(excludedSectors, [])
})
