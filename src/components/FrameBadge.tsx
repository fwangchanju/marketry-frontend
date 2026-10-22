import type { ReactNode } from 'react'

// 항목 틀(홈·어드민 대시보드·어드민 메시지)의 제목 배지 — 높이 24px의 짙은 청록 배지다.
// 배지는 틀 바깥 테두리에서 왼쪽·위쪽 모두 8px 떨어뜨린다(테두리 1px + 안쪽 여백 7px). 틀의 안쪽 여백은 네 방향 모두 7px이라 틀 안의 내용은 어느 쪽 가장자리에서도 8px 떨어진다.
export const FRAME_BADGE_CLASS = 'inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap rounded-sm bg-[var(--brand-surface)] px-2 text-[14px] font-semibold leading-none text-ui-white'

export default function FrameBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${FRAME_BADGE_CLASS} ${className}`}>{children}</span>
}
