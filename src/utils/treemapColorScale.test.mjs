import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDefaultColorScale, orderThresholdSaves, resolveTreemapColor } from './treemapColorScale.ts'

const row = (id, thresholdPercent) => ({ id, thresholdPercent, color: '#bc2f2f', colorLabel: 'red' })

test('여러 경계를 양방향으로 옮겨도 서버 중복 제약을 지키며 저장한다', () => {
  const saved = [-15, -8, -5, -2, 2, 5, 8, 15].map((value, index) => row(index + 1, value))
  const changes = new Map([[-8, -10], [-5, -8], [5, 8], [8, 10]])
  const desired = saved.filter(item => changes.has(item.thresholdPercent))
    .map(item => ({ ...item, thresholdPercent: changes.get(item.thresholdPercent) }))
  const server = new Map(saved.map(item => [item.id, item]))
  for (const item of orderThresholdSaves(desired, saved, [])) {
    assert.equal([...server.values()].some(current => current.id !== item.id && current.thresholdPercent === item.thresholdPercent), false)
    server.set(item.id, item)
  }
  assert.deepEqual([...server.values()].map(item => item.thresholdPercent), [-15, -10, -8, -2, 2, 8, 10, 15])
  assert.deepEqual(saved.map(item => item.thresholdPercent), [-15, -8, -5, -2, 2, 5, 8, 15])
})

test('일부 저장 후 재시도해도 기존 구간과 충돌하지 않는다', () => {
  const saved = [row(1, 5), row(2, 8)]
  const desired = [row(1, 8), row(2, 10)]
  const server = new Map([[1, row(1, 5)], [2, row(2, 10)]])
  for (const item of orderThresholdSaves(desired, saved, [])) {
    assert.equal([...server.values()].some(current => current.id !== item.id && current.thresholdPercent === item.thresholdPercent), false)
    server.set(item.id, item)
  }
  assert.deepEqual([...server.values()].map(item => item.thresholdPercent), [8, 10])
})

test('초기화로 삭제할 행은 새 구간 저장을 막지 않는다', () => {
  const next = [row(undefined, 5), row(undefined, 8)]
  assert.deepEqual(orderThresholdSaves(next, [row(1, 5), row(2, 8)], [1, 2]), next)
})

test('해결할 수 없는 구간 교환은 요청을 시작하기 전에 거부한다', () => {
  assert.throws(() => orderThresholdSaves([row(1, 8), row(2, 5)], [row(1, 5), row(2, 8)], []))
})

test('8퍼센트 경계가 없어도 달력의 휴장 색을 계산한다', () => {
  const scale = createDefaultColorScale()
  assert.equal(resolveTreemapColor(8, scale), '#bc2f2f')
  scale.thresholds = scale.thresholds.map(item => Math.abs(item.thresholdPercent) === 8
    ? { ...item, thresholdPercent: Math.sign(item.thresholdPercent) * 10 }
    : item)
  assert.match(resolveTreemapColor(8, scale), /^#[0-9a-f]{6}$/)
})
