import { useId } from 'react'
import marketryLogo from '@/assets/marketry-logo.png'
// 세로형·가로형(깨끗한)이 쓰는 건 그림 왼쪽 425×400(나무)뿐이라 그 부분만 잘라 둔 파일을 쓴다. 글자는 아래에서 따로 그린다.
// 파일은 289×272(425×400과 같은 비율)로 줄여 두었고 아래 <image>의 425×400은 SVG 좌표라 그대로 늘려 그린다. 가장 크게 쓰는 곳(스피너·홈 로고)도 화면에서 약 120px 이하다.
import marketrySymbol from '@/assets/marketry-symbol.webp'
import { MARKETRY_WORDMARK_PATH, MARKETRY_WORDMARK_WIDTH } from '@/components/marketryWordmarkPath'

interface Props {
  className?: string
  layout?: 'horizontal' | 'stacked' | 'horizontalClean'
}

// 원본 PNG는 보관하고 슬로건 영역만 가린다. SVG 텍스트가 로고와 같은 비율로 확대·축소된다.
// 슬로건 색은 로고의 MARKETRY 글자(원본 PNG의 약 var(--ui-white))와 같게 맞춘다.
// horizontalClean·stacked의 MARKETRY 글자는 원본 PNG의 회색 외곽선을 걷어낸 흰색 글자의 윤곽을 벡터 경로로 만든 것(marketryWordmarkPath.ts, 원본의 510·25 위치 1170×190 영역)을 쓴다.
// 예전에는 SVG 필터로 그 자리에서 만들었는데 일부 폰 브라우저에서 글자가 사라졌고, 흰색 PNG 이미지로 바꾼 뒤에도 폰이 이미지를 회색으로 어둡게 보여서, 옆의 슬로건 글자처럼 벡터로 그린다(필터·이미지 없음).
export default function MarketryLogo({ className, layout = 'horizontal' }: Props) {
  const clipId = useId()

  if (layout === 'stacked') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 1200 850" width={1200} height={850} className={`block ${className ?? ''}`}>
        <svg x={303} y={0} width={594} height={561.6} viewBox="0 0 425 400">
          <image href={marketrySymbol} width={425} height={400} />
        </svg>
        <g transform={`translate(209.95 595) scale(${780.1 / MARKETRY_WORDMARK_WIDTH})`}>
          <path d={MARKETRY_WORDMARK_PATH} fill="var(--ui-white)" fillRule="evenodd" />
        </g>
        <text x={600} y={733} textAnchor="middle" dominantBaseline="text-before-edge" fontSize={71.3} fontWeight={500} fill="var(--ui-white)" className="font-roboto-latin">
          Design Your Market
        </text>
      </svg>
    )
  }

  if (layout === 'horizontalClean') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 2025 400" width={2025} height={400} className={`block ${className ?? ''}`}>
        <svg x={0} y={0} width={425} height={400} viewBox="0 0 425 400">
          <image href={marketrySymbol} width={425} height={400} />
        </svg>
        <g transform={`translate(495 47.5) scale(${1117.5 / MARKETRY_WORDMARK_WIDTH})`}>
          <path d={MARKETRY_WORDMARK_PATH} fill="var(--ui-white)" fillRule="evenodd" />
        </g>
        <text x={495} y={242.5} dominantBaseline="text-before-edge" fontSize={110} fontWeight={500} fill="var(--ui-white)" className="font-roboto-latin">
          Design Your Market
        </text>
      </svg>
    )
  }

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1681 400"
      width={1681}
      height={400}
      className={`block ${className ?? ''}`}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="objectBoundingBox">
          <polygon points="0,0 1,0 1,0.56 0.27,0.56 0.27,1 0,1" />
        </clipPath>
      </defs>
      <image href={marketryLogo} width={1681} height={400} clipPath={`url(#${clipId})`} />
      <text
        x="30.5%"
        y="60%"
        dominantBaseline="text-before-edge"
        fontSize={117.36}
        fontWeight={500}
        fill="var(--ui-white)"
        className="font-roboto-latin"
      >
        Design Your Market
      </text>
    </svg>
  )
}
