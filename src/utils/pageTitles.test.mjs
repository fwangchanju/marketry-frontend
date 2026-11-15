import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { pageTitle } from './pageTitles.ts'

test('화면·시장 제목은 `{시장} {화면} - MARKETRY` 모양이다', () => {
  assert.equal(pageTitle('/map/korea'), '한국주식 히트맵 - MARKETRY')
  assert.equal(pageTitle('/map/korea/kospi'), '코스피 히트맵 - MARKETRY')
  assert.equal(pageTitle('/graph/korea/kosdaq'), '코스닥 등락률 그래프 - MARKETRY')
  assert.equal(pageTitle('/summary/korea/kospi'), '코스피 요약 - MARKETRY')
  assert.equal(pageTitle('/summary/japan'), '일본주식 요약 - MARKETRY')
  assert.equal(pageTitle('/sector/usa'), '미국주식 섹터 - MARKETRY')
  assert.equal(pageTitle('/stock/japan'), '일본주식 종목 - MARKETRY')
  assert.equal(pageTitle('/graph/usa'), '미국주식 등락률 그래프 - MARKETRY')
  assert.equal(pageTitle('/map/japan'), '일본주식 히트맵 - MARKETRY')
  assert.equal(pageTitle('/map/usa'), '미국주식 히트맵 - MARKETRY')
})

test('글·계정·관리자 화면은 고정 제목을 쓴다', () => {
  assert.equal(pageTitle('/info/guide'), '히트맵 설정 방법 - MARKETRY')
  assert.equal(pageTitle('/info/privacy'), '개인정보처리방침 - MARKETRY')
  assert.equal(pageTitle('/account/profile'), '프로필 - MARKETRY')
  assert.equal(pageTitle('/admin/default'), '설정 기본값 - MARKETRY')
  assert.equal(pageTitle('/admin/member'), '회원관리 - MARKETRY')
  assert.equal(pageTitle('/admin/banner/'), '배너 - MARKETRY')
})

test('대표 주소와 규칙에 없는 주소는 null이다', () => {
  assert.equal(pageTitle('/summary/korea'), null)
  assert.equal(pageTitle('/'), null)
  assert.equal(pageTitle('/nothing'), null)
  assert.equal(pageTitle('/map/japan/kospi'), null)
  assert.equal(pageTitle('/map/korea/other'), null)
})

test('검색에 등록된 제목(searchMetadata.json)은 규칙과 같다(대표 주소와 옛 주소 별칭은 예외)', () => {
  const pages = JSON.parse(readFileSync(new URL('./searchMetadata.json', import.meta.url), 'utf8'))
  for (const [path, page] of Object.entries(pages)) {
    const target = page.canonicalPath ?? path
    const expected = pageTitle(target)
    if (expected === null) { assert.equal(page.title, 'MARKETRY - Design Your Market', path); continue }
    assert.equal(page.title, expected, path)
  }
})
