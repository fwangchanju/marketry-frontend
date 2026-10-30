import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PROTECTED_SECTOR_NAMES,
  getProtectedSectorDeleteMessage,
  getProtectedSectorHint,
  isProtectedSectorName,
  placeProtectedSectorsLast,
  suspendedSectorStat,
} from './protectedSector.ts'

test('보호 업종 이름은 띄어쓰기까지 정확히 미분류·신규 상장·거래 정지다', () => {
  assert.deepEqual([...PROTECTED_SECTOR_NAMES], ['미분류', '신규 상장', '거래 정지'])
  assert.equal(isProtectedSectorName('거래 정지'), true)
  assert.equal(isProtectedSectorName('거래정지'), false)
  assert.equal(isProtectedSectorName('기타'), false)
})

test('보호 업종마다 툴팁과 삭제 불가 안내가 있다', () => {
  for (const name of PROTECTED_SECTOR_NAMES) {
    assert.ok(getProtectedSectorHint(name), `${name} 툴팁`)
    assert.ok(getProtectedSectorDeleteMessage(name).includes('삭제'), `${name} 삭제 안내`)
  }
  assert.equal(getProtectedSectorHint('금융'), undefined)
})

test('보호 업종은 정렬 결과와 상관없이 맨 아래에 미분류·신규 상장·거래 정지 순서로 놓인다', () => {
  const sorted = ['미분류', '금융', '신규 상장', '반도체', '거래 정지']
  assert.deepEqual(placeProtectedSectorsLast(sorted, name => name), ['금융', '반도체', '미분류', '신규 상장', '거래 정지'])
  // 내림차순으로 정렬해 들어와도 보호 업종은 같은 자리다.
  assert.deepEqual(placeProtectedSectorsLast([...sorted].reverse(), name => name), ['반도체', '금융', '미분류', '신규 상장', '거래 정지'])
})

test('거래 정지 업종은 실제로 배정된 종목 수와 시가총액 합으로 센다', () => {
  const sectors = [
    { id: 1, name: '금융', parentId: null },
    { id: 9, name: '거래 정지', parentId: null },
    { id: 10, name: '거래 정지', parentId: 1 }, // 하위 업종의 같은 이름은 보호 업종이 아니다
  ]
  const items = [
    { sectorId: 9, totalMarketValue: 300 },
    { sectorId: 9, totalMarketValue: null },
    { sectorId: 1, totalMarketValue: 50 },
    { sectorId: null, totalMarketValue: 7 },
  ]
  assert.deepEqual(suspendedSectorStat(sectors, items), { sectorId: 9, marketValue: 300, stockCount: 2 })
})

test('거래 정지 업종이 없으면 계산하지 않는다', () => {
  assert.equal(suspendedSectorStat([{ id: 1, name: '금융', parentId: null }], []), null)
})
