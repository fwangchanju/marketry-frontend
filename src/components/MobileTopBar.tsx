import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import MarketryLogo from '@/components/MarketryLogo'

// 모든 MOBILE 화면(지도 세 페이지·INFO 글 페이지·종목 차트·모바일 홈)이 함께 쓰는 상단 줄 — 한 가지 모양만 둔다.
// 52px 높이, 왼쪽 로고(누르면 홈), 가운데 지금 페이지 이름(누르기 기능 없음), 오른쪽 아이콘 자리(2026-11-27 사용자 결정).
// 예전의 "이름 + 꺽쇠"로 다음 페이지에 가던 버튼은 없앴다. 페이지는 밀어서 넘기고, INFO에서 나갈 때는 로고를 누른다.
export default function MobileTopBar({ title, right = null, className = '' }: { title: string; right?: ReactNode; className?: string }) {
  return (
    <header className={`relative z-20 flex h-[calc(52px+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-2 bg-ui-surface pl-4 pr-1 pt-[env(safe-area-inset-top)] ${className}`}>
      {/* 가운데 제목(영어 대문자: MAP·SECTOR·GRAPH·CHART·GUIDE 등, 가장 긴 CONTACT 약 80px. 업종 지도는 PC에서 SUMMARY지만 MOBILE은 지도만 있어 SECTOR — 2026-11-27 사용자 결정)과 겹치지 않게, 390px보다 좁은 화면에서는 로고만 조금 줄인다. */}
      <Link to="/" aria-label="MARKETRY 홈으로 이동" className="min-w-0 shrink-0">
        <MarketryLogo layout="horizontalMobile" className="h-auto w-[min(132px,calc(50vw-62px))] max-w-none" />
      </Link>
      {title && <h1 className="pointer-events-none absolute left-1/2 m-0 -translate-x-1/2 whitespace-nowrap text-[15px] font-bold leading-none tracking-[0.12em] text-brand">{title}</h1>}
      {right}
    </header>
  )
}
