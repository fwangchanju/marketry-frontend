import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pickTopSectorKeys, topPickAverage } from './topPickSectors.ts'

const node = (sectorId, sectorName, weighted, simple, totalMarketValue = 100) => ({
  sectorId, sectorName, weightedAvgChangeRate: weighted, simpleAvgChangeRate: simple, totalMarketValue, children: [], items: [],
})
const key = (id, name) => JSON.stringify([id, name])

test('등락률이 높은 순으로 지정한 개수만 고른다', () => {
  const keys = pickTopSectorKeys([node(1, '가', 1.5, 0), node(2, '나', 3.2, 0), node(3, '다', -1, 0), node(4, '라', 2.1, 0)], 2, 'weightedAvgChangeRate')
  assert.deepEqual([...keys], [key(2, '나'), key(4, '라')])
})

test('동일 가중을 고르면 동일 가중 등락률로, 그 밖의 지표는 시총 가중으로 순위를 매긴다', () => {
  const nodes = [node(1, '가', 5, 1), node(2, '나', 1, 5)]
  assert.deepEqual([...pickTopSectorKeys(nodes, 1, 'simpleAvgChangeRate')], [key(2, '나')])
  assert.deepEqual([...pickTopSectorKeys(nodes, 1, 'weightedAvgChangeRate')], [key(1, '가')])
  assert.deepEqual([...pickTopSectorKeys(nodes, 1, 'upDownCount')], [key(1, '가')])
  assert.equal(topPickAverage(nodes[0], 'marketValue'), 5)
})

test('등락률이 같으면 시가총액이 큰 업종, 그래도 같으면 원래 순서가 앞선 업종을 먼저 고른다', () => {
  const keys = pickTopSectorKeys([node(1, '가', 2, 0, 10), node(2, '나', 2, 0, 50), node(3, '다', 2, 0, 50)], 2, 'weightedAvgChangeRate')
  assert.deepEqual([...keys], [key(2, '나'), key(3, '다')])
})

test('등락률이 없는 업종은 건너뛰고, 후보가 개수보다 적으면 있는 만큼만 고른다', () => {
  const keys = pickTopSectorKeys([node(1, '가', null, null), node(2, '나', 0.5, 0)], 3, 'weightedAvgChangeRate')
  assert.deepEqual([...keys], [key(2, '나')])
  assert.equal(pickTopSectorKeys([], 3, 'weightedAvgChangeRate').size, 0)
})
