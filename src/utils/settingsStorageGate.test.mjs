import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  canReadSettingsStorage,
  canWriteSettingsStorage,
  getSettingsStorageGateVersion,
  readSettingStorage,
  setSettingsStorageGate,
  subscribeSettingsStorageGate,
  writeSettingStorage,
} from './settingsStorageGate.ts'

// 같은 파일 안의 테스트는 모듈 상태를 이어 쓰므로 아래 순서대로 돈다(로그인 여부 미확인 → 비로그인 → 로그인).
const store = new Map()
globalThis.localStorage = {
  getItem: key => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => { store.set(key, value) },
  removeItem: key => { store.delete(key) },
}

test('로그인 여부를 모르는 동안에는 읽기만 되고 쓰기는 안 된다', () => {
  store.set('a', '"saved"')
  assert.equal(canReadSettingsStorage(), true)
  assert.equal(canWriteSettingsStorage(), false)
  assert.equal(readSettingStorage('a'), '"saved"')
  writeSettingStorage('b', '1')
  assert.equal(store.has('b'), false)
})

test('비로그인이면 저장값을 읽지도 쓰지도 않는다', () => {
  let notified = 0
  const unsubscribe = subscribeSettingsStorageGate(() => { notified += 1 })
  const before = getSettingsStorageGateVersion()
  setSettingsStorageGate(false)
  assert.equal(canReadSettingsStorage(), false)
  assert.equal(canWriteSettingsStorage(), false)
  assert.equal(readSettingStorage('a'), null)
  writeSettingStorage('c', '2')
  assert.equal(store.has('c'), false)
  assert.equal(notified, 1)
  assert.equal(getSettingsStorageGateVersion(), before + 1)
  setSettingsStorageGate(false)
  assert.equal(notified, 1)
  unsubscribe()
})

test('로그인하면 저장값을 읽고 쓴다', () => {
  setSettingsStorageGate(true)
  assert.equal(canReadSettingsStorage(), true)
  assert.equal(canWriteSettingsStorage(), true)
  assert.equal(readSettingStorage('a'), '"saved"')
  writeSettingStorage('d', '3')
  assert.equal(store.get('d'), '3')
})

test('로그아웃하면 다시 읽지도 쓰지도 않는다', () => {
  setSettingsStorageGate(false)
  assert.equal(readSettingStorage('d'), null)
  writeSettingStorage('e', '4')
  assert.equal(store.has('e'), false)
})
