import assert from 'node:assert/strict'
import { test } from 'node:test'
import { halfOverlapCollisionDetection, sectorCollisionDetection } from './dndCollision.ts'

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height })
const target = { id: 'sector-drop-2', data: { current: { sectorId: 2 } } }
const args = (mode, pointerCoordinates, collisionRect, containers = [target]) => ({
  active: { id: 'sector-move-1', data: { current: { mode } } },
  pointerCoordinates,
  collisionRect,
  droppableContainers: containers,
  droppableRects: new Map(containers.map(item => [item.id, rect(100, 100, 300, 32)])),
})

test('배지 왼쪽을 잡고 오른쪽 여기 표시 위에 놓으면 배지가 절반 미만 겹쳐도 이동 대상이다', () => {
  const input = args('move', { x: 388, y: 116 }, rect(386, 106, 32, 20))
  assert.deepEqual(halfOverlapCollisionDetection(input), [])
  assert.equal(sectorCollisionDetection(input)[0]?.id, target.id)
})

test('커서가 줄 밖이면 배지가 대부분 겹쳐도 이동 대상으로 잡지 않는다', () => {
  assert.deepEqual(sectorCollisionDetection(args('move', { x: 401, y: 116 }, rect(380, 106, 32, 20))), [])
})

test('최상위 이동 헤더도 커서 위치로 판정한다', () => {
  const root = { id: 'sector-root', data: { current: { root: true } } }
  assert.equal(sectorCollisionDetection(args('move', { x: 390, y: 116 }, rect(388, 106, 32, 20), [root]))[0]?.id, root.id)
})

test('순서 정렬 손잡이는 기존 면적 기준을 유지한다', () => {
  const input = args(undefined, { x: 388, y: 116 }, rect(386, 106, 32, 20))
  assert.deepEqual(sectorCollisionDetection(input), halfOverlapCollisionDetection(input))
})
