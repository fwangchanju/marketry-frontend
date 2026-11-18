import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUsaGicsTree } from './usaGicsTree.ts'

const gics = {
  AAPL: { sector: 'Information Technology', industry: 'Tech Hardware', subIndustry: null },
  MSFT: { sector: 'Information Technology', industry: 'Software', subIndustry: null },
  JPM: { sector: 'Financials', industry: 'Banks', subIndustry: null },
  XYZ: { sector: null, industry: null, subIndustry: null },
}

test('섹터는 뿌리 분류, 산업은 섹터 아래 분류로 만든다', () => {
  const { categories } = buildUsaGicsTree(gics)
  const roots = categories.filter(c => c.parentId === null).map(c => c.name)
  assert.deepEqual(roots, ['Financials', 'Information Technology'])
  const software = categories.find(c => c.name === 'Software')
  assert.equal(categories.find(c => c.id === software.parentId).name, 'Information Technology')
})

test('분류 id는 서로 겹치지 않는다', () => {
  const { categories } = buildUsaGicsTree(gics)
  const ids = categories.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('종목 분류는 섹터·산업을 그대로 옮기고, 값이 없는 종목도 빈 값으로 둔다', () => {
  const { classifications } = buildUsaGicsTree(gics)
  assert.deepEqual(classifications.AAPL, { sector: 'Information Technology', industry: 'Tech Hardware', subIndustry: null })
  assert.equal(classifications.XYZ.sector, null)
})
