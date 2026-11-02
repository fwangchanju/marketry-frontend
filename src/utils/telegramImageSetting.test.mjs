import assert from 'node:assert/strict'
import { test } from 'node:test'
import { legacyTelegramImageValues, resolveTelegramPreference } from './telegramImageSetting.ts'

test('캡처에는 저장된 발송값을 쓰며 false와 0도 유지한다', () => {
  const values = { enabled: false, ratio: 0 }
  assert.equal(resolveTelegramPreference(true, values, 'enabled', true), false)
  assert.equal(resolveTelegramPreference(true, values, 'ratio', 45), 0)
})

test('발송값이 없거나 일반 화면이면 기존 관리자 설정을 사용한다', () => {
  assert.equal(resolveTelegramPreference(true, undefined, 'ratio', 45), 45)
  assert.equal(resolveTelegramPreference(false, { ratio: 100 }, 'ratio', 45), 45)
})

test('저장 전에는 렌더러 소유자 설정과 기존 범위의 실제 값을 표시한다', () => {
  const legacy = {
    preferences: { 'heatmap.boxSizeMarketCapRatio': 70, 'heatmap.tierRangeMinIndex': 1, 'heatmap.tierRangeMaxIndex': 1 },
    tiers: [
      { id: 1, label: '소형주', thresholdValue: 0, isExcludedByDefault: true },
      { id: 2, label: '중형주', thresholdValue: 500_000_000_000, isExcludedByDefault: false },
      { id: 3, label: '대형주', thresholdValue: 5_000_000_000_000, isExcludedByDefault: false },
    ],
    excludedSectors: [[11, '금융 > 지주']],
  }
  const result = legacyTelegramImageValues(legacy)
  assert.equal(result.preferences['heatmap.boxSizeMarketCapRatio'], 70)
  assert.equal(result.preferences['heatmap.tierRangeMinValue'], 500_000_000_000)
  assert.equal(result.preferences['heatmap.tierRangeMaxValue'], 5_000_000_000_000)
  assert.deepEqual(result.excludedSectors, [[11, '금융 > 지주']])
})
