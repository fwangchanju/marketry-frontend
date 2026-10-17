import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  commitDrafts, discardDrafts, readDraft, registerDraftKey,
  unregisterDraftParticipant, updateDraftParticipant, writeDraft,
} from './settingsDraft.ts'

const colorKey = 'test.colorScale'
const settingKey = 'test.preference'
registerDraftKey(settingKey)
afterEach(() => {
  unregisterDraftParticipant(colorKey)
  discardDrafts()
})

test('색상만 변경해도 상단 저장으로 저장하고 일반 설정 API는 호출하지 않는다', async () => {
  let saved = 0
  updateDraftParticipant(colorKey, {
    hasChanges: true,
    save: async () => { saved += 1 },
    discard: () => assert.fail('저장 중 되돌리면 안 된다'),
  })
  await commitDrafts(async () => assert.fail('일반 설정 변경은 없다'))
  assert.equal(saved, 1)
})

test('색상과 일반 설정을 같은 저장 동작에 포함한다', async () => {
  const calls = []
  writeDraft(settingKey, 2)
  updateDraftParticipant(colorKey, {
    hasChanges: true,
    save: async () => { calls.push('color') },
    discard: () => {},
  })
  await commitDrafts(async entries => { calls.push(entries) })
  assert.deepEqual(calls, ['color', [[settingKey, 2]]])
  assert.equal(readDraft(settingKey).found, false)
})

test('색상 저장 실패는 상단으로 전달하고 변경을 유지해 재시도한다', async () => {
  const failure = new Error('색상 저장 실패')
  writeDraft(settingKey, 3)
  let attempts = 0
  updateDraftParticipant(colorKey, {
    hasChanges: true,
    save: async () => { if (++attempts === 1) throw failure },
    discard: () => {},
  })
  await assert.rejects(commitDrafts(async () => assert.fail('색상 저장 실패 뒤에는 진행하지 않는다')), failure)
  assert.deepEqual(readDraft(settingKey), { found: true, value: 3 })
  await commitDrafts(async entries => assert.deepEqual(entries, [[settingKey, 3]]))
  assert.equal(attempts, 2)
  assert.equal(readDraft(settingKey).found, false)
})

test('상단 되돌리기는 색상과 일반 설정을 함께 복원한다', () => {
  let color = '변경값'
  writeDraft(settingKey, 4)
  updateDraftParticipant(colorKey, {
    hasChanges: true,
    save: async () => assert.fail('되돌릴 때 저장하면 안 된다'),
    discard: () => { color = '저장값' },
  })
  discardDrafts()
  assert.equal(color, '저장값')
  assert.equal(readDraft(settingKey).found, false)
})

test('색상 저장 중 새로 바꾼 일반 설정은 저장 후에도 임시값으로 남긴다', async () => {
  writeDraft(settingKey, 5)
  updateDraftParticipant(colorKey, {
    hasChanges: true,
    save: async () => { writeDraft(settingKey, 6) },
    discard: () => {},
  })
  await commitDrafts(async entries => assert.deepEqual(entries, [[settingKey, 5]]))
  assert.deepEqual(readDraft(settingKey), { found: true, value: 6 })
})
