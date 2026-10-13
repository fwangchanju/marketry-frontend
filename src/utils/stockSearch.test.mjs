import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createStockMatcher } from './stockSearch.ts'

const row = (name, code, alias = null, labels = []) => ({ name, code, alias, labels })
const find = (query, rows, includeAlias = true) => {
  const matcher = createStockMatcher(query, r => ({ name: r.name, code: r.code, alias: includeAlias ? r.alias : null, labels: r.labels }))
  return rows.filter(matcher).map(r => r.name)
}
const rows = [
  row('HD현대', '267250', null, ['금융', '에너지화학', '정유']),
  row('HD현대중공업', '329180', 'HD중공업', ['운송장비/부품', '산업재', '조선']),
  row('삼성전자', '005930', null, ['전기/전자', 'S7']),
  row('빅웨이브로보틱스', '0035S0'),
  row('아모레퍼시픽홀딩스3우C', '00279K'),
  row('SK하이닉스', '000660', '하이닉스'),
]

test('대소문자와 공백을 무시한다', () => {
  assert.deepEqual(find('hd현대', rows), ['HD현대', 'HD현대중공업'])
  assert.deepEqual(find('HD 현대', rows), ['HD현대', 'HD현대중공업'])
})

test('영문이 섞인 종목코드도 대소문자 없이 찾는다', () => {
  assert.deepEqual(find('0035S0', rows), ['빅웨이브로보틱스'])
  assert.deepEqual(find('0035s0', rows), ['빅웨이브로보틱스'])
  assert.deepEqual(find('00279k', rows), ['아모레퍼시픽홀딩스3우C'])
})

test('자음은 초성으로 찾고 영문과 섞어 쳐도 된다', () => {
  assert.deepEqual(find('ㅅㅅㅈㅈ', rows), ['삼성전자'])
  assert.deepEqual(find('hdㅎㄷㅈㄱㅇ', rows), ['HD현대중공업'])
  // '홀딩스'의 초성(ㅎㄷㅅ)에도 맞는다.
  assert.deepEqual(find('ㅎㄷ', rows), ['HD현대', 'HD현대중공업', '아모레퍼시픽홀딩스3우C'])
})

test('약칭은 includeAlias일 때만, 분류명은 항상 찾는다', () => {
  assert.deepEqual(find('하이닉스', rows), ['SK하이닉스'])
  assert.deepEqual(find('중공업', rows, false), ['HD현대중공업'])
  assert.deepEqual(find('HD중공업', rows, false), [])
  assert.deepEqual(find('조선', rows), ['HD현대중공업'])
  assert.deepEqual(find('ㅈㅅ', rows), ['HD현대중공업'])
})
