// 날짜 글자 — 칸이 좁아지면 줄인다. 7일 이하는 월/일, 20일까지는 일만, 그보다 많으면 눈금 간격마다 월/일만 적는다(나머지는 비운다).
function dateLabel(date: string, index: number, total: number) {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  if (total <= 7) return `${month}/${day}`
  if (total <= 20) return String(day)
  if (total <= 31) return (total - 1 - index) % 2 === 0 ? String(day) : ''
  const step = Math.ceil(total / 6)
  return (total - 1 - index) % step === 0 ? `${month}/${day}` : ''
}

// 일별 사람 수 막대그래프 — 막대 위에 사람 수, 아래에 날짜를 적는다. 가장 큰 날이 가득 찬 높이다.
// 0명인 날은 흐린 얇은 막대로 둔다(날짜가 빠진 것이 아니라 0명이라는 뜻). 31일을 넘으면 막대가 가늘어져서
// 사람 수는 0명이 아닌 날에만 적는다.
export default function DailyAccessChart({ rows, ariaLabelPrefix = '일별 접속 회원 수' }: { rows: { date: string; members: number }[]; ariaLabelPrefix?: string }) {
  const max = Math.max(1, ...rows.map(row => row.members))
  const dense = rows.length > 31
  return (
    <div className={`flex h-full min-h-[140px] w-full items-end ${dense ? 'gap-px' : 'gap-1'}`} role="img" aria-label={`최근 ${rows.length}일 ${ariaLabelPrefix}`}>
      {rows.map((row, index) => (
        <div key={row.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs leading-none tabular-nums text-ui-text">{dense && row.members === 0 ? '' : row.members}</span>
          <span
            className="w-full rounded-[2px] bg-[var(--brand)]"
            style={{ height: `${Math.max(row.members > 0 ? 6 : 2, (row.members / max) * 100)}%`, maxWidth: 40, maxHeight: 'calc(100% - 40px)', opacity: row.members > 0 ? 1 : 0.25 }}
          />
          <span className={`flex h-[11px] w-full overflow-visible whitespace-nowrap text-[11px] leading-none tabular-nums text-ui-muted ${dense && index === rows.length - 1 ? 'justify-end' : 'justify-center'}`}>{dateLabel(row.date, index, rows.length)}</span>
        </div>
      ))}
    </div>
  )
}
