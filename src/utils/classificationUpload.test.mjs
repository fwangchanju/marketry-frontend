import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildUploadPlan, ClassificationUploadError } from './classificationUpload.ts'

const sector = (id, name, parentId, depth) => ({ id, name, parentId, depth })
const sectors = [sector(1, '임의소비재', null, 0), sector(2, '콘텐츠', 1, 1), sector(3, '금융', null, 0), sector(4, '은행', 3, 1)]
const currentSectorIdByCode = new Map([['000001', 2], ['000002', 4], ['000003', null], ['000004', null]])

test('같은 이름이 다른 경로에 있으면 내 분류와 파일을 구분해 모두 알려 준다', () => {
  const rows = [
    { stockCode: '000001', path: ['임의 소비재', '콘텐츠'], invalid: false },
    { stockCode: '000002', path: ['금 융', '은행'], invalid: false },
  ]
  assert.throws(() => buildUploadPlan(rows, sectors, currentSectorIdByCode), error => {
    assert.ok(error instanceof ClassificationUploadError)
    assert.match(error.message, /서로 다른 경로에 있어 올릴 수 없습니다\. \(2건\)/)
    assert.match(error.message, /\[콘텐츠\]\n내 분류: 임의소비재 > 콘텐츠\n파일: 임의 소비재 > 콘텐츠/)
    assert.match(error.message, /\[은행\]\n내 분류: 금융 > 은행\n파일: 금 융 > 은행/)
    assert.match(error.message, /내 분류의 업종 이름을 파일에 맞게 바꾼 뒤 다시 올려 주세요\./)
    return true
  })
})

test('파일 안에서 같은 이름이 다른 경로에 있으면 파일 안의 문제라고 알려 준다', () => {
  const rows = [
    { stockCode: '000003', path: ['가', '새업종'], invalid: false },
    { stockCode: '000004', path: ['나', '새업종'], invalid: false },
  ]
  assert.throws(() => buildUploadPlan(rows, sectors, currentSectorIdByCode), error => {
    assert.match(error.message, /\(1건\)/)
    assert.match(error.message, /\[새업종\]\n파일\(앞줄\): 가 > 새업종\n파일: 나 > 새업종/)
    assert.match(error.message, /파일 안에서 같은 이름의 업종이 서로 다른 경로에 있습니다\./)
    return true
  })
})

test('충돌이 많으면 앞의 5건만 보여 주고 나머지는 건수로 알린다', () => {
  const many = Array.from({ length: 7 }, (_, index) => sector(100 + index, `업종${index}`, null, 0))
  const manySectors = [...sectors, ...many]
  const codes = new Map(manySectors.map((item, index) => [String(index).padStart(6, '0'), item.id]))
  const rows = many.map((item, index) => ({ stockCode: String(sectors.length + index).padStart(6, '0'), path: ['다른부모', item.name], invalid: false }))
  assert.throws(() => buildUploadPlan(rows, manySectors, codes), error => {
    assert.match(error.message, /\(7건\)/)
    assert.match(error.message, /외 2건/)
    return true
  })
})

test('충돌이 없으면 계획을 돌려준다', () => {
  const rows = [{ stockCode: '000003', path: ['금융', '증권'], invalid: false }]
  const plan = buildUploadPlan(rows, sectors, currentSectorIdByCode)
  assert.deepEqual(plan.newSectors, [['금융', '증권']])
  assert.equal(plan.changedCount, 1)
})

test('거래 정지 줄은 서버가 자동 배정하니 건너뛰고 변경 수에 넣지 않는다', () => {
  const rows = [
    { stockCode: '000003', path: ['거래 정지'], invalid: false },
    { stockCode: '000004', path: ['금융', '증권'], invalid: false },
  ]
  const plan = buildUploadPlan(rows, sectors, currentSectorIdByCode)
  assert.equal(plan.autoAssignedCount, 1)
  assert.equal(plan.changedCount, 1)
  assert.deepEqual(plan.newSectors, [['금융', '증권']])
  assert.deepEqual(plan.assignments.map(group => group.stockCodes), [['000004']])
})
