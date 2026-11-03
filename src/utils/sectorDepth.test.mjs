import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectAtDepth } from './sectorDepth.ts'

const stock = { stockCode: 'A', marketValueTier: 'LARGE', totalMarketValue: 100 }

const tree = [
  {
    sectorId: 1,
    sectorName: '대분류',
    items: [],
    children: [
      {
        sectorId: 2,
        sectorName: '소분류 있음',
        items: [],
        children: [{ sectorId: 3, sectorName: '실제 소분류', items: [stock], children: [] }],
      },
      { sectorId: 4, sectorName: '소분류 없음', items: [stock], children: [] },
    ],
  },
]

test('소분류를 엄격히 고르면 소분류 없는 중분류는 제외한다', () => {
  const entries = collectAtDepth(tree, 3, new Set(), new Set(), false)
  assert.deepEqual(entries.map(entry => entry.pathKey), ['대분류>소분류 있음>실제 소분류'])
})

test('shallower leaf 포함 옵션이 켜진 호출은 기존 fallback을 유지한다', () => {
  const entries = collectAtDepth(tree, 3, new Set(), new Set(), true)
  assert.deepEqual(entries.map(entry => entry.pathKey), [
    '대분류>소분류 있음>실제 소분류',
    '대분류>소분류 없음',
  ])
})
