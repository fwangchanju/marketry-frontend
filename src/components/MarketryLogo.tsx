import { useId } from 'react'
import marketryLogo from '@/assets/marketry-logo.png'

interface Props {
  className?: string
  layout?: 'horizontal' | 'stacked'
}

// 원본 PNG는 보관하고 슬로건 영역만 가린다. SVG 텍스트가 로고와 같은 비율로 확대·축소된다.
// 슬로건 색은 로고의 MARKETRY 글자(원본 PNG의 약 var(--ui-white))와 같게 맞춘다.
export default function MarketryLogo({ className, layout = 'horizontal' }: Props) {
  const clipId = useId()
  const wordmarkFilterId = `${clipId}-white-wordmark`

  if (layout === 'stacked') {
    return (
      <svg aria-hidden="true" focusable="false" viewBox="0 0 1200 850" width={1200} height={850} className={`block ${className ?? ''}`}>
        <defs>
          <filter id={wordmarkFilterId} colorInterpolationFilters="sRGB">
            {/* 밝은 글자 내부만 남기고 원본 PNG의 어두운 회색 외곽선을 투명하게 만든다. */}
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.2126 0.7152 0.0722 0 0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope={8} intercept={-6} />
            </feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>
        <svg x={303} y={0} width={594} height={561.6} viewBox="0 0 425 400">
          <image href={marketryLogo} width={1681} height={400} />
        </svg>
        <svg x={177.72} y={595} width={844.56} height={126.684} viewBox="510 25 1170 190">
          <image href={marketryLogo} width={1681} height={400} filter={`url(#${wordmarkFilterId})`} />
        </svg>
        <text x={600} y={733} textAnchor="middle" dominantBaseline="text-before-edge" fontSize={71.3} fontWeight={500} fill="var(--ui-white)" className="font-roboto-latin">
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
