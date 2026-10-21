// 일별 접속 회원 수 막대그래프 — 막대 위에 사람 수, 아래에 날짜(일)를 적는다. 가장 많이 온 날이 가득 찬 높이다.
// 접속한 사람이 없는 날은 흐린 얇은 막대로 둔다(날짜가 빠진 것이 아니라 0명이라는 뜻).
// 날짜 글자 — 칸이 좁아지면 줄인다. 7일 이하는 월/일, 그보다 많으면 일만 적고, 20일을 넘으면 오늘을 기준으로 하나 건너 적는다.
function dateLabel(date: string, index: number, total: number) {
  const day = Number(date.slice(8, 10))
  if (total <= 7) return `${Number(date.slice(5, 7))}/${day}`
  if (total > 20 && (total - 1 - index) % 2 === 1) return ''
  return String(day)
}

export default function DailyAccessChart({ rows }: { rows: { date: string; members: number }[] }) {
  const max = Math.max(1, ...rows.map(row => row.members))
  return (
    <div className="flex h-full min-h-[140px] w-full items-end gap-1" role="img" aria-label={`최근 ${rows.length}일 일별 접속 회원 수`}>
      {rows.map((row, index) => (
        <div key={row.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs leading-none tabular-nums text-ui-text">{row.members}</span>
          <span
            className="w-full rounded-[2px] bg-[var(--brand)]"
            style={{ height: `${Math.max(row.members > 0 ? 6 : 2, (row.members / max) * 100)}%`, maxWidth: 40, maxHeight: 'calc(100% - 40px)', opacity: row.members > 0 ? 1 : 0.25 }}
          />
          <span className="h-[11px] text-[11px] leading-none tabular-nums text-ui-muted">{dateLabel(row.date, index, rows.length)}</span>
        </div>
      ))}
    </div>
  )
}
