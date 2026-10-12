import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { CaptureIcon, MaximizeIcon, MinimizeIcon, RefreshIcon, SettingsIcon } from '@/components/icons/MarketMapIcons'
import { HINT_BUBBLE_CLASS } from '@/components/hintBubbleStyle'

interface Props {
  onRefresh: () => void | Promise<unknown>
  isRefreshing: boolean
  // 설정 창이 없는 화면(커스텀 종목·카테고리)은 둘 다 넘기지 않는다 — 그러면 설정 버튼도 그리지 않는다.
  onToggleSettings?: () => void
  isSettingsOpen?: boolean
  // 캡처할 화면이 없는 페이지(홈)는 둘 다 넘기지 않는다 — 그러면 캡처 버튼도 그리지 않는다.
  onOpenShare?: () => void
  isCaptureOpen?: boolean
  isNativeFullscreen: boolean
  onToggleFullscreen: () => void
  // false면 새로고침 버튼을 이 묶음에서 뺀다 — 콘솔 줄(시계 옆)에 PageRefreshButton으로 따로 둘 때.
  showRefresh?: boolean
}

const BUTTON_BASE_CLASS =
  'flex h-7 items-center justify-center border-0 outline-none hover:text-[var(--accent)] focus-visible:text-[var(--accent)]'
// 아이콘만 있는 버튼의 회색 채움 — 시간 글자가 붙은 새로고침 버튼은 채우지 않는다.
const ICON_FILL_CLASS = 'rounded-lg bg-zinc-600 transition-colors hover:bg-zinc-500'
const BUTTON_CLASS = `${BUTTON_BASE_CLASS} ${ICON_FILL_CLASS} w-7`
// 켜진 상태의 아이콘은 선 색(청록)을 35% 투명하게 안쪽에 채운다 — 북마크가 켜진 모양.
export const FILLED_ICON_CLASS = 'fill-current/35'

// 스냅샷 수집 주기 안내 — 새로고침 버튼에 커서를 올리거나 포커스하면 보여준다.
export const SNAPSHOT_REFRESH_HELP = '5분 간격으로 데이터를 수집합니다.\n수집 후 배포까지 1분 가량 지연이 있을 수 있습니다.'

// 스냅샷 새로고침 아이콘 버튼 — 상단바 우측 묶음(NavBarPageActions)과 콘솔 줄(시계 옆) 어디에 두든 같은 모양이다.
// helpText를 주면 커서를 올리거나 포커스하면 설명창(지도 설정의 도움말 팝업과 같은 모양·글자 크기/굵기)을 버튼 아래에 띄운다.
// 누르면 새로고침만 실행한다.
// children을 주면 평소에는 텍스트를 보여주고, 호버·키보드 포커스 시 아이콘으로 대체하며 갱신 중에는 회전한다.
export function PageRefreshButton({
  onRefresh,
  isRefreshing,
  className = '',
  helpText,
  children,
  minSpinDurationMs = 0,
}: {
  onRefresh: () => void | Promise<unknown>
  isRefreshing: boolean
  className?: string
  helpText?: ReactNode
  children?: ReactNode
  minSpinDurationMs?: number
}) {
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [isSpinFeedbackActive, setIsSpinFeedbackActive] = useState(false)
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showRefreshing = isRefreshing || isSpinFeedbackActive
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ left: 8, top: 8 })

  useEffect(() => () => {
    if (spinTimerRef.current !== null) clearTimeout(spinTimerRef.current)
  }, [])

  const handleRefresh = () => {
    if (showRefreshing) return
    // 데이터 요청은 즉시 실행하고, 회전 피드백만 최소 시간 동안 유지한다.
    if (minSpinDurationMs > 0) {
      setIsSpinFeedbackActive(true)
      spinTimerRef.current = setTimeout(() => {
        spinTimerRef.current = null
        setIsSpinFeedbackActive(false)
      }, minSpinDurationMs)
    }
    void onRefresh()
  }

  // 설정창 도움말 팝업과 같은 배치 — 버튼 아래(4px)에 붙이고, 화면 밖으로 나가면 안쪽으로 밀거나 위로 뒤집는다.
  useLayoutEffect(() => {
    if (!isHelpOpen) return
    const updatePosition = () => {
      const anchor = buttonRef.current?.getBoundingClientRect()
      const tooltip = tooltipRef.current?.getBoundingClientRect()
      if (!anchor || !tooltip) return
      const margin = 8
      const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - tooltip.width - margin))
      let top = anchor.bottom + 4
      if (top + tooltip.height > window.innerHeight - margin) {
        const above = anchor.top - tooltip.height - 4
        top = above >= margin ? above : Math.max(margin, window.innerHeight - tooltip.height - margin)
      }
      setTooltipPosition({ left, top })
    }
    updatePosition()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHelpOpen(false)
    }
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isHelpOpen])

  // disabled를 쓰지 않는다 — 비활성 버튼은 브라우저가 마우스 이벤트를 주지 않아 설명창이 안 사라질 수 있고,
  // 비활성 기본 스타일이 색을 덮는다. 대신 갱신 중에는 클릭만 무시하고 강조 색과 회전으로 상태를 보여준다.
  return (
    <span
      className="inline-flex shrink-0"
      onPointerEnter={helpText ? () => setIsHelpOpen(true) : undefined}
      onPointerLeave={helpText ? () => setIsHelpOpen(false) : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-label="스냅샷 새로고침"
        aria-busy={showRefreshing}
        aria-describedby={helpText && isHelpOpen ? 'snapshot-refresh-help' : undefined}
        className={`${BUTTON_BASE_CLASS} ${children ? 'group/refresh gap-1.5 whitespace-nowrap bg-transparent' : `${ICON_FILL_CLASS} w-7`} nav-refresh-button shrink-0 ${showRefreshing ? 'cursor-default text-[var(--accent)]' : 'text-gray-200'} ${className}`}
        onClick={handleRefresh}
        onFocus={helpText ? () => setIsHelpOpen(true) : undefined}
        onBlur={helpText ? () => setIsHelpOpen(false) : undefined}
      >
        {children ? (
          <span className="relative inline-flex items-center justify-center">
            <span aria-hidden={showRefreshing || undefined} className={showRefreshing ? 'invisible' : 'group-hover/refresh:invisible group-focus-visible/refresh:invisible'}>{children}</span>
            <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center ${showRefreshing ? '' : 'invisible group-hover/refresh:visible group-focus-visible/refresh:visible'}`}>
              <RefreshIcon className={`h-[15px] w-[15px] shrink-0 ${showRefreshing ? 'animate-spin' : ''}`} />
            </span>
          </span>
        ) : (
          <RefreshIcon aria-hidden="true" className={`h-4 w-4 shrink-0 ${showRefreshing ? 'animate-spin' : ''}`} />
        )}
      </button>
      {helpText && isHelpOpen && (
        <span
          id="snapshot-refresh-help"
          ref={tooltipRef}
          role="tooltip"
          style={{ position: 'fixed', left: tooltipPosition.left, top: tooltipPosition.top }}
          className={`z-50 w-max max-w-80 whitespace-pre-line font-normal ${HINT_BUBBLE_CLASS}`}
        >
          {helpText}
        </span>
      )}
    </span>
  )
}

// NavSubBar 우측에 들어가는 공용 액션 버튼 — 지도/커스텀/요약/섹터 페이지가 전부 동일하게 쓴다.
// 설정 토글/공유 열기/풀스크린 토글은 페이지마다 다른 상태에 붙어있어 콜백으로 받는다.
export default function NavBarPageActions({
  onRefresh,
  isRefreshing,
  onToggleSettings,
  isSettingsOpen = false,
  onOpenShare,
  isCaptureOpen = false,
  isNativeFullscreen,
  onToggleFullscreen,
  showRefresh = true,
}: Props) {
  return (
    <>
      {showRefresh && <PageRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />}
      {onOpenShare && <button
        type="button"
        aria-label="캡처"
        aria-haspopup="dialog"
        aria-expanded={isCaptureOpen}
        className={`flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-zinc-600 outline-none transition-colors hover:bg-zinc-500 hover:text-[var(--brand)] focus-visible:text-[var(--brand)] ${isCaptureOpen ? 'text-[var(--brand)]' : 'text-gray-200'}`}
        onClick={onOpenShare}
      >
        <CaptureIcon className={`h-4 w-4 ${isCaptureOpen ? FILLED_ICON_CLASS : ''}`} />
      </button>}
      <button
        type="button"
        aria-label="F11"
        className={`flex h-7 w-7 items-center justify-center rounded-lg border-0 bg-zinc-600 outline-none transition-colors hover:bg-zinc-500 hover:text-[var(--accent)] ${
          isNativeFullscreen ? 'text-[var(--accent)]' : 'text-gray-200'
        }`}
        onClick={onToggleFullscreen}
      >
        {isNativeFullscreen ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
      </button>
      {onToggleSettings && (
        <button
          type="button"
          aria-label="설정"
          data-settings-toggle
          className={`${BUTTON_CLASS} ${isSettingsOpen ? 'text-[var(--accent)]' : 'text-gray-200'}`}
          onClick={onToggleSettings}
        >
          <SettingsIcon className={`h-4 w-4 ${isSettingsOpen ? FILLED_ICON_CLASS : ''}`} />
        </button>
      )}
    </>
  )
}
