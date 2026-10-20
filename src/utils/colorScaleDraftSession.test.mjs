import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createColorScaleDraftSession } from './colorScaleDraftSession.ts'

const initial = { thresholds: [{ id: 1, thresholdPercent: 2, color: '#ff0000', colorLabel: null }] }

test('다른 페이지가 같은 계정의 서버 값을 다시 시드해도 편집값·복원 기준·선택을 유지한다', () => {
  const store = createColorScaleDraftSession()
  store.initialize('user:1', initial)
  store.getSnapshot().snapshotRef.current = store.getSnapshot().draft
  store.getSnapshot().selectedPercentRef.current = 3
  store.setEditIndices([0])
  store.setDraft({ thresholds: [{ ...initial.thresholds[0], thresholdPercent: 3 }] })
  store.initialize('user:1', initial)
  const nextPage = store.getSnapshot()
  assert.equal(nextPage.draft.thresholds[0].thresholdPercent, 3)
  assert.equal(nextPage.snapshotRef.current.thresholds[0].thresholdPercent, 2)
  assert.deepEqual(nextPage.editIndices, [0])
  assert.equal(nextPage.selectedPercentRef.current, 3)
  // 다음 페이지의 되돌리기도 원래 편집 시작값을 복원한다.
  store.setDraft(nextPage.snapshotRef.current)
  store.setEditIndices([])
  assert.deepEqual(store.getSnapshot().draft, initial)
})

test('다음 페이지에서 저장한 새 id와 색상은 재진입 후에도 남는다', () => {
  const store = createColorScaleDraftSession()
  store.initialize('user:1', initial)
  const saved = { thresholds: [{ id: 20, thresholdPercent: 3, color: '#00ff00', colorLabel: null }] }
  store.setDraft(saved)
  store.getSnapshot().snapshotRef.current = saved
  store.initialize('user:1', initial)
  assert.deepEqual(store.getSnapshot().draft, saved)
  assert.deepEqual(store.getSnapshot().snapshotRef.current, saved)
})

test('로그아웃과 계정 전환은 이전 계정의 임시 색상·편집 행을 가져오지 않는다', () => {
  const store = createColorScaleDraftSession()
  for (const owner of ['user:1', 'user:2', 'guest']) {
    store.initialize(owner, initial)
    assert.deepEqual(store.getSnapshot().draft, initial)
    assert.equal(store.getSnapshot().snapshotRef.current, null)
    assert.deepEqual(store.getSnapshot().editIndices, [])
    store.setDraft({ thresholds: [] })
    store.setEditIndices([2])
    store.getSnapshot().snapshotRef.current = initial
  }
})

test('공통 임시값 변경은 구독자에게 전달하고 서버 캐시 원본을 복사한다', () => {
  const store = createColorScaleDraftSession()
  let calls = 0
  const unsubscribe = store.subscribe(() => { calls++ })
  store.initialize('guest', initial)
  assert.notEqual(store.getSnapshot().draft.thresholds[0], initial.thresholds[0])
  const previous = store.getSnapshot()
  store.setDraft(value => ({ thresholds: value.thresholds.map(row => ({ ...row, thresholdPercent: 4 })) }))
  assert.notEqual(store.getSnapshot(), previous)
  assert.equal(initial.thresholds[0].thresholdPercent, 2)
  store.setEditIndices(indices => [...indices, 0])
  assert.equal(calls, 3)
  unsubscribe()
  store.setEditIndices([])
  assert.equal(calls, 3)
})
