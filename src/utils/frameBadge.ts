import type { CSSProperties } from 'react'
import type { TaxonomyKey } from '@/utils/taxonomyNames'

// 항목 틀(서머리·어드민 대시보드·어드민 메시지)의 제목 배지 — 높이 24px의 짙은 청록 배지다.
// 배지는 틀 바깥 테두리에서 왼쪽·위쪽 모두 8px 떨어뜨린다(테두리 1px + 안쪽 여백 7px). 틀의 안쪽 여백은 네 방향 모두 7px이라 틀 안의 내용은 어느 쪽 가장자리에서도 8px 떨어진다.
export const FRAME_BADGE_CLASS = 'inline-flex h-6 min-h-6 shrink-0 items-center whitespace-nowrap rounded-sm bg-[var(--brand-surface)] px-2 text-[14px] font-semibold leading-none text-ui-white'
export const EXCHANGE_FRAME_BADGE_CLASS = FRAME_BADGE_CLASS.replace('bg-[var(--brand-surface)]', 'bg-[var(--exchange-surface)]')

// 제목 배지의 배경색 — 시장이 아니라 분류 역할로 정한다. 서머리 화면 틀·캡처 틀과 상단 분류 배지가 같은 규칙을 쓴다.
// NXT는 거래소의 시간대 필터라 KRX와 같은 색을 쓰고, 별도 저장 프로필이 아니다.
export function frameBadgeSurface(taxonomy: TaxonomyKey, strongIndustryColor?: string): string {
  if (taxonomy === 'KRX' || taxonomy === 'NXT') return 'var(--exchange-surface)'
  if (taxonomy === 'MINE') return `color-mix(in srgb, ${strongIndustryColor ?? '#fff59d'} 60%, #0a0a0a)`
  return 'var(--brand-surface)'
}

// 서머리 틀이 받는 배지 값. 거래소는 배경색 클래스만 바꾸고, 내 기준은 계산한 색을 값으로 넘긴다. 모양·여백·높이는 분류와 무관하다.
export function frameBadgeStyle(taxonomy: TaxonomyKey, strongIndustryColor?: string): { badgeClassName?: string; badgeStyle?: CSSProperties } {
  if (taxonomy === 'KRX' || taxonomy === 'NXT') return { badgeClassName: EXCHANGE_FRAME_BADGE_CLASS }
  if (taxonomy === 'MINE') return { badgeStyle: { backgroundColor: frameBadgeSurface(taxonomy, strongIndustryColor) } }
  return {}
}
