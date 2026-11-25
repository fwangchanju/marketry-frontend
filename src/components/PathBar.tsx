import { ReturnArrowIcon } from '@/components/icons/AppIcons'

export interface PathCrumb {
  key: string
  label: string
  // 있으면 눌러서 돌아가는 버튼, 없으면 현재 위치(마지막) 또는 정적 이름(캡처 화면).
  onClick?: () => void
  // PC 버튼에 붙는 안내 문구.
  hint?: string
  // 마지막 현재 위치 — 강조색으로 그린다.
  current?: boolean
}

const INLINE_LINK_CLASS = 'flex h-full cursor-pointer items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-lg leading-none font-bold text-ui-white transition-colors hover:bg-ui-white/35'
const MOBILE_LINK_CLASS = 'flex h-full shrink-0 items-center gap-1.5 border-0 bg-transparent pl-2 pr-1.5 text-ui-white active:bg-ui-white/15'

// 종목·업종 지도, 차트, MOBILE 그래프가 함께 쓰는 상단 경로 줄. 맨 앞의 4px 흰 막대도 여기서 그린다.
// variant만 바꿔서 PC(마우스 올림)와 MOBILE(누름) 양식을 쓰고, zoom·가로 이동 래퍼는 화면 배치에 따라 호출부에 둔다.
export default function PathBar({
  crumbs,
  variant = 'inline',
  ariaLabel = '업종 이동 경로',
  currentAria,
  accentColor,
}: {
  crumbs: PathCrumb[]
  variant?: 'inline' | 'mobile'
  ariaLabel?: string
  currentAria?: 'page' | 'location'
  accentColor?: string
}) {
  const mobile = variant === 'mobile'
  // MOBILE에서 경로가 한 칸뿐이면 '현재 위치'가 아니라 market 이름이므로 흰색으로 둔다.
  const singleCurrent = mobile && crumbs.length === 1
  return (
    <nav
      aria-label={ariaLabel}
      className={mobile
        ? 'flex h-[32px] items-center overflow-x-auto whitespace-nowrap text-[16px] leading-none font-bold'
        : 'flex h-7 w-full shrink-0 items-center truncate bg-ui-background/70 text-lg leading-none font-bold'}
    >
      <span aria-hidden="true" className="h-4 w-[4px] shrink-0 bg-ui-white" />
      {crumbs.map(crumb => {
        const backIcon = <ReturnArrowIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
        if (crumb.current) {
          return (
            <span
              key={crumb.key}
              aria-current={currentAria}
              className={`${mobile ? 'shrink-0 ' : ''}px-2 ${singleCurrent ? 'text-ui-white' : 'text-[var(--accent)]'}`}
              style={!singleCurrent && accentColor ? { color: accentColor } : undefined}
            >
              {crumb.label}
            </span>
          )
        }
        if (crumb.onClick) {
          return (
            <button
              key={crumb.key}
              type="button"
              data-hint={crumb.hint}
              onClick={crumb.onClick}
              style={mobile ? { fontFamily: 'inherit', fontWeight: 'inherit' } : { fontFamily: 'inherit' }}
              className={mobile ? MOBILE_LINK_CLASS : INLINE_LINK_CLASS}
            >
              {crumb.label}
              {backIcon}
            </button>
          )
        }
        return <span key={crumb.key} className={INLINE_LINK_CLASS}>{crumb.label}{backIcon}</span>
      })}
    </nav>
  )
}
