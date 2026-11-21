import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mobileGraphRank } from './mobileGraphRank.ts'

test('많은 업종은 상하위 7개와 생략 개수를 표시하고 기준 지수를 유지한다', () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ key: `s${i}`, value: 20 - i }))
  entries.push({ key: 'index', value: 10, reference: true })
  const result = mobileGraphRank(entries)
  assert.equal(result.find(item => item.hiddenCount)?.hiddenCount, 6)
  assert.equal(result.filter(item => item.key.startsWith('s')).length, 14)
  assert.equal(result.filter(item => item.reference).length, 1)
  assert.deepEqual(result.filter(item => item.key.startsWith('s')).map(item => item.key), [...Array.from({ length: 7 }, (_, i) => `s${i}`), ...Array.from({ length: 7 }, (_, i) => `s${i + 13}`)])
})

test('14개 이하는 모두 등락률 순으로 표시한다', () => {
  assert.deepEqual(mobileGraphRank([{ key: 'a', value: -1 }, { key: 'b', value: 2 }]).map(item => item.key), ['b', 'a'])
})

test('기준 지수는 등락률 순서에 참여해 강한 업종과 약한 업종을 가른다', () => {
  const entries = [{ key: 'weak', value: -4 }, { key: 'index', value: -2, reference: true }, { key: 'strong', value: 5 }]
  assert.deepEqual(mobileGraphRank(entries).map(item => item.key), ['strong', 'index', 'weak'])

  // 지수 값이 바뀌면 그에 맞춰 업종과의 순서도 바뀐다(비교 기준으로 동작).
  assert.deepEqual(mobileGraphRank(entries.map(item => item.reference ? { ...item, value: 6 } : item)).map(item => item.key), ['index', 'strong', 'weak'])
})
