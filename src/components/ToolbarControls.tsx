import { useEffect, useRef, useState } from 'react'
import type { ChangeRateChoice } from '@/api/heatmap'
import { accentColor } from '@/utils/accentPalette'
import { type TradingSession } from '@/utils/tradingWindow'
import { useTradingSession } from '@/hooks/useTradingSession'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import ToolbarChip from '@/components/ToolbarChip'
import ToolbarPopup from '@/components/ToolbarPopup'
import PopupHeader, { PopupListDot } from '@/components/PopupHeader'
import { POPUP_ROW_IDLE_CLASS, POPUP_ROW_SELECTED_CLASS } from '@/components/popupHeaderStyle'
import { dropdownPanelClass } from '@/components/dropdownStyle'
import { useMobileToolbar } from '@/components/MobileToolbarContext'
import { SessionGuideTable } from '@/components/MarketSessionChip'
import { useTouchSlideSelect } from '@/hooks/useTouchSlideSelect'

// 시간대 표시 점의 색 — 프리 마켓은 서브 옐로, 메인 마켓은 메인 청록,
// 애프터 마켓은 서브 퍼플, 마켓 종료은 연회색이다(애프터 색은 종가·합산·별도 토글의 선택 칸에도 쓴다).
const SESSION_DOT_COLOR: Record<TradingSession, string> = {
  '프리 마켓': 'var(--sub-yellow)',
  '메인 마켓': 'var(--brand)',
  '애프터 마켓': 'var(--sub-purple)',
  '마켓 종료': accentColor('연회색'),
}

// 지도·그래프 페이지가 같은 시간대 문구와 강조 색상을 사용한다.
// session을 주면 지금 시간대 대신 그 시간대를 보여준다(종가 지도를 보는 동안은 "마켓 종료").
export function TradingSessionIndicator({ session: sessionOverride }: { session?: TradingSession }) {
  const currentSession = useTradingSession()
  const session = sessionOverride ?? currentSession
  return (
    <span className={`${FONT_BAR_TIME} flex items-center text-ui-white`}>
      <span aria-hidden="true" className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[session] }} />
      <span>{session}</span>
    </span>
  )
}

// 시간대 안내 팝업의 고정 내용 — 서버 시간표나 지금 시간대와 연동하지 않는 안내문이다(칩의 시간대 판정과는 별개).
const SESSION_GUIDE: { session: TradingSession; range: string }[] = [
  { session: '프리 마켓', range: '08:00~08:50' },
  { session: '메인 마켓', range: '09:00~15:30' },
  { session: '애프터 마켓', range: '15:40~20:00' },
  { session: '마켓 종료', range: '그 외' },
]

// 시장 시간대 칩 — 눌러서 시간대별 시간 범위를 안내하는 팝업을 칩 아래에 연다(달력 팝업과 같은 색·테두리).
// 바깥을 누르거나 Esc를 누르면 닫힌다.
function TradingSessionChip({ session: sessionOverride }: { session?: TradingSession }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <span ref={rootRef} className="relative z-40 flex shrink-0">
      <ToolbarChip bare>
        <button
          type="button"
          aria-label="시장 시간대 안내"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(open => !open)}
          className={`toolbar-badge-control flex h-6 items-center border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[var(--ui-control)] focus-visible:bg-[var(--ui-control)] ${isOpen ? 'bg-[var(--ui-control)]' : 'bg-transparent'}`}
        >
          <TradingSessionIndicator session={sessionOverride} />
        </button>
      </ToolbarChip>
      {isOpen && (
        <ToolbarPopup
          open={isOpen}
          triggerRef={rootRef}
          popupRef={popupRef}
          ariaLabel="시장 시간대 안내"
          className="w-max rounded-md border border-ui-border bg-[var(--ui-panel)] p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl"
        >
          <PopupHeader>SESSION</PopupHeader>
          {/* 일본·미국과 같은 공통 표를 쓴다. 마켓 종료 줄은 안내하지 않는다. */}
          <SessionGuideTable rows={SESSION_GUIDE.filter(row => row.session !== '마켓 종료').map(row => ({ ...row, term: KOREA_SESSION_TERM[row.session] }))} dotColors={SESSION_DOT_COLOR} termHasReading={false} />
        </ToolbarPopup>
      )}
    </span>
  )
}

// 한국 세션 안내의 가운데 영문 칸(일본·미국과 같은 자리).
const KOREA_SESSION_TERM: Record<string, string> = { '프리 마켓': 'PRE MARKET', '메인 마켓': 'MAIN MARKET', '애프터 마켓': 'AFTER MARKET', '마켓 종료': 'CLOSED' }

const CHANGE_RATE_OPTIONS = [
  { value: 'close' as const, label: '종가', titlePrefix: '메인 마켓 ', descriptionBefore: '전일 종가', descriptionAfter: '당일 종가' },
  { value: 'daily' as const, label: '합산', titlePrefix: '애프터 마켓 ', descriptionBefore: '전일 종가', descriptionAfter: '현재가' },
  { value: 'afterHours' as const, label: '별도', titlePrefix: '애프터 마켓 ', descriptionBefore: '당일 종가', descriptionAfter: '현재가' },
]

export function ChangeRateModeSelector({ basis, selectable, onChange }: {
  basis: ChangeRateChoice
  selectable: boolean
  onChange: (basis: ChangeRateChoice) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const slideSelect = useTouchSlideSelect()
  const { isMobile } = useMobileToolbar()
  const rootRef = useRef<HTMLSpanElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const options = CHANGE_RATE_OPTIONS.map(option => ({ ...option, locked: option.value === 'afterHours' && !selectable }))

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !popupRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <span ref={rootRef} data-change-rate-selector className="relative z-40 flex shrink-0">
      <ToolbarChip bare>
        <button
          type="button"
          data-change-rate-mode
          aria-label={`등락률 기준: ${options.find(option => option.value === basis)?.label ?? '합산'}`}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(open => !open)}
          className={`toolbar-badge-control ${FONT_BAR_TIME} flex h-6 items-center border-0 px-1.5 font-medium text-[var(--sub-purple)] outline-none transition-colors ${isOpen ? 'bg-[var(--ui-control)]' : 'bg-transparent hover:bg-[var(--ui-control)] focus-visible:bg-[var(--ui-control)]'}`}
        >
          {options.find(option => option.value === basis)?.label ?? '합산'}
        </button>
      </ToolbarChip>
      {/* 눈에 보이는 칩보다 감싸는 칸이 2px 짧아서 mt-1.5로 칩 기준 4px(DROPDOWN_GAP_PX)를 맞춘다. */}
      {isOpen && (
        <ToolbarPopup
          open={isOpen}
          triggerRef={rootRef}
          popupRef={popupRef}
          ariaLabel="등락률 기준 선택"
          gapPx={6}
          className={`w-max overflow-hidden ${dropdownPanelClass(isMobile)} p-2 text-sm font-normal tracking-normal`}
        >
          {/* 세션 팝업과 같은 툴바 팝업 양식: 사방 8px 여백, 머리줄·항목 글자는 왼쪽 16px에서 시작. 항목 줄만 -mx-2로 양 끝까지 늘려 선택·올림 바탕을 줄 전체로 깐다. 줄 앞에는 회색 점(2026-11-27 사용자 결정). */}
          <PopupHeader>BASIS</PopupHeader>
          <div role="radiogroup" aria-label="등락률 기준" className="-mx-2 grid grid-cols-[auto_auto_auto_auto] gap-x-4" {...slideSelect}>
            {options.map(option => (
              <button
                key={option.value}
                type="button"
                data-slide-item
                role="radio"
                aria-checked={basis === option.value}
                aria-disabled={option.locked}
                onClick={() => {
                  if (option.locked) return
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`col-span-4 grid grid-cols-subgrid items-center rounded-none border-0 px-4 py-1 text-left text-ui-white transition-colors [-webkit-tap-highlight-color:transparent] ${
                  basis === option.value
                    ? POPUP_ROW_SELECTED_CLASS
                    : option.locked
                      ? 'bg-transparent cursor-not-allowed opacity-35'
                      : POPUP_ROW_IDLE_CLASS
                }`}
              >
                {/* 세션 팝업의 원 자리에 회색 점을 찍어 이름 시작 위치를 맞춘다. 선택은 줄 바탕으로 보인다(2026-11-27 사용자 결정). */}
                <span className="flex shrink-0 items-center text-ui-white">
                  <PopupListDot />
                  <span>{option.titlePrefix}<span className="text-[var(--sub-purple)]">{option.label}</span></span>
                </span>
                {/* 기준 전·대비·기준 후도 글자 길이에 맞춘다. 칸 사이는 16px이고 "대비" 양옆만 -mx-3으로 4px까지 좁힌다. */}
                <span className="whitespace-nowrap text-right">{option.descriptionBefore}</span>
                <span className="-mx-3 text-center text-xs text-ui-muted">대비</span>
                <span className="whitespace-nowrap text-left">{option.descriptionAfter}</span>
              </button>
            ))}
          </div>
        </ToolbarPopup>
      )}
    </span>
  )
}

// 등락률 기준을 단일 버튼으로 통합하고, 눌렀을 때 설명과 함께 세 선택지를 안내한다.
export function ChangeRateModeToggle({ basis, visible, selectable, onChange }: {
  basis: ChangeRateChoice
  visible: boolean
  selectable: boolean
  onChange: (basis: ChangeRateChoice) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      {/* 종가 지도는 정규장이 끝난 시점의 지도라서, 지금이 애프터 마켓이어도 시간대 글자는 "마켓 종료"로 둔다. */}
      <TradingSessionChip session={basis === 'close' ? '마켓 종료' : undefined} />
      {visible && <ChangeRateModeSelector basis={basis} selectable={selectable} onChange={onChange} />}
    </div>
  )
}
