import { formatCount } from '@/utils/formatCount'

// 날짜 글자 — DailyAccessChart와 같은 규칙이다(7일 이하는 월/일, 20일까지는 일만, 31일까지는 하루 건너, 그보다 많으면 눈금 간격마다 월/일).
function dateLabel(date: string, index: number, total: number) {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  if (total <= 7) return `${month}/${day}`
  if (total <= 20) return String(day)
  if (total <= 31) return (total - 1 - index) % 2 === 0 ? String(day) : ''
  const step = Math.ceil(total / 6)
  return (total - 1 - index) % step === 0 ? `${month}/${day}` : ''
}

export interface StackedDailyRow {
  date: string
  guests: number
  members: number
}

const GUEST_COLOR = 'var(--brand-surface)'
const MEMBER_COLOR = 'var(--brand)'

// 총 방문자 합산 막대그래프 — 하루가 막대 하나이고, 막대는 비회원(아래)과 회원(위)이 쌓여 합계 높이가 된다.
// 막대 위에 합계, 아래에 날짜를 적고 0인 날은 숫자 없이 흐린 얇은 막대로 둔다. 위쪽 범례가 두 색을 알려 준다.
export function StackedDailyLegend() {
  return (
    <div className="flex shrink-0 items-center gap-3 text-[11px] leading-none text-ui-muted">
      <span className="flex items-center gap-1"><span className="size-2 rounded-[2px]" style={{ backgroundColor: MEMBER_COLOR }} />회원</span>
      <span className="flex items-center gap-1"><span className="size-2 rounded-[2px]" style={{ backgroundColor: GUEST_COLOR }} />비회원</span>
    </div>
  )
}

export default function StackedDailyChart({ rows, ariaLabelPrefix = '총 방문자 수', showLegend = true }: { rows: StackedDailyRow[]; ariaLabelPrefix?: string; showLegend?: boolean }) {
  const max = Math.max(1, ...rows.map(row => row.guests + row.members))
  const dense = rows.length > 31
  return (
    <div className="flex h-full min-h-[140px] w-full flex-col">
      {showLegend && <StackedDailyLegend />}
      <div className={`flex min-h-0 flex-1 items-end ${dense ? 'gap-px' : 'gap-1'}`} role="img" aria-label={`최근 ${rows.length}일 ${ariaLabelPrefix}(회원·비회원)`}>
        {rows.map((row, index) => {
          const total = row.guests + row.members
          return (
            <div key={row.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs leading-none tabular-nums text-ui-text">{total === 0 ? '' : formatCount(total)}</span>
              <span
                className="flex w-full flex-col justify-end overflow-hidden rounded-[2px]"
            style={{ height: `${Math.max(total > 0 ? 6 : 2, (total / max) * 100)}%`, maxWidth: 40, maxHeight: 'calc(100% - 40px)', backgroundColor: total === 0 ? 'var(--brand)' : undefined, opacity: total > 0 ? 1 : 0.2 }}
              >
                <span style={{ flexGrow: row.members, backgroundColor: MEMBER_COLOR }} />
                <span style={{ flexGrow: row.guests, backgroundColor: GUEST_COLOR }} />
              </span>
              <span className={`flex h-[11px] w-full overflow-visible whitespace-nowrap text-[11px] leading-none tabular-nums text-ui-muted ${dense && index === rows.length - 1 ? 'justify-end' : 'justify-center'}`}>{dateLabel(row.date, index, rows.length)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
