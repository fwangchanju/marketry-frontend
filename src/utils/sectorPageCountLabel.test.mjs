import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// 섹터 페이지에는 설정창 상단 "n/n업종" 개수 표시를 두지 않는다(2026-11-15 사용자 결정, 메인 영역에 이미 있고 설정창 상단 표시는 대표성이 없다).
// 나중에 섹터 페이지에 거래소·내 기준 모드를 만들어도 이 표시를 되살리지 않는다. 종목 페이지의 "n/n종목"은 그대로다.
const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '../pages')
const read = name => readFileSync(join(pagesDir, name), 'utf8')

test('일본·미국 섹터 페이지는 설정창에 개수 표시(stockCountLabel)를 넘기지 않는다', () => {
  for (const name of ['JapanSectorPage.tsx', 'UsaSectorPage.tsx']) {
    assert.ok(!read(name).includes('stockCountLabel'), `${name}에 설정창 개수 표시를 다시 넣지 않는다`)
  }
})

test('한국 섹터·종목 화면(CustomPage)은 종목 모드에서만 개수 표시를 넘긴다', () => {
  const source = read('CustomPage.tsx')
  assert.ok(source.includes("stockCountLabel={mode === 'stock' ? countLabel : undefined}"))
  assert.equal(source.split('stockCountLabel=').length - 1, 1)
})
