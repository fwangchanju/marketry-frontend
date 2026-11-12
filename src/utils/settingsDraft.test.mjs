import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import {
  clearDraft, commitDrafts, discardDrafts, hasDraftForKeys, readDraft, registerDraftKey,
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

test('원래 저장값으로 돌아온 draft를 제거한다', () => {
  writeDraft(settingKey, 7)
  clearDraft(settingKey)
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

test('분류별 저장은 현재 분류와 공통 변경만 처리하고 다른 분류 draft를 보존한다', async () => {
  const exchangeKey = 'heatmap.profile.exchange.selectedMaxDepth'
  const marketryKey = 'heatmap.profile.marketry.selectedMaxDepth'
  const commonKey = 'heatmap.boxSizeMarketCapRatio'
  registerDraftKey(exchangeKey)
  registerDraftKey(marketryKey)
  registerDraftKey(commonKey)
  writeDraft(exchangeKey, 1)
  writeDraft(marketryKey, 2)
  writeDraft(commonKey, 80)

  let saved
  await commitDrafts(async entries => { saved = entries }, 'marketry')

  assert.deepEqual(new Map(saved), new Map([[marketryKey, 2], [commonKey, 80]]))
  assert.equal(readDraft(exchangeKey).value, 1)
  assert.equal(readDraft(marketryKey).found, false)
  assert.equal(readDraft(commonKey).found, false)

  discardDrafts('exchange')
  assert.equal(readDraft(exchangeKey).found, false)
})

test('모드별 설정 draft는 전환·저장·초기화 때 다른 모드에 섞이지 않는다', async () => {
  const mineKey = 'heatmap.profile.mine.boxSizeMarketCapRatio'
  const exchangeKey = 'heatmap.profile.exchange.boxSizeMarketCapRatio'
  registerDraftKey(mineKey)
  registerDraftKey(exchangeKey)
  writeDraft(mineKey, 65)

  assert.equal(readDraft(exchangeKey).found, false)
  await commitDrafts(async entries => assert.deepEqual(entries, [[mineKey, 65]]), 'mine')
  assert.equal(readDraft(mineKey).found, false)

  writeDraft(exchangeKey, 25)
  discardDrafts('exchange')
  assert.equal(readDraft(exchangeKey).found, false)
  assert.equal(readDraft(mineKey).found, false)
})

test('항목의 저장 이름 중 하나라도 임시값이 있으면 변경 점을 켠다', () => {
  const otherKey = 'test.other'
  assert.equal(hasDraftForKeys([settingKey, otherKey]), false)
  writeDraft(settingKey, 3)
  assert.equal(hasDraftForKeys([settingKey, otherKey]), true)
  assert.equal(hasDraftForKeys([otherKey]), false)
  clearDraft(settingKey)
  assert.equal(hasDraftForKeys([settingKey]), false)
})

test('별도 API로 저장되는 항목도 참여자에 변경이 있으면 변경 점을 켠다', () => {
  assert.equal(hasDraftForKeys([colorKey]), false)
  updateDraftParticipant(colorKey, { hasChanges: true, save: async () => {}, discard: () => {} })
  assert.equal(hasDraftForKeys([colorKey]), true)
  updateDraftParticipant(colorKey, { hasChanges: false, save: async () => {}, discard: () => {} })
  assert.equal(hasDraftForKeys([colorKey]), false)
})

test('내 기준 전용 참여자는 다른 분류의 변경 점·저장·되돌리기에 섞이지 않는다', async () => {
  let saved = 0
  let discarded = 0
  updateDraftParticipant(colorKey, {
    hasChanges: true,
    scope: 'mine',
    save: async () => { saved += 1 },
    discard: () => { discarded += 1 },
  })
  assert.equal(hasDraftForKeys([colorKey], 'mine'), true)
  assert.equal(hasDraftForKeys([colorKey], 'exchange'), false)
  assert.equal(hasDraftForKeys([colorKey], 'marketry'), false)

  await commitDrafts(async () => assert.fail('일반 설정 변경은 없다'), 'exchange')
  discardDrafts('marketry')
  assert.equal(saved, 0)
  assert.equal(discarded, 0)

  await commitDrafts(async () => assert.fail('일반 설정 변경은 없다'), 'mine')
  assert.equal(saved, 1)
})


test('일본 화면의 임시값은 국내 분류 범위에 섞이지 않고 일본 범위에서만 센다', async () => {
  const japanKey = 'japan.map.decimalPlaces'
  registerDraftKey(japanKey)
  writeDraft(japanKey, 2)
  assert.equal(hasDraftForKeys([japanKey]), true)
  discardDrafts('marketry')
  assert.equal(readDraft(japanKey).found, true)
  const saved = []
  await commitDrafts(async entries => { saved.push(...entries) }, 'marketry')
  assert.deepEqual(saved, [])
  assert.equal(readDraft(japanKey).found, true)
  await commitDrafts(async entries => { saved.push(...entries) }, 'japan')
  assert.deepEqual(saved, [[japanKey, 2]])
})
