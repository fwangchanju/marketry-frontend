import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hasMineSheetRequest, mineSheetReturnPath, withoutSheetParam } from './mineSheetReturn.ts'

test('keeps the current address and adds the mine sheet to the login return path', () => {
  assert.equal(mineSheetReturnPath('/map/korea'), '/map/korea?sheet=MINE')
  assert.equal(mineSheetReturnPath('/home', '?map&market=KOSPI', '#top'), '/home?map=&market=KOSPI&sheet=MINE#top')
  assert.equal(mineSheetReturnPath('/custom/stock', '?sheet=KRX'), '/custom/stock?sheet=MINE')
})

test('recognizes only a mine sheet request regardless of case', () => {
  assert.equal(hasMineSheetRequest('?sheet=MINE'), true)
  assert.equal(hasMineSheetRequest('?sheet=mine'), true)
  assert.equal(hasMineSheetRequest('?sheet=MYMAP'), true)
  assert.equal(hasMineSheetRequest('?sheet=KRX'), false)
  assert.equal(hasMineSheetRequest(''), false)
})

test('removes only the sheet parameter', () => {
  assert.equal(withoutSheetParam('?sheet=MINE'), '')
  assert.equal(withoutSheetParam('?market=KOSPI&sheet=MINE'), '?market=KOSPI')
})
