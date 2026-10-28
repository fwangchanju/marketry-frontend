import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveMobileStockSelection } from './mobileStockSelection.ts'

test('업종 선택을 유지하면서 갱신된 시세와 종목 구성을 사용한다', () => {
  const selection = { market: 'ALL_STOCK', key: '반도체>OSAT' }
  const oldItems = [{ key: selection.key, stocks: [{ code: 'A', rate: 1 }] }]
  const newItems = [{ key: selection.key, stocks: [{ code: 'A', rate: 2 }, { code: 'B', rate: 3 }] }]
  assert.deepEqual(resolveMobileStockSelection(selection, 'ALL_STOCK', oldItems), [{ code: 'A', rate: 1 }])
  assert.deepEqual(resolveMobileStockSelection(selection, 'ALL_STOCK', newItems), [{ code: 'A', rate: 2 }, { code: 'B', rate: 3 }])
})

test('업종이 사라지면 빈 목록이며 다른 마켓의 선택은 적용하지 않는다', () => {
  const selection = { market: 'ALL_STOCK', key: '직접 종목' }
  assert.deepEqual(resolveMobileStockSelection(selection, 'ALL_STOCK', []), [])
  assert.equal(resolveMobileStockSelection(selection, 'KOSPI', []), null)
  assert.equal(resolveMobileStockSelection(null, 'ALL_STOCK', []), null)
})
