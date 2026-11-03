import assert from 'node:assert/strict'
import test from 'node:test'
import { indexSectorsByPath } from './sectorPath.ts'

const sector = (sectorName, items = [], children = []) => ({
  sectorId: 0,
  sectorName,
  isExcluded: false,
  totalMarketValue: items.reduce((sum, item) => sum + item.totalMarketValue, 0),
  items,
  children,
})

test('같은 sectorId를 쓰는 거래소 업종도 경로별로 원본을 찾는다', () => {
  const manufacturing = sector('제조', [{ stockCode: 'A', totalMarketValue: 100 }])
  const retail = sector('유통', [{ stockCode: 'B', totalMarketValue: 200 }])
  const byPath = indexSectorsByPath([manufacturing, retail])

  assert.equal(byPath.get('제조'), manufacturing)
  assert.equal(byPath.get('유통'), retail)
  assert.equal(byPath.size, 2)
})

test('같은 이름의 하위 업종도 상위 경로로 구분한다', () => {
  const first = sector('중분류', [], [sector('기타', [{ stockCode: 'A', totalMarketValue: 100 }])])
  const second = sector('다른 대분류', [], [sector('기타', [{ stockCode: 'B', totalMarketValue: 200 }])])
  const byPath = indexSectorsByPath([first, second])

  assert.equal(byPath.get('중분류>기타')?.items[0]?.stockCode, 'A')
  assert.equal(byPath.get('다른 대분류>기타')?.items[0]?.stockCode, 'B')
})
