import assert from 'node:assert/strict'
import { test } from 'node:test'
import { snapshotMarketValueSteps } from './snapshotMarketValue.ts'
import { JAPAN_MAP_DRAFT_KEY_MAP } from './japanMapSettings.ts'
import { USA_MAP_DRAFT_KEY_MAP } from './usaMapSettings.ts'
import { draftScopeOfKeyMap } from './settingsDraft.ts'

test('일본·미국 시가총액 눈금은 이름이 없고 금액만 오름차순이다', () => {
  for (const unit of ['엔', '달러']) {
    const steps = snapshotMarketValueSteps(unit)
    assert.equal(steps.length, 3)
    assert.ok(steps.every(step => step.label === ''))
    assert.equal(steps[0].thresholdValue, 0)
    assert.deepEqual(steps.map(step => step.thresholdValue), [...steps.map(step => step.thresholdValue)].sort((a, b) => a - b))
  }
})

test('엔은 500억·5,000억, 달러는 100억·1,000억이 경계다', () => {
  assert.deepEqual(snapshotMarketValueSteps('엔').map(step => step.thresholdValue), [0, 50_000_000_000, 500_000_000_000])
  assert.deepEqual(snapshotMarketValueSteps('달러').map(step => step.thresholdValue), [0, 10_000_000_000, 100_000_000_000])
})

test('원은 눈금을 만들지 않는다(국내 지도는 서버의 구간 정의를 쓴다)', () => {
  assert.deepEqual(snapshotMarketValueSteps('원'), [])
})

test('시가총액 범위 변경 점 이름은 시장별 범위(japan·usa)로 센다', () => {
  assert.equal(JAPAN_MAP_DRAFT_KEY_MAP['heatmap.tierRangeMinValue'], 'japan.map.tierRangeMinValue')
  assert.equal(USA_MAP_DRAFT_KEY_MAP['heatmap.tierRangeMaxValue'], 'usa.map.tierRangeMaxValue')
  assert.equal(draftScopeOfKeyMap(JAPAN_MAP_DRAFT_KEY_MAP), 'japan')
  assert.equal(draftScopeOfKeyMap(USA_MAP_DRAFT_KEY_MAP), 'usa')
})
