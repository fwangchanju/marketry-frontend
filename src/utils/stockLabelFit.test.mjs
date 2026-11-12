import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fitStockLabel } from './stockLabelFit.ts'

const BOX = { rateText: '+1.0%', width: 100, height: 100, baseFont: 20, wantName: true, wantRate: true }

test('일본 종목명은 그룹·지역 이름 뒤와 업종 단어 앞에서 두 줄로 나눈다', () => {
  const lines = name => fitStockLabel({ ...BOX, name, market: 'japan' }).nameLines
  assert.deepEqual(lines('미쓰비시상사'), ['미쓰비시', '상사'])
  assert.deepEqual(lines('도쿄일렉트론'), ['도쿄', '일렉트론'])
  assert.deepEqual(lines('재팬토바코'), ['재팬', '토바코'])
  assert.deepEqual(lines('스미토모화학'), ['스미토모', '화학'])
  assert.deepEqual(lines('동일본여객철도'), ['동일본', '여객철도'])
  assert.deepEqual(lines('다이이찌산쿄'), ['다이이찌', '산쿄'])
})

test('시장을 주지 않으면 국내 규칙 그대로 나눈다(국내 종목의 줄 나눔은 바뀌지 않는다)', () => {
  const lines = name => fitStockLabel({ ...BOX, name }).nameLines
  assert.deepEqual(lines('미쓰비시상사'), ['미쓰비', '시상사'])
  assert.deepEqual(lines('넥슨게임즈'), ['넥슨', '게임즈'])
  assert.deepEqual(fitStockLabel({ ...BOX, name: '넥슨게임즈', market: 'korea' }).nameLines, ['넥슨', '게임즈'])
})

test('한 줄에 들어가는 이름은 일본 규칙에서도 나누지 않는다', () => {
  assert.deepEqual(fitStockLabel({ ...BOX, name: '일본제철', market: 'japan' }).nameLines, ['일본제철'])
})
