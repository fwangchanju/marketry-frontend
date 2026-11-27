// 엑셀 파일 만들기 — ExcelJS(서식·필터·시트 잠금을 지원)를 쓰고, 내려받기를 누를 때만 불러온다(용량이 커서 화면을 여는 속도에 영향이 없게).

export type ColumnAlign = 'left' | 'center' | 'right'

export interface ExcelExportOptions {
  // 머리글 이름 → 가로 정렬(없으면 왼쪽). 머리글 줄의 항목명은 모두 가운데다.
  alignByHeader?: Record<string, ColumnAlign>
  // 머리글 이름 → 정해 둔 열 너비(글자 수). 지정한 열은 글자 길이와 상관없이 이 너비로 고정한다.
  fixedWidths?: Record<string, number>
  // 시트를 잠그고(비밀번호 없음) 이 머리글의 열만 수정할 수 있게 둔다. 비어 있으면 잠그지 않는다. 필터·정렬·열 너비 조정은 잠금 중에도 된다.
  editableHeaders?: string[]
}

// 엑셀 글꼴 — 윈도우 엑셀의 "맑은 고딕".
// 잠긴 칸 바탕색(머리글 D9D9D9보다 훨씬 연한 회색).
const LOCKED_CELL_COLOR = 'FFF2F2F2'
const FONT_NAME = '맑은 고딕'

// 글자 폭을 열 너비로 바꾼다 — 한글·한자 같은 넓은 글자는 2칸, 그 밖은 1칸으로 센다.
const displayWidth = (text: string) => [...text].reduce((sum, char) => sum + (char.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)

// 숫자는 콤마가 붙은 모양으로 센다.
const displayText = (value: string | number | undefined) => (typeof value === 'number' ? value.toLocaleString('en-US') : String(value ?? ''))

// 열마다 값 중 가장 긴 글자에 맞추고(양쪽 여유 2칸), 머리글은 필터 단추 자리까지 더해 맞춘다. 너무 길면 50칸에서 멈춘다. 정해 둔 너비가 있으면 그대로 쓴다.
function columnWidth(header: string, rows: Record<string, string | number>[], fixedWidths: Record<string, number>) {
  if (fixedWidths[header] !== undefined) return fixedWidths[header]
  const longestValue = rows.reduce((max, row) => Math.max(max, displayWidth(displayText(row[header]))), 0)
  return Math.min(Math.max(longestValue + 2, displayWidth(header) + 5), 50)
}

// 종목코드처럼 "005930"같은 값은 엑셀이 숫자로 오인해서 앞자리 0을 지워버린다.
// 그래서 글자 값은 문자열로 넣고 서식도 "텍스트"(@)로 고정해, 이후 사용자가 셀을 수정해도 숫자/날짜로 해석되지 않게 한다.
// 숫자 값(시가총액 등)은 숫자 칸으로 두고 천 단위 콤마 서식만 준다.
export async function exportRowsToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, string | number>[],
  { alignByHeader = {}, fixedWidths = {}, editableHeaders = [] }: ExcelExportOptions = {},
) {
  const ExcelJS = (await import('exceljs')).default
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)
  const headers = Object.keys(rows[0] ?? {})
  const headerAlignment = { horizontal: 'center', vertical: 'middle' } as const

  sheet.columns = headers.map(header => ({ header, key: header, width: columnWidth(header, rows, fixedWidths) }))
  sheet.addRows(rows.map(row => headers.map(header => row[header] ?? '')))

  const headerRow = sheet.getRow(1)
  headerRow.eachCell(cell => {
    cell.font = { name: FONT_NAME, bold: true }
    cell.alignment = headerAlignment
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } }
  })
  headers.forEach((header, index) => {
    const column = sheet.getColumn(index + 1)
    const alignment = { horizontal: alignByHeader[header] ?? 'left', vertical: 'middle' } as const
    const isEditable = editableHeaders.includes(header)
    column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
      if (rowNumber === 1) return
      cell.font = { name: FONT_NAME }
      cell.alignment = alignment
      if (typeof cell.value === 'number') cell.numFmt = '#,##0'
      else cell.numFmt = '@'
      if (isEditable) cell.protection = { locked: false }
      // 시트를 잠글 때는 잠긴 칸에 연한 회색을 깐다. 수정할 칸은 흰색으로 남아 붙여넣기로 서식이 덮여도 구별이 유지된다(잠긴 칸은 붙여넣을 수 없다).
      else if (editableHeaders.length > 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LOCKED_CELL_COLOR } }
    })
  })

  // 맨 윗줄(머리글)에 필터 단추를 둔다.
  if (headers.length > 0) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: rows.length + 1, column: headers.length } }
  if (editableHeaders.length > 0) {
    await sheet.protect('', { autoFilter: true, sort: true, formatColumns: true, selectLockedCells: true, selectUnlockedCells: true })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
