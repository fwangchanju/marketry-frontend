import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ScreenshotIcon, MaximizeIcon, MinimizeIcon, RefreshIcon, SettingsIcon } from '@/components/icons/AppIcons'

interface Props {
  onRefresh: () => void | Promise<unknown>
  isRefreshing: boolean
  // 설정 창이 없는 화면(커스텀 종목·카테고리)은 둘 다 넘기지 않는다 — 그러면 설정 버튼도 그리지 않는다.
  onToggleSettings?: () => void
  isSettingsOpen?: boolean
  // 스크린샷으로 찍을 화면이 없는 페이지(홈)는 둘 다 넘기지 않는다 — 그러면 스크린샷 버튼도 그리지 않는다.
  onOpenShare?: () => void
  isScreenshotOpen?: boolean
  isNativeFullscreen: boolean
  onToggleFullscreen: () => void
  // false면 새로고침 버튼을 이 묶음에서 뺀다 — 콘솔 줄(시계 옆)에 PageRefreshButton으로 따로 둘 때.
  showRefresh?: boolean
}

const BUTTON_BASE_CLASS =
  'flex h-7 items-center justify-center border-0 outline-none hover:text-[var(--accent)] focus-visible:text-[var(--accent)]'
// 아이콘만 있는 버튼의 회색 채움 — 시간 글자가 붙은 새로고침 버튼은 채우지 않는다.
// 아이콘만 있는 버튼은 평소·마우스를 올릴 때·켜져 있을 때 모두 틀 없이 아이콘만 보인다(켜진 상태는 아이콘 색과 안쪽 채움으로 알린다).
// 위의 프로필 사진과 아래 설정창 사이에서 위·아래 간격이 같도록(각각 14px) 3.5px 아래로 내린다.
const ICON_FRAME_CLASS = 'relative top-[3.5px] bg-transparent'
// 폭 28px — 18px 아이콘 사이가 10px이고(스크린샷·설정은 그림 안쪽 여백이 커서 20px로 그려 눈에 보이는 크기를 맞춘다) 설정창 저장·되돌리기 아이콘과 크기·간격이 같다. 묶음의 간격은 NavSubBar가 0으로 둔다.
const BUTTON_CLASS = `${BUTTON_BASE_CLASS} w-7`
// 툴바 칩 안의 새로고침 칸 — 칩(24px) 안에서 사방 1px씩 띄워 22px 높이에 폭은 18px로 좁혀 세로로 긴 직사각형이고, 평소엔 배경 없이 아이콘이 청록(--brand)이고, 올리면 글자색은 그대로 두고 다른 칩과 같은 밝은 회색(#838385) 면만 깔린다.
const CELL_CLASS = 'm-px flex h-[22px] w-[18px] items-center justify-center border-0 bg-transparent text-[var(--brand)] outline-none transition-colors hover:bg-[#838385] focus-visible:bg-[#838385]'
// 시각 칩(시계 + 시각 글자) 하나가 새로고침 버튼이다 — 호버 면(#838385)이 칩 전체에 깔린다.
const CELL_TIME_CLASS = 'flex h-6 shrink-0 items-center gap-1.5 bg-transparent px-1.5 text-inherit transition-colors hover:bg-[#838385]'
// 켜진 상태의 아이콘은 선 색(청록)을 35% 투명하게 안쪽에 채운다 — 북마크가 켜진 모양.
export const FILLED_ICON_CLASS = 'fill-current/35'

// 스냅샷 수집 주기 안내 — 새로고침 버튼에 커서를 올리거나 포커스하면 보여준다.
export const SNAPSHOT_REFRESH_HELP = '5분 간격으로 데이터를 수집합니다.\n수집 후 배포까지 1분 가량 지연이 있을 수 있습니다.'

// 스냅샷 새로고침 아이콘 버튼 — 상단바 우측 묶음(NavBarPageActions)과 콘솔 줄(시계 옆) 어디에 두든 같은 모양이다.
// helpText를 주면 버튼에 data-hint로 달려, 커서를 올리거나 키보드로 오면 공용 툴팁(HoverHintLayer)이 뜬다.
// 누르면 새로고침만 실행한다.
// cell을 주면 툴바 시각 칩 안의 한 구간(18×22px 세로 직사각형, 배경 없이 청록 아이콘)으로 그린다. children을 함께 주면(시계·시각) 칩 전체가 버튼이 되어, 커서를 올릴 때 글자 자리에 아이콘이 나타난다.
export function PageRefreshButton({
  onRefresh,
  isRefreshing,
  className = '',
  helpText,
  cell = false,
  children,
  minSpinDurationMs = 0,
}: {
  onRefresh: () => void | Promise<unknown>
  isRefreshing: boolean
  className?: string
  helpText?: string
  cell?: boolean
  // cell과 함께 주면 새로고침 아이콘 칸 앞에 이 내용(예: 시계와 시각)을 따로 둔다 — 두 구역이 각자 호버 면을 가지지만 새로고침은 아이콘 칸만 한다.
  children?: ReactNode
  minSpinDurationMs?: number
}) {
  const [isSpinFeedbackActive, setIsSpinFeedbackActive] = useState(false)
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showRefreshing = isRefreshing || isSpinFeedbackActive

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

  // disabled를 쓰지 않는다 — 비활성 버튼은 브라우저가 마우스 이벤트를 주지 않아 설명창이 안 사라질 수 있고,
  // 비활성 기본 스타일이 색을 덮는다. 대신 갱신 중에는 클릭만 무시하고 강조 색과 회전으로 상태를 보여준다.
  return (
    <span className="inline-flex shrink-0">
      {cell && children ? (
        // 시각 칩 전체가 새로고침 버튼이다 — 평소에는 시계·시각 글자가 보이고, 커서를 올리거나 키보드 포커스가 오면 글자가 사라진 자리(칩 한가운데, 시 분 사이 콜론 자리)에
        // 청록 새로고침 아이콘이 나타난다. 갱신하는 동안에는 글자 대신 아이콘이 돌아간다. 자리를 글자가 계속 차지(invisible)해서 칩 폭은 변하지 않는다.
        <button
          type="button"
          aria-label="스냅샷 새로고침"
          aria-busy={showRefreshing}
          data-hint={helpText}
          className={`${CELL_TIME_CLASS} group/refresh relative cursor-pointer border-0 outline-none focus-visible:bg-[#838385] ${showRefreshing ? 'cursor-default' : ''} nav-refresh-button ${className}`}
          onClick={handleRefresh}
        >
          <span aria-hidden={showRefreshing || undefined} className={`flex items-center gap-1.5 ${showRefreshing ? 'invisible' : 'group-hover/refresh:invisible group-focus-visible/refresh:invisible'}`}>{children}</span>
          <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center text-[var(--brand)] ${showRefreshing ? '' : 'invisible group-hover/refresh:visible group-focus-visible/refresh:visible'}`}>
            <RefreshIcon aria-hidden="true" className={`h-[15px] w-[15px] shrink-0 ${showRefreshing ? 'animate-spin' : ''}`} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          aria-label="스냅샷 새로고침"
          aria-busy={showRefreshing}
          data-hint={helpText}
          className={`${cell ? CELL_CLASS : `${BUTTON_BASE_CLASS} ${ICON_FRAME_CLASS} w-7 ${showRefreshing ? 'text-[var(--accent)]' : 'text-gray-300'}`} nav-refresh-button shrink-0 ${showRefreshing ? 'cursor-default' : ''} ${className}`}
          onClick={handleRefresh}
        >
          <RefreshIcon aria-hidden="true" className={`${cell ? 'h-[15px] w-[15px]' : 'h-4 w-4'} shrink-0 ${showRefreshing ? 'animate-spin' : ''}`} />
        </button>
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
  isScreenshotOpen = false,
  isNativeFullscreen,
  onToggleFullscreen,
  showRefresh = true,
}: Props) {
  return (
    <>
      {showRefresh && <PageRefreshButton onRefresh={onRefresh} isRefreshing={isRefreshing} />}
      {onOpenShare && <button
        type="button"
        aria-label="스크린샷"
        data-hint="스크린샷 찍기"
        aria-haspopup="dialog"
        aria-expanded={isScreenshotOpen}
        className={`flex h-7 w-7 items-center justify-center border-0 outline-none hover:text-[var(--brand)] focus-visible:text-[var(--brand)] ${ICON_FRAME_CLASS} ${isScreenshotOpen ? 'text-[var(--brand)]' : 'text-gray-300'}`}
        onClick={onOpenShare}
      >
        <ScreenshotIcon className={`h-6 w-6 ${isScreenshotOpen ? FILLED_ICON_CLASS : ''}`} />
      </button>}
      <button
        type="button"
        aria-label="F11"
        data-hint={isNativeFullscreen ? '전체 화면 끄기 (F11)' : '전체 화면 켜기 (F11)'}
        className={`flex h-7 w-7 items-center justify-center border-0 outline-none hover:text-[var(--accent)] ${ICON_FRAME_CLASS} ${
          isNativeFullscreen ? 'text-[var(--accent)]' : 'text-gray-300'
        }`}
        onClick={onToggleFullscreen}
      >
        {isNativeFullscreen ? <MinimizeIcon className="h-[18px] w-[18px]" /> : <MaximizeIcon className="h-[18px] w-[18px]" />}
      </button>
      {onToggleSettings && (
        <button
          type="button"
          aria-label="설정"
          data-hint={isSettingsOpen ? '설정창 닫기' : '설정창 열기'}
          data-settings-toggle
          className={`${BUTTON_CLASS} ${ICON_FRAME_CLASS} ${isSettingsOpen ? 'text-[var(--accent)]' : 'text-gray-300'}`}
          onClick={onToggleSettings}
        >
          <SettingsIcon className={`h-5 w-5 ${isSettingsOpen ? FILLED_ICON_CLASS : ''}`} />
        </button>
      )}
    </>
  )
}
