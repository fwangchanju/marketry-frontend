// 회원 구성 가로 막대 — 관리자·특별 회원·일반 회원 수를 같은 눈금으로 비교한다. 구분 색은 어드민 회원 표와 같다(관리자 분홍, 특별 회원 웜 골드, 일반 회원 본문색).
const ROWS = [
  { key: 'admins', label: '관리자', bar: 'bg-admin-only', text: 'text-admin-only' },
  { key: 'specials', label: '특별 회원', bar: 'bg-[var(--sub-gold)]', text: 'text-[var(--sub-gold)]' },
  { key: 'users', label: '일반 회원', bar: 'bg-ui-text', text: 'text-ui-text' },
] as const

export default function MemberCompositionChart({ counts }: { counts: { admins: number; specials: number; users: number } }) {
  const max = Math.max(1, counts.admins, counts.specials, counts.users)
  return (
    <div className="flex h-full min-h-[140px] w-full flex-col justify-center gap-3" role="img" aria-label="회원 구성">
      {ROWS.map(row => (
        <div key={row.key} className="flex items-center gap-3">
          <span className={`w-[64px] shrink-0 text-right text-sm font-medium ${row.text}`}>{row.label}</span>
          <span className="flex h-5 min-w-0 flex-1 items-center">
            <span className={`block h-full rounded-[2px] ${row.bar}`} style={{ width: `${Math.max(counts[row.key] > 0 ? 3 : 0.5, (counts[row.key] / max) * 100)}%`, opacity: counts[row.key] > 0 ? 1 : 0.25 }} />
          </span>
          <span className="w-[44px] shrink-0 text-sm tabular-nums text-ui-white">{counts[row.key].toLocaleString()}명</span>
        </div>
      ))}
    </div>
  )
}
