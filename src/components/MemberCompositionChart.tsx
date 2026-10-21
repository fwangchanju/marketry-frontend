import HorizontalBarsChart, { type HorizontalBarRow } from '@/components/HorizontalBarsChart'

// 회원 구성 가로 막대 — 관리자·특별 회원·일반 회원 수를 같은 눈금으로 비교한다. 구분 색은 어드민 회원 표와 같다(관리자 분홍, 특별 회원 웜 골드, 일반 회원 본문색).
export default function MemberCompositionChart({ counts }: { counts: { admins: number; specials: number; users: number } }) {
  const rows: HorizontalBarRow[] = [
    { key: 'admins', label: '관리자', count: counts.admins, barClass: 'bg-admin-only', textClass: 'text-admin-only' },
    { key: 'specials', label: '특별 회원', count: counts.specials, barClass: 'bg-[var(--sub-gold)]', textClass: 'text-[var(--sub-gold)]' },
    { key: 'users', label: '일반 회원', count: counts.users, barClass: 'bg-ui-text', textClass: 'text-ui-text' },
  ]
  return <HorizontalBarsChart rows={rows} ariaLabel="회원 구성" />
}
