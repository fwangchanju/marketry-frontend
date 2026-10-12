import type { CSSProperties } from 'react'
import compositionIcon from '@/assets/settings-icons/composition.png'
import colorsIcon from '@/assets/settings-icons/colors.svg'
import bookmarkIcon from '@/assets/settings-icons/bookmark.svg'
import industryIcon from '@/assets/settings-icons/industry.png'
import stockDisplayIcon from '@/assets/settings-icons/stock-display.svg'

export type SettingsSectionIconName = 'favorites' | 'composition' | 'industry' | 'stock-display' | 'colors'

interface SettingsSectionIconProps {
  icon: SettingsSectionIconName
  className?: string
}

const ICON_SOURCES: Record<SettingsSectionIconName, string> = {
  favorites: bookmarkIcon,
  composition: compositionIcon,
  industry: industryIcon,
  'stock-display': stockDisplayIcon,
  colors: colorsIcon,
}

// 아이콘 원본마다 선 굵기가 달라서, 화면에서 비슷한 굵기로 보이도록 아이콘별로 깎는 정도를 다르게 둔다.
const ICON_ERODE_RADIUS: Record<SettingsSectionIconName, number> = {
  favorites: 0.6,
  composition: 1.3,
  industry: 0.6,
  'stock-display': 0,
  colors: 0.6,
}

// 아이콘 원본마다 여백이 달라 같은 칸에서도 작아 보여서, 레이아웃은 그대로 두고 그리는 크기만 키운다.
const ICON_SCALE: Partial<Record<SettingsSectionIconName, number>> = {
  // 그림 원본의 실제 도형 크기가 종목 구성은 476px, 종목 박스는 416px라 476/416 ≈ 1.14배로 키워 두 아이콘의 사각형이 비슷하게 보이게 한다.
  'stock-display': 1.14,
}

export default function SettingsSectionIcon({ icon, className = '' }: SettingsSectionIconProps) {
  const filterId = `settings-icon-${icon}-light-stroke`
  const iconMask = `url("${ICON_SOURCES[icon]}")`
  const maskStyle: CSSProperties = {
    maskImage: iconMask,
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize: 'contain',
    WebkitMaskImage: iconMask,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
  }

  return (
    <>
      <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
        <filter id={filterId} colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="erode" radius={ICON_ERODE_RADIUS[icon]} result="thinner" />
          <feComposite in="SourceGraphic" in2="thinner" operator="in" />
        </filter>
      </svg>
      <span
        aria-hidden="true"
        className={`inline-block shrink-0 bg-current ${className || 'h-[30px] w-[30px]'}`}
        style={{ ...maskStyle, filter: `url(#${filterId})`, transform: `scale(${ICON_SCALE[icon] ?? 1})` }}
      />
    </>
  )
}
