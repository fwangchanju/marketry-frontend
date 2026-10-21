// 일별 접속 회원 수 막대그래프 — 막대 위에 사람 수, 아래에 날짜(일)를 적는다. 가장 많이 온 날이 가득 찬 높이다.
// 접속한 사람이 없는 날은 흐린 얇은 막대로 둔다(날짜가 빠진 것이 아니라 0명이라는 뜻).
export default function DailyAccessChart({ rows }: { rows: { date: string; members: number }[] }) {
  const max = Math.max(1, ...rows.map(row => row.members))
  return (
    <div className="flex h-full min-h-[220px] w-full items-end gap-1" role="img" aria-label={`최근 ${rows.length}일 일별 접속 회원 수`}>
      {rows.map(row => (
        <div key={row.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs leading-none tabular-nums text-ui-text">{row.members}</span>
          <span
            className="w-full rounded-[2px] bg-[var(--brand)]"
            style={{ height: `${Math.max(row.members > 0 ? 6 : 2, (row.members / max) * 100)}%`, maxWidth: 40, maxHeight: 'calc(100% - 40px)', opacity: row.members > 0 ? 1 : 0.25 }}
          />
          <span className="text-[11px] leading-none tabular-nums text-ui-muted">{rows.length > 31 ? Number(row.date.slice(8, 10)) : `${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}`}</span>
        </div>
      ))}
    </div>
  )
}
