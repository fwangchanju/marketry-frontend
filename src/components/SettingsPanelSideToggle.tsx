import { useLayoutEffect, useRef } from 'react'

const BASIS_TOP_ANCHOR = '[data-settings-side-toggle-top-anchor]'
const BASIS_BADGE_TOP_ANCHOR = '[data-settings-side-toggle-bottom-anchor]'
const FALLBACK_BOTTOM_GAP_PX = 66
const FALLBACK_HEIGHT_PX = 45

export default function SettingsPanelSideToggle({ isOnLeft, onToggleSide, panelName = '설정창' }: { isOnLeft: boolean; onToggleSide: () => void; panelName?: string }) {
  const moveLabel = isOnLeft ? `${panelName}을 오른쪽으로 이동` : `${panelName}을 왼쪽으로 이동`
  const buttonRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    const button = buttonRef.current
    const panel = button?.closest<HTMLElement>('[data-settings-panel-shell]')
    if (!button || !panel) return

    const align = () => {
      const panelBounds = panel.getBoundingClientRect()
      const topLine = panel.querySelector<HTMLElement>(BASIS_TOP_ANCHOR)?.getBoundingClientRect()
      const badgeTopLine = panel.querySelector<HTMLElement>(BASIS_BADGE_TOP_ANCHOR)?.getBoundingClientRect()

      if (topLine && badgeTopLine) {
        button.style.top = `${Math.round(topLine.top - panelBounds.top)}px`
        button.style.height = `${Math.max(1, Math.round(badgeTopLine.top - topLine.top))}px`
      } else {
        // Basis가 없는 패널은 Basis 기준선에 대응하는 높이·위치를 사용한다.
        button.style.top = `${Math.round(panelBounds.height - FALLBACK_BOTTOM_GAP_PX - FALLBACK_HEIGHT_PX)}px`
        button.style.height = `${FALLBACK_HEIGHT_PX}px`
      }
    }

    align()
    const observer = new ResizeObserver(align)
    observer.observe(panel)
    window.addEventListener('resize', align)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', align)
    }
  }, [])

  return (
    <button
      type="button"
      onClick={onToggleSide}
      aria-label={moveLabel}
      data-hint={moveLabel}
      ref={buttonRef}
      style={{ backgroundColor: 'var(--ui-panel)' }}
      className={`absolute z-10 flex h-[45px] w-[14px] items-center justify-center border border-ui-border p-0 text-ui-muted hover:text-brand focus-visible:text-brand ${
        isOnLeft ? '-right-[13px] rounded-r-lg border-l-0' : '-left-[13px] rounded-l-lg border-r-0'
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        <path
          d={isOnLeft ? 'M6 3.5 10.5 8 6 12.5' : 'M10 3.5 5.5 8 10 12.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
