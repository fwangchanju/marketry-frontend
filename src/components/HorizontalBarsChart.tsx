// 가로 막대 — 항목마다 이름·막대·사람 수를 한 줄에 둔다. 가장 큰 값이 가득 찬 길이다. 0명인 항목은 흐린 얇은 막대로 둔다.
export interface HorizontalBarRow {
  key: string
  label: string
  count: number
  barClass: string
  textClass: string
}

export default function HorizontalBarsChart({ rows, ariaLabel, labelWidth = 64 }: { rows: HorizontalBarRow[]; ariaLabel: string; labelWidth?: number }) {
  const max = Math.max(1, ...rows.map(row => row.count))
  return (
    <div className="flex h-full min-h-[140px] w-full flex-col justify-center gap-3" role="img" aria-label={ariaLabel}>
      {rows.map(row => (
        <div key={row.key} className="flex items-center gap-3">
          <span className={`shrink-0 text-right text-sm font-medium ${row.textClass}`} style={{ width: labelWidth }}>{row.label}</span>
          <span className="flex h-5 min-w-0 flex-1 items-center">
            <span className={`block h-full rounded-[2px] ${row.barClass}`} style={{ width: `${Math.max(row.count > 0 ? 3 : 0.5, (row.count / max) * 100)}%`, opacity: row.count > 0 ? 1 : 0.25 }} />
          </span>
          <span className="w-[44px] shrink-0 text-sm tabular-nums text-ui-white">{row.count.toLocaleString()}명</span>
        </div>
      ))}
    </div>
  )
}
