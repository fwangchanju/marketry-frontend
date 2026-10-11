import { useId } from 'react'
import marketryLogo from '@/assets/marketry-logo.png'

interface Props {
  className?: string
}

// 원본 PNG는 보관하고 슬로건 영역만 가린다. SVG 텍스트가 로고와 같은 비율로 확대·축소된다.
// 슬로건 색은 로고의 MARKETRY 글자(원본 PNG의 약 #fdfdfd)와 같게 맞춘다.
export default function MarketryLogo({ className }: Props) {
  const clipId = useId()

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
        fill="#fdfdfd"
        className="font-roboto-latin"
      >
        Design Your Market
      </text>
    </svg>
  )
}
