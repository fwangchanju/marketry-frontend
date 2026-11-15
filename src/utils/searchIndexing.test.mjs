import assert from 'node:assert/strict'
import test from 'node:test'
import { isNoIndexPath } from './searchIndexing.ts'

test('관리자와 프로필 화면은 검색에 노출하지 않는다', () => {
  for (const path of ['/admin', '/admin/member', '/admin/stats', '/admin/banner', '/account', '/account/profile']) assert.equal(isNoIndexPath(path), true, path)
})

test('나머지 화면은 지금처럼 둔다', () => {
  for (const path of ['/', '/summary/korea', '/map/korea', '/map/japan', '/sector/usa', '/info/guide', '/administrator', '/accounts']) assert.equal(isNoIndexPath(path), false, path)
})
