import { STOCK_CHECKBOX_COLUMN_PX, stockColumnFixedPx, type StockColumnKey } from '@/utils/stockTableColumns'

// 종목 표의 열 폭 — 체크박스 칸과 고정 폭 열만 px를 주고, 나머지 열은 폭을 비워 남는 폭을 같게 나눠 갖게 한다(table-fixed 표용).
export default function StockTableColGroup({ keys, widths }: { keys: readonly StockColumnKey[]; widths?: Partial<Record<StockColumnKey, number>> }) {
  return (
    <colgroup>
      <col style={{ width: STOCK_CHECKBOX_COLUMN_PX }} />
      {keys.map(key => {
        // 폭 표가 있는데 키가 없으면 좁은 창에서 숨긴 열이다(hiddenStockColumnsFor) — 열 폭도 그리지 않는다.
        if (widths && widths[key] === undefined) return null
        const width = widths?.[key] ?? stockColumnFixedPx(key)
        return <col key={key} style={width === undefined ? undefined : { width }} />
      })}
    </colgroup>
  )
}
