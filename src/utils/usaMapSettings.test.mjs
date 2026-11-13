import assert from 'node:assert/strict'
import { test } from 'node:test'
import { currencySuffix } from './currencyUnit.ts'
import { draftScopeOfKeyMap } from './settingsDraft.ts'
import { JAPAN_MAP_DRAFT_KEY_MAP } from './japanMapSettings.ts'
import { USA_MAP_DEFAULTS, USA_MAP_DRAFT_KEY_MAP, USA_MAP_SETTING_PREFIX, usaMapSettingKey } from './usaMapSettings.ts'

test('미국 지도 설정 저장 이름은 usa.map.으로 시작한다', () => {
  assert.equal(USA_MAP_SETTING_PREFIX, 'usa.map.')
  assert.equal(usaMapSettingKey('maxDepth'), 'usa.map.maxDepth')
})

test('설정 항목마다 변경 점 이름 표에 미국 저장 이름이 하나씩 있다', () => {
  const targets = Object.values(USA_MAP_DRAFT_KEY_MAP)
  for (const name of Object.keys(USA_MAP_DEFAULTS)) {
    assert.ok(targets.includes(usaMapSettingKey(name)), `${name}의 변경 점 이름이 없다`)
  }
  assert.equal(new Set(targets).size, targets.length)
})

test('미국 설정의 임시값은 일본과 따로 센다', () => {
  assert.equal(draftScopeOfKeyMap(USA_MAP_DRAFT_KEY_MAP), 'usa')
  assert.equal(draftScopeOfKeyMap(JAPAN_MAP_DRAFT_KEY_MAP), 'japan')
})

test('변경 점 이름 표가 비어 있으면 일본 범위로 본다', () => {
  assert.equal(draftScopeOfKeyMap({}), 'japan')
})

test('시가총액 뒤에는 엔과 달러만 단위를 붙이고 원은 붙이지 않는다', () => {
  assert.equal(currencySuffix('원'), '')
  assert.equal(currencySuffix('엔'), ' 엔')
  assert.equal(currencySuffix('달러'), ' 달러')
})
