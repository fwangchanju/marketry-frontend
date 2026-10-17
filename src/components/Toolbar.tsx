import type { ReactNode } from 'react'

// 툴바 — 메인 영역 맨 윗줄. 왼쪽에는 드롭다운·기준 날짜·기준 시각·거래 세션을, 오른쪽 끝에는 분류 배지를 둔다.
// 맵·그룹 페이지가 같은 모양을 쓰도록 바깥 틀만 여기서 정하고, 안에 들어갈 것은 각 페이지가 넣는다.
export default function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="relative mt-[5.25px] mb-[5.25px] flex h-7 w-full shrink-0 items-center justify-between bg-ui-background/70 pl-[7px] pr-[7px] text-sm font-bold text-ui-white">
      {children}
    </div>
  )
}
