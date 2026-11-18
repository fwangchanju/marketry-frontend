import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUsaGicsTree } from './usaGicsTree.ts'

const gics = {
  AAPL: { sector: 'Information Technology', industryGroup: 'Technology Hardware & Equipment', industry: 'Technology Hardware, Storage & Peripherals', subIndustry: 'Technology Hardware, Storage & Peripherals' },
  MSFT: { sector: 'Information Technology', industryGroup: 'Software & Services', industry: 'Software', subIndustry: 'Application Software' },
  JPM: { sector: 'Financials', industryGroup: 'Banks', industry: 'Banks', subIndustry: 'Diversified Banks' },
  XYZ: { sector: null, industryGroup: null, industry: null, subIndustry: null },
}

test('1단계는 뿌리, 2단계는 그 아래 분류로 만든다(3·4단계는 없다)', () => {
  const { categories } = buildUsaGicsTree(gics)
  assert.deepEqual(categories.filter(c => c.parentId === null).map(c => c.name), ['Financials', 'Information Technology'])
  assert.equal(categories.some(c => c.name === 'Application Software'), false)
  assert.equal(categories.some(c => c.name === 'Software & Services'), true)
})

test('분류 id는 서로 겹치지 않는다', () => {
  const { categories } = buildUsaGicsTree(gics)
  const ids = categories.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('종목 분류는 섹터와 산업그룹을 담고, 값이 없는 종목은 빈 값이다', () => {
  const { classifications } = buildUsaGicsTree(gics)
  assert.deepEqual(classifications.MSFT, { sector: 'Information Technology', industry: 'Software & Services', subIndustry: null })
  assert.equal(classifications.XYZ.sector, null)
})
