import * as XLSX from 'xlsx'
import type { SectorItem } from '@/types/api'

// 엑셀 업로드로 내 분류를 한 번에 바꾸는 계산 — 화면과 무관한 순수 함수만 둔다.
// 파일에서 읽는 열: 종목코드, 대분류, 중분류, 소분류(그 밖의 열은 무시). 종목은 가장 깊게 적힌 분류에 배정한다.

export interface UploadRow {
  stockCode: string
  path: string[] // 대·중·소분류 이름, 비어 있는 뒷부분은 잘라낸다
  invalid: boolean // 대분류 없이 중·소분류만 적은 줄
}

const BLANK_VALUES = new Set(['', '-', '(없음)'])

// 서버가 정지 종목을 자동으로 배정하는 업종 이름(protectedSector.ts의 거래 정지와 같은 값 — node 테스트에서 별칭 경로를 못 읽어 여기 둔다).
const AUTO_ASSIGNED_SECTOR_NAME = '거래 정지'

const normalizeName = (value: unknown) => String(value ?? '').trim()

// 엑셀이 "005930"을 숫자 5930으로 바꿔 저장한 경우를 위해 6자리 미만 숫자는 앞을 0으로 채운다.
const normalizeStockCode = (value: unknown) => {
  const text = normalizeName(value)
  return /^\d{1,5}$/.test(text) ? text.padStart(6, '0') : text
}

export async function readClassificationFile(file: File): Promise<UploadRow[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  if (!sheet) return []
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false })
  return records
    .map(record => {
      const names = [record['대분류'], record['중분류'], record['소분류']].map(normalizeName).map(name => (BLANK_VALUES.has(name) ? '' : name))
      const lastFilled = names.reduce((last, name, index) => (name ? index : last), -1)
      const path = names.slice(0, lastFilled + 1)
      return {
        stockCode: normalizeStockCode(record['종목코드']),
        path,
        invalid: path.some(name => !name),
      }
    })
    .filter(row => row.stockCode !== '')
}

export interface UploadPlan {
  // 새로 만들어야 하는 분류(부모 경로 포함, 위 단계부터 순서대로)
  newSectors: string[][]
  // 분류 경로(키) → 그 경로로 바꿀 종목코드들
  assignments: { path: string[]; stockCodes: string[] }[]
  changedCount: number
  unchangedCount: number
  blankCount: number // 대·중·소분류를 모두 비운 줄 — 건드리지 않는다
  invalidCount: number // 대분류 없이 중·소분류만 있는 줄
  autoAssignedCount: number // 거래 정지 줄 — 정지 종목은 서버가 자동으로 배정하니 파일로 넣지 않고 건너뛴다
  unknownCodes: string[] // 내 분류 목록에 없는 종목코드
  existingIdByPath: Map<string, number> // 이미 있는 분류의 경로 → id(새로 만든 분류의 id를 더해 가며 쓴다)
}

const pathKey = (path: string[]) => path.join('\u0000')

export class ClassificationUploadError extends Error {}

// 같은 업종명이 서로 다른 경로에 있는 충돌 하나 — 내 분류(또는 파일의 앞쪽 줄)의 경로와 파일의 경로다.
interface NameConflict {
  name: string
  otherPath: string[]
  otherFromFile: boolean
  filePath: string[]
}

// 팝업에 한 번에 보여 줄 충돌 수 — 많으면 나머지는 건수로만 알린다.
const MAX_SHOWN_CONFLICTS = 5

// 어느 쪽이 내 분류이고 어느 쪽이 파일인지, 어떻게 고치면 되는지까지 알려 주는 문구다.
export function buildConflictMessage(conflicts: readonly NameConflict[]): string {
  const blocks = conflicts.slice(0, MAX_SHOWN_CONFLICTS).map(conflict =>
    `[${conflict.name}]\n${conflict.otherFromFile ? '파일(앞줄)' : '내 분류'}: ${conflict.otherPath.join(' > ')}\n파일: ${conflict.filePath.join(' > ')}`)
  const rest = conflicts.length > MAX_SHOWN_CONFLICTS ? `\n외 ${conflicts.length - MAX_SHOWN_CONFLICTS}건` : ''
  const fix = conflicts.some(conflict => !conflict.otherFromFile)
    ? '파일의 경로를 내 분류와 같게 고치거나,\n내 분류의 업종 이름을 파일에 맞게 바꾼 뒤 다시 올려 주세요.'
    : '파일 안에서 같은 이름의 업종이 서로 다른 경로에 있습니다.\n파일의 경로를 하나로 맞춘 뒤 다시 올려 주세요.'
  return `같은 이름의 업종이 서로 다른 경로에 있어 올릴 수 없습니다. (${conflicts.length}건)\n\n${blocks.join('\n\n')}${rest}\n\n${fix}`
}

export function buildUploadPlan(rows: UploadRow[], sectors: SectorItem[], currentSectorIdByCode: Map<string, number | null>): UploadPlan {
  const idByPath = new Map<string, number>()
  const nameById = new Map(sectors.map(sector => [sector.id, sector]))
  const pathOf = (sectorId: number | null): string[] => {
    const names: string[] = []
    let current = sectorId == null ? undefined : nameById.get(sectorId)
    while (current) {
      names.unshift(current.name)
      current = current.parentId == null ? undefined : nameById.get(current.parentId)
    }
    return names
  }
  for (const sector of sectors) idByPath.set(pathKey(pathOf(sector.id)), sector.id)

  const newSectorKeys = new Set<string>()
  const newSectors: string[][] = []
  const groups = new Map<string, { path: string[]; stockCodes: string[] }>()
  const plan = { changedCount: 0, unchangedCount: 0, blankCount: 0, invalidCount: 0, autoAssignedCount: 0 }
  const unknownCodes: string[] = []
  const seenCodes = new Set<string>()

  for (const row of rows) {
    if (seenCodes.has(row.stockCode)) continue // 같은 종목이 여러 줄이면 첫 줄만 쓴다
    seenCodes.add(row.stockCode)
    if (!currentSectorIdByCode.has(row.stockCode)) {
      unknownCodes.push(row.stockCode)
      continue
    }
    if (row.invalid) {
      plan.invalidCount++
      continue
    }
    if (row.path.length === 0) {
      plan.blankCount++
      continue
    }
    // 거래 정지 업종에는 서버가 연속 5거래일 정지 종목만 자동으로 넣는다 — 파일에 적혀 있어도(내려받은 엑셀에는 들어 있다) 건너뛴다.
    if (row.path[0] === AUTO_ASSIGNED_SECTOR_NAME) {
      plan.autoAssignedCount++
      continue
    }
    const key = pathKey(row.path)
    const existingId = idByPath.get(key)
    if (existingId !== undefined && currentSectorIdByCode.get(row.stockCode) === existingId) {
      plan.unchangedCount++
      continue
    }
    plan.changedCount++
    // 없는 단계는 위에서부터 새로 만들 목록에 올린다.
    for (let depth = 1; depth <= row.path.length; depth++) {
      const partial = row.path.slice(0, depth)
      const partialKey = pathKey(partial)
      if (!idByPath.has(partialKey) && !newSectorKeys.has(partialKey)) {
        newSectorKeys.add(partialKey)
        newSectors.push(partial)
      }
    }
    const group = groups.get(key)
    if (group) group.stockCodes.push(row.stockCode)
    else groups.set(key, { path: row.path, stockCodes: [row.stockCode] })
  }

  // 서버는 부모가 달라도 같은 업종명을 허용하지 않는다. 변경 요청 전에 전체 계획을 검사하고, 충돌을 한 번에 모두 알려 준다.
  const pathByName = new Map(sectors.map(sector => [sector.name, { path: pathOf(sector.id), fromFile: false }]))
  const conflicts: NameConflict[] = []
  for (const path of newSectors) {
    const name = path[path.length - 1]
    const other = pathByName.get(name)
    if (other && pathKey(other.path) !== pathKey(path)) {
      conflicts.push({ name, otherPath: other.path, otherFromFile: other.fromFile, filePath: path })
      continue
    }
    pathByName.set(name, { path, fromFile: true })
  }
  if (conflicts.length > 0) throw new ClassificationUploadError(buildConflictMessage(conflicts))
  return { newSectors, assignments: [...groups.values()], unknownCodes, existingIdByPath: idByPath, ...plan }
}

export { pathKey }
