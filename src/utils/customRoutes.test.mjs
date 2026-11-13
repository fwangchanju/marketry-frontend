import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SECTOR_JAPAN, SECTOR_KOREA, STOCK_JAPAN, STOCK_KOREA, isCustomPagePath, legacyCustomTarget } from './customRoutes.ts'

test('한국 옛 주소 세 개는 새 주소로 간다', () => {
  assert.equal(legacyCustomTarget('/custom'), SECTOR_KOREA)
  assert.equal(legacyCustomTarget('/custom/sector'), SECTOR_KOREA)
  assert.equal(legacyCustomTarget('/custom/stock'), STOCK_KOREA)
})

test('일본 옛 주소는 비공개 화면이라 이동시키지 않는다', () => {
  assert.equal(legacyCustomTarget('/custom/sector/japan'), null)
  assert.equal(legacyCustomTarget('/custom/stock/japan'), null)
})

test('끝 슬래시가 붙은 옛 주소도 새 주소로 간다', () => {
  assert.equal(legacyCustomTarget('/custom/stock/'), STOCK_KOREA)
  assert.equal(legacyCustomTarget('/custom/sector/'), SECTOR_KOREA)
})

test('옛 주소가 아니면 이동하지 않는다', () => {
  assert.equal(legacyCustomTarget('/sector/korea'), null)
  assert.equal(legacyCustomTarget('/custom/unknown'), null)
  assert.equal(legacyCustomTarget('/map/korea'), null)
})

test('새 주소와 옛 주소는 모두 섹터·스톡 화면으로 본다', () => {
  for (const path of [SECTOR_KOREA, SECTOR_JAPAN, STOCK_KOREA, STOCK_JAPAN, '/custom', '/custom/sector', '/custom/stock/japan']) assert.equal(isCustomPagePath(path), true, path)
  for (const path of ['/map/korea', '/graph/japan', '/home', '/sectorx', '/admin/member']) assert.equal(isCustomPagePath(path), false, path)
})
