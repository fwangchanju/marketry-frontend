import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearBrowserSetting, isBrowserSavedSettingKey, readBrowserSetting, writeBrowserSetting } from './browserProfileSettings.ts'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key),
  }
}

test('거래소·MARKETRY 키만 브라우저 저장 대상이다', () => {
  assert.equal(isBrowserSavedSettingKey('heatmap.profile.exchange.stockLabelEnabled'), true)
  assert.equal(isBrowserSavedSettingKey('heatmap.profile.marketry.colorScale'), true)
  assert.equal(isBrowserSavedSettingKey('heatmap.profile.mine.colorScale'), false)
  assert.equal(isBrowserSavedSettingKey('heatmap.isCustom'), false)
})

test('쓴 값은 읽을 수 있고, 지우면 없음으로 돌아온다', () => {
  const storage = memoryStorage()
  const key = 'heatmap.profile.marketry.topPickCount'
  assert.deepEqual(readBrowserSetting(key, storage), { found: false, value: undefined })
  writeBrowserSetting(key, 3, storage)
  assert.deepEqual(readBrowserSetting(key, storage), { found: true, value: 3 })
  clearBrowserSetting(key, storage)
  assert.equal(readBrowserSetting(key, storage).found, false)
})

test('저장소가 없거나 막혀도 예외 없이 기본 동작을 한다', () => {
  assert.equal(readBrowserSetting('heatmap.profile.exchange.x', null).found, false)
  writeBrowserSetting('heatmap.profile.exchange.x', 1, null)
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => { throw new Error('blocked') } }
  assert.equal(readBrowserSetting('heatmap.profile.exchange.x', broken).found, false)
  writeBrowserSetting('heatmap.profile.exchange.x', 1, broken)
  clearBrowserSetting('heatmap.profile.exchange.x', broken)
})
