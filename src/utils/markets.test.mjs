import assert from 'node:assert/strict'
import test from 'node:test'
import { OVERSEAS_MARKETS, OVERSEAS_SEGMENT_PATTERN, overseasMarketBySegment, overseasMarketInfo, overseasRoute } from './markets.ts'
import { SECTOR_JAPAN, SECTOR_USA, STOCK_JAPAN, STOCK_USA } from './customRoutes.ts'

test('해외 시장 목록: 주소 조각·배지 글자·목록 이름', () => {
  assert.deepEqual(OVERSEAS_MARKETS.map(market => [market.id, market.routeSegment, market.badgeLabel, market.menuLabel]), [
    ['JAPAN', 'japan', 'NIKKEI 225', 'JAPAN'],
    ['USA', 'usa', 'S&P 500', 'USA'],
  ])
  assert.equal(OVERSEAS_SEGMENT_PATTERN, 'japan|usa')
  assert.equal(overseasMarketInfo('USA').badgeLabel, 'S&P 500')
})

test('주소 조각으로 시장을 찾는다', () => {
  assert.equal(overseasMarketBySegment('japan')?.id, 'JAPAN')
  assert.equal(overseasMarketBySegment('usa')?.id, 'USA')
  assert.equal(overseasMarketBySegment('korea'), null)
  assert.equal(overseasMarketBySegment(null), null)
})

test('해외 시장 주소는 화면 이름 뒤에 시장 조각이 붙는다', () => {
  assert.equal(overseasRoute('/map', 'JAPAN'), '/map/japan')
  assert.equal(overseasRoute('/graph', 'USA'), '/graph/usa')
  assert.equal(overseasRoute('/summary', 'JAPAN'), '/summary/japan')
  assert.equal(overseasRoute('/sector', 'USA'), '/sector/usa')
  assert.equal(overseasRoute('/stock', 'JAPAN'), '/stock/japan')
})

test('섹터·주식 주소 상수는 예전 값과 같다', () => {
  assert.deepEqual([SECTOR_JAPAN, STOCK_JAPAN, SECTOR_USA, STOCK_USA], ['/sector/japan', '/stock/japan', '/sector/usa', '/stock/usa'])
})
