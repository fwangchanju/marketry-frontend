import type { StockRow } from '@/components/StockTable'

// 엑셀 한 줄의 종목 칸(대·중·소분류 앞)과 칸 정렬·너비.
export interface ExportLine {
  cells: Record<string, string>
  align: Record<string, 'center' | 'left' | 'right'>
  widths: Record<string, number>
}

// 한국 엑셀의 종목 칸 — 종목코드·종목명·규모·마켓·거래소 분류.
export function koreaExportLine(row: StockRow): ExportLine {
  return {
    cells: { 종목코드: row.code, 종목명: row.name, '규모': row.cells.sizeTier ?? '', 마켓: row.cells.market ?? '', '거래소 분류': row.cells.industry || '-' },
    align: { 종목코드: 'center', '규모': 'center', 마켓: 'center' },
    widths: { 종목코드: 15, 종목명: 30, '규모': 15, 마켓: 10, '거래소 분류': 20 },
  }
}
