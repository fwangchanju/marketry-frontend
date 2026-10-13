import type { ReactNode } from 'react'
import { FONT_BAR_TIME } from '@/components/FontStyle'

// 툴바(메인 영역 맨 윗줄)의 정보 항목 하나를 감싸는 회색 칩 — 날짜, 시각, 시장 시간대 같은 항목이 각각 따로 칩이다.
// 색·높이는 Custom 페이지의 검색창과 같다(#3b3b3b, 24px). 글자색은 항목마다 다르므로 tone으로 받는다.
// bare는 안쪽 여백·간격을 칩이 아니라 안의 버튼이 가진다 — 눌러서 쓰는 항목(날짜·새로고침·제외 종목)은 칩 전체가 버튼이어야 해서 이렇게 쓴다.
export default function ToolbarChip({ children, tone = 'text-white', bare = false }: { children: ReactNode; tone?: string; bare?: boolean }) {
  return (
    <span className={`${FONT_BAR_TIME} flex h-6 shrink-0 items-center whitespace-nowrap bg-[#3b3b3b] ${bare ? '' : 'gap-1.5 px-1.5'} ${tone}`}>
      {children}
    </span>
  )
}
