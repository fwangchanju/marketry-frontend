import type { ReactNode } from 'react'
import type { MarketFlag } from '@/utils/marketFlag'

// 국기 그림은 country-flag-icons 1.5.21(3x2, MIT License, Copyright (c) 2020 @catamphetamine)에서 가져왔다.
// 전문은 src/components/MarketFlagIcon.LICENSE.txt에 둔다. 그림을 바꾸면 그 파일의 버전 표기도 함께 고친다.
const FLAG_ARTWORK: Record<MarketFlag, { label: string; viewBox: string; body: ReactNode }> = {
  KR: {
    label: '대한민국 국기',
    viewBox: '0 0 900 600',
    body: (
      <>
        <path fill="#FFF" d="M0 0h900v600H0z" />
        <g transform="rotate(-56.31)">
          <g stroke="#000" strokeWidth="25">
            <path d="M-75 228.3H75m-150 37.5H75m-150 37.5H75M-75 778.3H75m-150 37.5H75m-150 37.5H75" />
          </g>
          <path stroke="#FFF" strokeWidth="12.5" d="M0 753.3v125" />
          <circle fill="#ca163a" cy="540.8" r="150" />
          <path fill="#0e4896" d="M0 390.8c-41.4 0-75 33.6-75 75s33.6 75 75 75 75 33.6 75 75-33.6 75-75 75c-82.8 0-150-67.2-150-150s67.2-150 150-150z" />
        </g>
        <g stroke="#000" strokeWidth="25">
          <path d="m231.56 535.73-83.205-124.808M262.76 514.928l-83.205-124.807m114.407 104.006-83.205-124.808M689.187 230.644l-83.205-124.807M720.39 209.843 637.184 85.036m114.407 104.006L668.386 64.234" />
        </g>
        <path stroke="#FFF" strokeWidth="12.5" d="m205.6 462.897 31.202-20.8m389.981-259.989 36.444-24.296m31.202-20.801 31.202-20.801" />
      </>
    ),
  },
  JP: {
    label: '일본 국기',
    viewBox: '0 0 513 342',
    body: (
      <>
        <path fill="#FFF" d="M0 0h512v342H0z" />
        <circle fill="#D80027" cx="256.5" cy="171" r="96" />
      </>
    ),
  },
  US: {
    label: '미국 국기',
    viewBox: '0 0 513 342',
    body: (
      <>
        <path fill="#FFF" d="M0 0h513v342H0z" />
        <g fill="#D80027">
          <path d="M0 0h513v26.3H0zM0 52.6h513v26.3H0zM0 105.2h513v26.3H0zM0 157.8h513v26.3H0zM0 210.5h513v26.3H0zM0 263.1h513v26.3H0zM0 315.7h513V342H0z" />
        </g>
        <path fill="#2E52B2" d="M0 0h256.5v184.1H0z" />
        <g fill="#FFF">
          <path d="m47.8 138.9-4-12.8-4.4 12.8H26.2l10.7 7.7-4 12.8 10.9-7.9 10.6 7.9-4.1-12.8 10.9-7.7zM104.1 138.9l-4.1-12.8-4.2 12.8H82.6l10.7 7.7-4 12.8 10.7-7.9 10.8 7.9-4-12.8 10.7-7.7zM160.6 138.9l-4.3-12.8-4 12.8h-13.5l11 7.7-4.2 12.8 10.7-7.9 11 7.9-4.2-12.8 10.7-7.7zM216.8 138.9l-4-12.8-4.2 12.8h-13.3l10.8 7.7-4 12.8 10.7-7.9 10.8 7.9-4.3-12.8 11-7.7zM100 75.3l-4.2 12.8H82.6L93.3 96l-4 12.6 10.7-7.8 10.8 7.8-4-12.6 10.7-7.9h-13.4zM43.8 75.3l-4.4 12.8H26.2L36.9 96l-4 12.6 10.9-7.8 10.6 7.8L50.3 96l10.9-7.9H47.8zM156.3 75.3l-4 12.8h-13.5l11 7.9-4.2 12.6 10.7-7.8 11 7.8-4.2-12.6 10.7-7.9h-13.2zM212.8 75.3l-4.2 12.8h-13.3l10.8 7.9-4 12.6 10.7-7.8 10.8 7.8-4.3-12.6 11-7.9h-13.5zM43.8 24.7l-4.4 12.6H26.2l10.7 7.9-4 12.7L43.8 50l10.6 7.9-4.1-12.7 10.9-7.9H47.8zM100 24.7l-4.2 12.6H82.6l10.7 7.9-4 12.7L100 50l10.8 7.9-4-12.7 10.7-7.9h-13.4zM156.3 24.7l-4 12.6h-13.5l11 7.9-4.2 12.7 10.7-7.9 11 7.9-4.2-12.7 10.7-7.9h-13.2zM212.8 24.7l-4.2 12.6h-13.3l10.8 7.9-4 12.7 10.7-7.9 10.8 7.9-4.3-12.7 11-7.9h-13.5z" />
        </g>
      </>
    ),
  },
}

// 높이는 메인 툴바 배지와 같은 26.25px(1.5rem + 2.25px)이고 너비는 3:2 비율(39.38px)로 따라온다.
// 외곽선은 두지 않는다(2026-11-27 사용자 결정 — 어두운 배경이라 흰 바탕 국기(한국·일본)도 묻히지 않는다).
export default function MarketFlagIcon({ flag, className = '' }: { flag: MarketFlag; className?: string }) {
  const artwork = FLAG_ARTWORK[flag]
  return (
    <span role="img" aria-label={artwork.label} className={`inline-flex h-[26.25px] aspect-[3/2] shrink-0 overflow-hidden ${className}`}>
      <svg viewBox={artwork.viewBox} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true" focusable="false">
        {artwork.body}
      </svg>
    </span>
  )
}
