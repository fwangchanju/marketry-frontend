import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampTransform, panTransform, pinchTransform, MAX_SCALE } from './mapZoom.ts'

const W = 400
const H = 600

test('확대 배율은 1~6배로 제한하고 지도가 영역 밖으로 나가 빈 곳이 보이지 않게 한다', () => {
  assert.deepEqual(clampTransform({ scale: 0.5, x: 50, y: 50 }, W, H), { scale: 1, x: 0, y: 0 })
  assert.equal(clampTransform({ scale: 99, x: 0, y: 0 }, W, H).scale, MAX_SCALE)
  const t = clampTransform({ scale: 2, x: -9999, y: 9999 }, W, H)
  assert.equal(t.x, W - W * 2)
  assert.equal(t.y, 0)
})

test('두 손가락을 벌리면 가운데 아래 지도 위치가 그대로 가운데에 머문다', () => {
  const start = { scale: 1, x: 0, y: 0 }
  const mid = { x: 200, y: 300 }
  const t = pinchTransform(start, 100, mid, 200, mid, W, H)
  assert.equal(t.scale, 2)
  // 기준 위치 (200,300)의 화면 위치 = 200*2 + x = 200 이 되어야 한다.
  assert.equal(200 * t.scale + t.x, 200)
  assert.equal(300 * t.scale + t.y, 300)
})

test('두 손가락 가운데가 움직이면 지도가 함께 이동하고, 오므려도 1배 아래로는 안 간다', () => {
  const start = { scale: 2, x: -100, y: -100 }
  const t = pinchTransform(start, 100, { x: 200, y: 200 }, 100, { x: 250, y: 220 }, W, H)
  assert.equal(t.scale, 2)
  assert.equal(t.x, -50)
  assert.equal(t.y, -80)
  assert.deepEqual(pinchTransform(start, 100, { x: 200, y: 200 }, 1, { x: 200, y: 200 }, W, H), { scale: 1, x: 0, y: 0 })
})

test('한 손가락 이동은 확대한 범위 안에서만 움직인다', () => {
  const start = { scale: 2, x: -100, y: -100 }
  assert.deepEqual(panTransform(start, 30, -20, W, H), { scale: 2, x: -70, y: -120 })
  assert.deepEqual(panTransform(start, 500, 500, W, H), { scale: 2, x: 0, y: 0 })
})
