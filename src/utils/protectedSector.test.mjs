import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  PROTECTED_SECTOR_NAMES,
  getProtectedSectorDeleteMessage,
  getProtectedSectorHint,
  isProtectedSectorName,
  placeProtectedSectorsLast,
  KRX_PROTECTED_SECTOR_NAMES,
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

test('거래소 표는 거래 정지만 맨 아래로 보낸다', () => {
  const rows = ['미분류', '금융', '거래 정지', '건설']
  assert.deepEqual(placeProtectedSectorsLast(rows, name => name, ['거래 정지']), ['미분류', '금융', '건설', '거래 정지'])
  // 거래소 표는 미분류도 맨 아래로 보낸다(미분류 → 거래 정지 순서).
  assert.deepEqual(placeProtectedSectorsLast(rows, name => name, KRX_PROTECTED_SECTOR_NAMES), ['금융', '건설', '미분류', '거래 정지'])
})

test('거래소 표의 거래 정지 툴팁은 재개되면 원래 업종으로 돌아간다고 알린다', () => {
  assert.ok(getProtectedSectorHint('거래 정지', 'KRX').includes('원래 거래소 업종'))
  assert.ok(getProtectedSectorHint('거래 정지').includes('옮길 수 없습니다'))
})
