import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateSectorLayoutWeights, MOBILE_BALANCED_BOX_SIZE_RATIO, normalizeMobileBoxSizeRatio } from './sectorLayoutWeights.ts'

test('동일은 업종마다 같은 가중치를 준다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], 0), [1, 1])
})

test('균형은 업종 총시총의 제곱근을 가중치로 쓴다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], 50), [30, 10])
})

test('균형 비율은 60이고 이전에 저장한 균형값은 새 균형값으로 읽는다', () => {
  assert.equal(MOBILE_BALANCED_BOX_SIZE_RATIO, 60)
  for (const oldRatio of [50, 65, 70, 75]) assert.equal(normalizeMobileBoxSizeRatio(oldRatio), 60)
  assert.equal(normalizeMobileBoxSizeRatio(60), 60)
  assert.equal(normalizeMobileBoxSizeRatio(0), 0)
  assert.equal(normalizeMobileBoxSizeRatio(100), 100)
  const weights = calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], MOBILE_BALANCED_BOX_SIZE_RATIO)
  assert.deepEqual(weights, [Math.pow(900, 0.6), Math.pow(100, 0.6)])
})

test('시총 비례는 업종 총시총을 가중치로 쓴다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 900 }, { marketValue: 100 }], 100), [900, 100])
})

test('전체 시총이 0이면 모든 업종에 같은 면적을 준다', () => {
  assert.deepEqual(calculateSectorLayoutWeights([{ marketValue: 0 }, { marketValue: 0 }], 100), [1, 1])
})
