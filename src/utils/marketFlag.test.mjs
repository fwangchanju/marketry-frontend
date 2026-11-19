import assert from 'node:assert/strict'
import { test } from 'node:test'
import { KOREA_FLAG, flagForPath, flagOfOverseasMarket } from './marketFlag.ts'

test('한국 시장은 태극기 하나다', () => {
  assert.equal(KOREA_FLAG, 'KR')
})

test('일본은 일장기, 미국은 성조기다', () => {
  assert.equal(flagOfOverseasMarket('JAPAN'), 'JP')
  assert.equal(flagOfOverseasMarket('USA'), 'US')
})

test('한국 시장 화면은 KOREA·KOSPI·KOSDAQ 모두 태극기다', () => {
  for (const path of ['/map/korea', '/map/korea/kospi', '/map/korea/kosdaq', '/graph/korea', '/graph/korea/kospi', '/summary/korea', '/summary/korea/kosdaq', '/sector/korea', '/stock/korea', '/map', '/graph']) {
    assert.equal(flagForPath(path), 'KR', path)
  }
})

test('일본·미국 시장 화면은 각자의 국기다', () => {
  for (const page of ['map', 'graph', 'summary', 'sector', 'stock']) {
    assert.equal(flagForPath(`/${page}/japan`), 'JP', page)
    assert.equal(flagForPath(`/${page}/usa`), 'US', page)
  }
})

test('시장 화면이 아니면 국기가 없다', () => {
  for (const path of ['/', '/home', '/admin/member', '/admin/message', '/info/terms', '/profile', '/login']) {
    assert.equal(flagForPath(path), null, path)
  }
})
