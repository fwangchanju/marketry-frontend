import { useId } from 'react'
import marketryLogo from '@/assets/marketry-logo.png'
import marketryWordmarkWhite from '@/assets/marketry-wordmark-white.png'

interface Props {
  className?: string
  layout?: 'horizontal' | 'stacked' | 'horizontalClean'
}

// 원본 PNG는 보관하고 슬로건 영역만 가린다. SVG 텍스트가 로고와 같은 비율로 확대·축소된다.
// 슬로건 색은 로고의 MARKETRY 글자(원본 PNG의 약 var(--ui-white))와 같게 맞춘다.
// horizontalClean·stacked의 MARKETRY 글자는 원본 PNG의 회색 외곽선을 걷어낸 흰색 이미지(marketry-wordmark-white.png, 원본의 510·25 위치 1170×190 영역)를 쓴다.
// 예전에는 SVG 필터로 그 자리에서 만들었는데 일부 폰 브라우저에서 글자가 사라져, 미리 만든 이미지로 바꿨다(필터 없음).
export default function MarketryLogo({ className, layout = 'horizontal' }: Props) {
  const clipId = useId()

  if (layout === 'stacked') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 1200 850" width={1200} height={850} className={`block ${className ?? ''}`}>
        <svg x={303} y={0} width={594} height={561.6} viewBox="0 0 425 400">
          <image href={marketryLogo} width={1681} height={400} />
        </svg>
        <image href={marketryWordmarkWhite} x={209.95} y={595} width={780.1} height={126.684} />
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
          <image href={marketryLogo} width={1681} height={400} />
        </svg>
        <image href={marketryWordmarkWhite} x={495} y={47.5} width={1117.5} height={181.5} />
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
