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

test('일본 종목명 중 규칙으로 못 나누는 이름은 확정한 자리에서 나눈다', () => {
  const lines = name => fitStockLabel({ ...BOX, name, market: 'japan' }).nameLines
  assert.deepEqual(lines('소프트뱅크그룹'), ['소프트뱅크', '그룹'])
  assert.deepEqual(lines('오리엔탈랜드'), ['오리엔탈', '랜드'])
  assert.deepEqual(lines('세븐일레븐'), ['세븐', '일레븐'])
  assert.deepEqual(lines('이데미츠코산'), ['이데미츠', '코산'])
  assert.deepEqual(lines('베이커런트'), ['베이', '커런트'])
  assert.deepEqual(lines('히타치건설기계'), ['히타치', '건설기계'])
  assert.deepEqual(lines('트렌드마이크로'), ['트렌드', '마이크로'])
  assert.deepEqual(lines('크레디트세존'), ['크레디트', '세존'])
  assert.deepEqual(lines('사이버에이전트'), ['사이버', '에이전트'])
  assert.deepEqual(lines('다카시마야'), ['다카시마', '야'])
  // 4글자라 넓은 박스에서는 한 줄이고, 좁아서 나눌 때만 확정한 자리에서 나눈다.
  assert.deepEqual(fitStockLabel({ ...BOX, width: 70, name: '레이저텍', market: 'japan' }).nameLines, ['레이저', '텍'])
})

test('다이닛폰은 그룹명으로 보고 그 뒤에서 나눈다', () => {
  const lines = name => fitStockLabel({ ...BOX, name, market: 'japan' }).nameLines
  assert.deepEqual(lines('다이닛폰스크린'), ['다이닛폰', '스크린'])
  assert.deepEqual(lines('다이닛폰인쇄'), ['다이닛폰', '인쇄'])
})

test('앞 그룹명에 걸려 가운데가 끊기는 짧은 이름은 나누지 않는다', () => {
  for (const name of ['후지쯔', '이비덴', '마루이']) {
    assert.deepEqual(fitStockLabel({ ...BOX, name, market: 'japan' }).nameLines, [name])
  }
  // 줄 나눔 자리를 일부러 막아 둔 이름이라, 아무리 좁아도 두 줄로 나누지 않는다.
  for (const name of ['후지쯔', '이비덴', '마루이']) {
    const lines = fitStockLabel({ ...BOX, width: 34, name, market: 'japan' }).nameLines
    assert.ok(lines === null || lines.length === 1, name)
  }
})

test('시장을 주지 않은 국내 종목은 일본 확정 자리의 영향을 받지 않는다', () => {
  const lines = name => fitStockLabel({ ...BOX, name }).nameLines
  assert.deepEqual(lines('넥슨게임즈'), ['넥슨', '게임즈'])
  assert.notDeepEqual(lines('세븐일레븐'), ['세븐', '일레븐'])
})
