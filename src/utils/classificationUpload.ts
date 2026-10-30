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
  unknownCodes: string[] // 내 분류 목록에 없는 종목코드
  existingIdByPath: Map<string, number> // 이미 있는 분류의 경로 → id(새로 만든 분류의 id를 더해 가며 쓴다)
}

const pathKey = (path: string[]) => path.join('\u0000')

export class ClassificationUploadError extends Error {}

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
  const plan = { changedCount: 0, unchangedCount: 0, blankCount: 0, invalidCount: 0 }
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

  // 서버는 부모가 달라도 같은 업종명을 허용하지 않는다. 변경 요청 전에 전체 계획을 검사한다.
  const pathByName = new Map(sectors.map(sector => [sector.name, pathOf(sector.id)]))
  for (const path of newSectors) {
    const name = path[path.length - 1]
    const existingPath = pathByName.get(name)
    if (existingPath && pathKey(existingPath) !== pathKey(path)) {
      throw new ClassificationUploadError(`[${name}]가 서로 다른 경로에 있습니다.\n${existingPath.join(' > ')}\n${path.join(' > ')}\n업종명은 전체 분류에서 중복될 수 없습니다. 이름을 바꾼 뒤 다시 업로드해 주세요.`)
    }
    pathByName.set(name, path)
  }
  return { newSectors, assignments: [...groups.values()], unknownCodes, existingIdByPath: idByPath, ...plan }
}

export { pathKey }
