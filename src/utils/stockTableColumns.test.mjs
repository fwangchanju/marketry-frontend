import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  STOCK_COLUMN_HIDE_ORDER,
  computeStockColumnWidths,
  hiddenStockColumnsFor,
  pinnedStockColumns,
  stockColumnWidthsWithoutTiers,
  stockColumnWidthsTotal,
} from './stockTableColumns.ts'

const hiddenList = width => [...hiddenStockColumnsFor(width)]

test('창 너비 1440(영역 1126px)에서는 열을 하나도 숨기지 않는다', () => {
  assert.deepEqual(hiddenList(1126), [])
  const widths = computeStockColumnWidths(1126)
  assert.equal(Object.keys(widths).length, 10)
  // 2026-11-15 확정 폭: 체크박스 30 · 종목코드 74 · 종목명 130 · 약칭 120 · 시가총액 120 · 규모·마켓 66씩 · 거래소 분류와 대·중·소분류 130씩.
  assert.deepEqual(widths, { stockCode: 74, stockName: 130, alias: 120, totalMarketValue: 120, sizeTier: 66, market: 66, industry: 130, parentSector: 130, midSector: 130, subSector: 130 })
})

test('칸 폭의 합이 영역 너비와 같다(숨김 단계마다)', () => {
  // 열을 숨기기 직전의 허용 구간(최대 16px)에서는 합이 영역보다 조금 클 수 있어, 그 구간을 비킨 너비로 확인한다.
  for (const width of [1126, 1030, 1000, 900, 780, 650, 540, 500]) {
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

test('숨김 순서는 종목코드, 약칭, 규모+마켓(한 번에), 거래소 분류, 시가총액이다', () => {
  assert.deepEqual([...STOCK_COLUMN_HIDE_ORDER], ['stockCode', 'alias', 'sizeTier', 'market', 'industry', 'totalMarketValue'])
  // 사용자 화면 절반 크기(영역 650px)에서는 시가총액까지 남고, 규모·마켓·거래소 분류는 숨는다.
  const widths = computeStockColumnWidths(650)
  assert.deepEqual(Object.keys(widths).sort(), ['midSector', 'parentSector', 'stockName', 'subSector', 'totalMarketValue'])
})

test('종목명과 대·중·소분류는 아무리 좁아도 숨기지 않는다', () => {
  const widths = computeStockColumnWidths(300)
  for (const key of ['stockName', 'parentSector', 'midSector', 'subSector']) assert.ok(widths[key] !== undefined, key)
  assert.equal(widths.totalMarketValue, undefined)
})

test('필터가 걸린 열이 든 단계는 숨기지 않고 그다음 단계를 숨긴다', () => {
  const pinned = pinnedStockColumns({ market: new Set(['코스닥']), industry: undefined })
  assert.deepEqual([...pinned], ['market'])
  const widths = computeStockColumnWidths(650, pinned)
  // 마켓 필터가 걸리면 규모와 마켓을 함께 남긴다(둘은 한 단계다).
  assert.ok(widths.market !== undefined && widths.sizeTier !== undefined)
  // 필터가 없으면 같은 너비에서 둘 다 숨는다.
  const plain = computeStockColumnWidths(650)
  assert.ok(plain.market === undefined && plain.sizeTier === undefined)
})

test('필터가 걸린 열이 많아 다 숨겨도 안 맞으면 숨길 수 있는 열만 숨긴다', () => {
  const all = pinnedStockColumns({ market: new Set(['코스닥']), industry: new Set(['금융']), sizeTier: new Set(['Top 2']) })
  const widths = computeStockColumnWidths(500, all)
  for (const key of ['market', 'industry', 'sizeTier']) assert.ok(widths[key] !== undefined, key)
})

test('일본·미국 표: 규모·마켓 묶음은 시가총액(₩), 거래소 분류는 섹터 칸과 같은 자리다', () => {
  for (const width of [1126, 1000, 900, 800, 650, 560]) {
    const korean = computeStockColumnWidths(width)
    const japan = stockColumnWidthsWithoutTiers(korean)
    const group = (korean.sizeTier ?? 0) + (korean.market ?? 0)
    assert.equal(japan.totalMarketValueKrw ?? 0, group, `영역 ${width}px`)
    assert.equal(japan.industry, korean.industry, `영역 ${width}px 섹터`)
    assert.equal(stockColumnWidthsTotal(japan), stockColumnWidthsTotal(korean), `영역 ${width}px 합계`)
  }
})

test('일본·미국 표: 시가총액(₩)은 132이고, 규모·마켓이 함께 숨으면 같이 숨는다(중간에 줄어들지 않는다)', () => {
  const full = stockColumnWidthsWithoutTiers(computeStockColumnWidths(1126))
  assert.equal(full.totalMarketValueKrw, 132)
  assert.equal(full.industry, 130)
  // 열이 숨는 모든 너비에서 시가총액(₩)은 132이거나 없다.
  for (let width = 1126; width >= 450; width -= 1) {
    const krw = stockColumnWidthsWithoutTiers(computeStockColumnWidths(width)).totalMarketValueKrw
    assert.ok(krw === 132 || krw === undefined, `영역 ${width}px: ${krw}`)
  }
})

test('일본 표: 약칭이 숨으면 종목명 (영어)가 숨고 종목명 (한글)이 국내 종목명 칸을 가진다', () => {
  const korean = computeStockColumnWidths(900)
  assert.equal(korean.alias, undefined)
  const japan = stockColumnWidthsWithoutTiers(korean)
  assert.equal(japan.stockName, undefined)
  assert.equal(japan.alias, korean.stockName)
  // 약칭이 보이는 넓은 창에서는 둘 다 보인다.
  const wide = stockColumnWidthsWithoutTiers(computeStockColumnWidths(1126))
  assert.ok(wide.stockName !== undefined && wide.alias !== undefined)
})

test('일본 표: 종목코드·시가총액(¥)은 국내와 함께 숨는다', () => {
  assert.equal(stockColumnWidthsWithoutTiers(computeStockColumnWidths(1040)).stockCode, undefined)
  assert.equal(stockColumnWidthsWithoutTiers(computeStockColumnWidths(540)).totalMarketValue, undefined)
  assert.ok(stockColumnWidthsWithoutTiers(computeStockColumnWidths(1126)).totalMarketValue !== undefined)
})
