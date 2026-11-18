import assert from 'node:assert/strict'
import { test } from 'node:test'
import { OVERSEAS_MIDDLE, overseasMiddleLabel, overseasMiddleStorageKey, readOverseasMiddle } from './overseasMiddle.ts'

const storage = value => ({ getItem: () => value })

test('시장별 가운데 칸 이름이 정해져 있다', () => {
  assert.equal(overseasMiddleLabel('JAPAN'), '모닝스타')
  assert.equal(overseasMiddleLabel('USA'), 'GICS')
})

test('시장별 저장 키는 서로 다르다', () => {
  assert.notEqual(overseasMiddleStorageKey('JAPAN'), overseasMiddleStorageKey('USA'))
  assert.equal(overseasMiddleStorageKey('USA'), 'heatmap.overseasMiddle.USA')
})

test('데이터가 준비되지 않은 시장은 저장값이 EXTERNAL이어도 MARKETRY로 본다', () => {
  assert.equal(OVERSEAS_MIDDLE.JAPAN.externalReady, false)
  assert.equal(readOverseasMiddle('JAPAN', storage('EXTERNAL')), 'MARKETRY')
})

test('미국 GICS는 준비된 시장이라 저장값 EXTERNAL을 그대로 쓴다', () => {
  assert.equal(OVERSEAS_MIDDLE.USA.externalReady, true)
  assert.equal(readOverseasMiddle('USA', storage('EXTERNAL')), 'EXTERNAL')
})

test('저장소를 못 읽으면 MARKETRY로 본다', () => {
  assert.equal(readOverseasMiddle('USA', null), 'MARKETRY')
  assert.equal(readOverseasMiddle('USA', { getItem: () => { throw new Error('denied') } }), 'MARKETRY')
})
