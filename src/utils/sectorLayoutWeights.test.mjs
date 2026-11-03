import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateSectorLayoutWeights } from './sectorLayoutWeights.ts'

test('동일은 표시 중인 업종에 전체 면적을 균등 배분한다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], 0), [0.5, 0.5])
})

test('균형은 균등 면적과 시총 비례 면적의 전체 지도 기준 중간값이다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], 50), [0.7, 0.3])
})

test('시총 비례는 표시 중인 전체 업종 시총에서 차지하는 비율을 쓴다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], 100), [0.9, 0.1])
})

test('전체 시총이 0이면 모든 업종에 같은 면적을 준다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 0 }, { marketValue: 0 }], 100), [0.5, 0.5])
})
