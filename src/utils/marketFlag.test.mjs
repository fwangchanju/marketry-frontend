import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { KOREA_FLAG, flagOfOverseasMarket } from './marketFlag.ts'

test('한국 시장은 태극기 하나다', () => {
  assert.equal(KOREA_FLAG, 'KR')
})

test('일본은 일장기, 미국은 성조기다', () => {
  assert.equal(flagOfOverseasMarket('JAPAN'), 'JP')
  assert.equal(flagOfOverseasMarket('USA'), 'US')
})

// 시장 화면(지도·그래프·서머리·섹터·종목)의 좌상단 배지에는 국기가 붙는다. 새 시장 화면이 국기를 빠뜨리지 않게 소스를 훑는다.
// 어드민·정보·계정 화면(ADMIN·INFO·ACCOUNT)은 시장이 아니라 국기를 두지 않는다.
test('시장 화면의 좌상단 배지에는 모두 국기가 있다', () => {
  const pagesDir = new URL('../pages/', import.meta.url)
  const marketPages = new Set(['MAP', 'GRAPH', 'SUMMARY', 'STOCK', 'SECTOR'])
  let checked = 0
  for (const name of readdirSync(pagesDir).filter(file => file.endsWith('.tsx'))) {
    const source = readFileSync(new URL(name, pagesDir), 'utf8')
    for (const match of source.matchAll(/<ToolbarModeText\s+page=(?:"(\w+)"|\{[^}]*\})[^>]*?\/>/g)) {
      const page = match[1]
      // page={mode === 'stock' ? 'STOCK' : 'SECTOR'}처럼 식으로 준 곳은 시장 화면(커스텀)이다.
      const isMarketPage = page === undefined || marketPages.has(page)
      if (!isMarketPage) continue
      checked += 1
      assert.match(match[0], /\sflag=\{/, `${name}의 시장 화면 배지에 flag가 없다`)
    }
  }
  assert.ok(checked >= 9, `시장 화면 배지 ${checked}곳만 찾았다`)
})
