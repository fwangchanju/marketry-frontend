import assert from 'node:assert/strict'
import { test } from 'node:test'
import { excludedNamesForPaths } from './excludedSectorPaths.ts'

const node = (sectorId, sectorName, children = []) => ({ sectorId, sectorName, children })

test('거래소 기본 업종 제외는 전체 경로가 같은 항목만 선택한다', () => {
  const tree = [
    node(1, '금융', [node(2, '은행')]),
    node(3, '산업재', [node(4, '은행')]),
  ]

  assert.deepEqual([...excludedNamesForPaths(tree, ['금융 > 은행'])], [[2, '금융 > 은행']])
})
