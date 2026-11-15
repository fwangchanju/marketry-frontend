import assert from 'node:assert/strict'
import test from 'node:test'
import { isNoIndexPath } from './searchIndexing.ts'

test('관리자·프로필·약관류 인포 화면은 검색에 노출하지 않는다', () => {
  for (const path of ['/admin', '/admin/member', '/admin/stats', '/admin/banner', '/account', '/account/profile', '/info/privacy', '/info/terms', '/info/source', '/info/contact', '/info/terms/']) assert.equal(isNoIndexPath(path), true, path)
})

test('나머지 화면은 지금처럼 둔다(가이드는 검색에 등록한 주소)', () => {
  for (const path of ['/', '/summary/korea', '/map/korea', '/map/japan', '/sector/usa', '/info/guide', '/info', '/administrator', '/accounts', '/info/privacyx']) assert.equal(isNoIndexPath(path), false, path)
})
