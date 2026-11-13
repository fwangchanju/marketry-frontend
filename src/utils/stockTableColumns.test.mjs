import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  STOCK_COLUMN_HIDE_ORDER,
  computeStockColumnWidths,
  hiddenStockColumnsFor,
  pinnedStockColumns,
  stockColumnWidthsForJapan,
  stockColumnWidthsTotal,
} from './stockTableColumns.ts'

const hiddenList = width => [...hiddenStockColumnsFor(width)]

test('창 너비 1440(영역 1126px)에서는 열을 하나도 숨기지 않는다', () => {
  assert.deepEqual(hiddenList(1126), [])
  const widths = computeStockColumnWidths(1126)
  assert.equal(Object.keys(widths).length, 11)
  assert.equal(widths.alias, 110)
  assert.equal(widths.industry, 119)
})

test('칸 폭의 합이 영역 너비와 같다(숨김 단계마다)', () => {
  for (const width of [1126, 1050, 980, 900, 800, 650, 560, 500]) {
    assert.equal(stockColumnWidthsTotal(computeStockColumnWidths(width)), width, `영역 ${width}px`)
  }
})

test('좁아질수록 정해진 순서의 앞쪽부터 하나씩 더 숨긴다', () => {
  let previous = 0
  for (let width = 1200; width >= 450; width -= 10) {
    const hidden = hiddenList(width)
    assert.deepEqual(hidden, STOCK_COLUMN_HIDE_ORDER.slice(0, hidden.length), `영역 ${width}px는 순서의 앞부분만 숨긴다`)
    assert.ok(hidden.length >= previous, `영역 ${width}px에서 숨긴 열이 줄지 않는다`)
    previous = hidden.length
  }
})

test('숨김 순서는 종목코드, NXT, 약칭, 거래소 분류, 마켓, 규모, 시가총액이다', () => {
  assert.deepEqual([...STOCK_COLUMN_HIDE_ORDER], ['stockCode', 'nxt', 'alias', 'industry', 'market', 'sizeTier', 'totalMarketValue'])
  // 사용자 화면 절반 크기(영역 650px)에서는 규모까지 남고 중분류·소분류가 보인다.
  const widths = computeStockColumnWidths(650)
  assert.deepEqual(Object.keys(widths).sort(), ['midSector', 'parentSector', 'sizeTier', 'stockName', 'subSector', 'totalMarketValue'])
})

test('종목명과 대·중·소분류는 아무리 좁아도 숨기지 않는다', () => {
  const widths = computeStockColumnWidths(300)
  for (const key of ['stockName', 'parentSector', 'midSector', 'subSector']) assert.ok(widths[key] !== undefined, key)
  assert.equal(widths.totalMarketValue, undefined)
})

test('필터가 걸린 열은 숨기지 않고 그다음 열을 숨긴다', () => {
  const pinned = pinnedStockColumns({ market: new Set(['코스닥']), nxt: new Set(), industry: undefined })
  assert.deepEqual([...pinned], ['market'])
  const widths = computeStockColumnWidths(650, pinned)
  assert.ok(widths.market !== undefined)
  assert.equal(widths.sizeTier, undefined)
  // 필터가 없으면 같은 너비에서 마켓이 숨는다.
  assert.equal(computeStockColumnWidths(650).market, undefined)
})

test('필터가 걸린 열이 많아 다 숨겨도 안 맞으면 숨길 수 있는 열만 숨긴다', () => {
  const all = pinnedStockColumns({ nxt: new Set(['O']), market: new Set(['코스닥']), industry: new Set(['금융']), sizeTier: new Set(['Top 2']) })
  const widths = computeStockColumnWidths(500, all)
  for (const key of ['nxt', 'market', 'industry', 'sizeTier']) assert.ok(widths[key] !== undefined, key)
})

test('일본 표: 규모·마켓·NXT 묶음과 시가총액(₩)·야후 섹터의 시작과 끝이 같다', () => {
  for (const width of [1126, 1000, 900, 800, 650, 560]) {
    const korean = computeStockColumnWidths(width)
    const japan = stockColumnWidthsForJapan(korean)
    const group = (korean.sizeTier ?? 0) + (korean.market ?? 0) + (korean.nxt ?? 0)
    assert.equal((japan.totalMarketValueKrw ?? 0) + (japan.industry ?? 0), group, `영역 ${width}px`)
    assert.equal(stockColumnWidthsTotal(japan), stockColumnWidthsTotal(korean), `영역 ${width}px 합계`)
  }
})

test('일본 표: 묶음이 줄면 시가총액(₩)이 먼저 숨고 야후 섹터가 140, 70으로 줄다가 사라진다', () => {
  const full = stockColumnWidthsForJapan(computeStockColumnWidths(1126))
  assert.equal(full.totalMarketValueKrw, 100)
  assert.equal(full.industry, 110)
  const fixture = { ...computeStockColumnWidths(1126) }
  delete fixture.nxt
  const noNxt = stockColumnWidthsForJapan(fixture)
  assert.equal(noNxt.totalMarketValueKrw, undefined)
  assert.equal(noNxt.industry, 140)
  delete fixture.market
  assert.equal(stockColumnWidthsForJapan(fixture).industry, 70)
  delete fixture.sizeTier
  assert.equal(stockColumnWidthsForJapan(fixture).industry, undefined)
})

test('일본 표: 약칭이 숨으면 종목명 (영어)가 숨고 종목명 (한글)이 국내 종목명 칸을 가진다', () => {
  const korean = computeStockColumnWidths(900)
  assert.equal(korean.alias, undefined)
  const japan = stockColumnWidthsForJapan(korean)
  assert.equal(japan.stockName, undefined)
  assert.equal(japan.alias, korean.stockName)
  // 약칭이 보이는 넓은 창에서는 둘 다 보인다.
  const wide = stockColumnWidthsForJapan(computeStockColumnWidths(1126))
  assert.ok(wide.stockName !== undefined && wide.alias !== undefined)
})

test('일본 표: 종목코드·시가총액(¥)은 국내와 함께 숨는다', () => {
  assert.equal(stockColumnWidthsForJapan(computeStockColumnWidths(1050)).stockCode, undefined)
  assert.equal(stockColumnWidthsForJapan(computeStockColumnWidths(540)).totalMarketValue, undefined)
  assert.ok(stockColumnWidthsForJapan(computeStockColumnWidths(1126)).totalMarketValue !== undefined)
})
