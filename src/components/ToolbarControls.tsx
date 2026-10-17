import { useEffect, useRef, useState } from 'react'
import type { ChangeRateChoice } from '@/api/treemap'
import { accentColor } from '@/utils/accentPalette'
import { type TradingSession } from '@/utils/tradingWindow'
import { useTradingSession } from '@/hooks/useTradingSession'
import { FONT_BAR_TIME } from '@/components/FontStyle'
import ToolbarChip from '@/components/ToolbarChip'
import { SlidingHighlight } from '@/components/SlidingHighlight'

// 시간대 표시 점의 색 — 프리 마켓은 크림, 메인 마켓은 형광,
// 애프터 마켓은 서브 팔레트의 연한 슬레이트 블루, 마켓 종료은 연회색이다.
const SESSION_DOT_COLOR: Record<TradingSession, string> = {
  '프리 마켓': 'var(--ui-popup)',
  '메인 마켓': accentColor('형광'),
  '애프터 마켓': 'var(--secondary-soft)',
  '마켓 종료': accentColor('연회색'),
}

// 지도·그룹 페이지가 같은 시간대 문구와 강조 색상을 사용한다.
// session을 주면 지금 시간대 대신 그 시간대를 보여준다(종가 지도를 보는 동안은 "마켓 종료").
export function TradingSessionIndicator({ session: sessionOverride }: { session?: TradingSession }) {
  const currentSession = useTradingSession()
  const session = sessionOverride ?? currentSession
  return (
    <span className={`${FONT_BAR_TIME} flex items-center text-ui-white`}>
      <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[session] }} />
      {/* 칩 폭은 지금 시간대 이름에 맞춘다 — 애프터 마켓일 때만 그만큼 넓어진다. */}
      <span>{session}</span>
    </span>
  )
}

// 시간대 안내 팝업의 고정 내용 — 서버 시간표나 지금 시간대와 연동하지 않는 안내문이다(칩의 시간대 판정과는 별개).
const SESSION_GUIDE: { session: TradingSession; range: string }[] = [
  { session: '프리 마켓', range: '08:00 ~ 08:50' },
  { session: '메인 마켓', range: '09:00 ~ 15:30' },
  { session: '애프터 마켓', range: '15:40 ~ 20:00' },
  { session: '마켓 종료', range: '그 외' },
]

// 시장 시간대 칩 — 눌러서 시간대별 시간 범위를 안내하는 팝업을 칩 아래에 연다(달력 팝업과 같은 색·테두리).
// 바깥을 누르거나 Esc를 누르면 닫힌다.
function TradingSessionChip({ session: sessionOverride }: { session?: TradingSession }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
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
    <span ref={rootRef} className="relative z-40 flex">
      <ToolbarChip bare>
        <button
          type="button"
          aria-label="시장 시간대 안내"
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(open => !open)}
          className={`flex h-6 items-center border-0 px-1.5 text-inherit outline-none transition-colors hover:bg-[var(--ui-control-hover)] focus-visible:bg-[var(--ui-control-hover)] ${isOpen ? 'bg-[var(--ui-control-hover)]' : 'bg-transparent'}`}
        >
          <TradingSessionIndicator session={sessionOverride} />
        </button>
      </ToolbarChip>
      {isOpen && (
        <div
          role="dialog"
          aria-label="시장 시간대 안내"
          className="absolute left-0 top-full z-50 mt-[7px] w-max rounded-md border border-ui-border bg-[var(--ui-panel)] p-2 text-sm font-normal tracking-normal text-ui-white shadow-xl"
        >
          <p className="mb-1.5 px-1 text-xs font-medium text-ui-text">시장 시간대 (한국 시간)</p>
          {SESSION_GUIDE.map(row => (
            <div key={row.session} className="flex items-center justify-between gap-6 px-2 py-1">
              <span className="flex items-center">
                <span aria-hidden="true" className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: SESSION_DOT_COLOR[row.session] }} />
                {row.session}
              </span>
              {/* 시작·끝 시각을 각각 같은 폭의 칸(5글자)에 두고 굵기도 바꾸지 않아서, 줄마다 시작점과 끝점이 세로로 맞는다. */}
              {row.range.includes(' ~ ') ? (
                <span className="flex items-center gap-1 font-normal tabular-nums">
                  <span className="w-[5ch] text-right">{row.range.split(' ~ ')[0]}</span>
                  <span aria-hidden="true">~</span>
                  <span className="w-[5ch] text-right">{row.range.split(' ~ ')[1]}</span>
                </span>
              ) : (
                <span className="font-normal">{row.range}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

// 등락률 기준 토글 — 종가(그날 정규장 종가 지도) / 누적(전일 종가 대비) / 별도(당일 종가 대비). 애프터 마켓 시작부터 다음 프리 마켓 개장 전까지만 보인다.
// 시간외 스냅샷이 아직 없으면 별도는 잠긴다. 시장 시간대 말머리는 버튼의 표시 여부와 무관하게 유지한다.
// 버튼에 커서를 올리면 공용 툴팁(data-hint)이 뜬다. 잠긴 별도도 올려서 설명을 볼 수 있다.
export function ChangeRateModeToggle({ basis, visible, selectable, onChange }: {
  basis: ChangeRateChoice
  visible: boolean
  selectable: boolean
  onChange: (basis: ChangeRateChoice) => void
}) {
  const options = [
    { value: 'close' as const, label: '종가', help: '메인 마켓 종가\n(전일 종가 대비 당일 종가)', locked: false },
    { value: 'daily' as const, label: '누적', help: '애프터 마켓 누적\n(전일 종가 대비 현재가)', locked: false },
    { value: 'afterHours' as const, label: '별도', help: '애프터 마켓 별도\n(당일 종가 대비 현재가)', locked: !selectable },
  ]
  // 설정창 선택 버튼과 같은 모양 — 틀 없이 직각 직각 칩 3개(간격 3px)이고, 선택 칸의 색 채움이 칩 사이를 미끄러진다.
  const selectedIndex = options.findIndex(option => option.value === basis)

  return (
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      {/* 종가 지도는 정규장이 끝난 시점의 지도라서, 지금이 애프터 마켓이어도 시간대 글자는 "마켓 종료"로 둔다. 시각으로 계산하지 않아 개장·마감이 달라지는 날에도 맞다. */}
      <TradingSessionChip session={basis === 'close' ? '마켓 종료' : undefined} />
      {visible && <div
        role="radiogroup"
        aria-label="등락률 기준"
        className="relative grid h-6 w-[120px] shrink-0 grid-cols-3 gap-[3px] overflow-visible"
      >
        <SlidingHighlight count={options.length} index={selectedIndex} gap={3} square fillColor={SESSION_DOT_COLOR['애프터 마켓']} />
        {options.map(option => (
          // disabled를 쓰지 않는다 — 비활성 버튼은 마우스 이벤트가 없어서 잠긴 별도의 설명을 볼 수 없다. 잠긴 동안은 값만 안 바꾼다.
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={basis === option.value}
            aria-disabled={option.locked}
            onClick={() => {
              if (!option.locked && basis !== option.value) onChange(option.value)
            }}
            // 설명은 공용 툴팁(HoverHintLayer)이 띄운다 — 잠긴 별도도 aria-disabled라 올리면 설명이 보인다.
            data-hint={option.help}
            // 안 선택 글자는 옆 거래 세션 글자(text-ui-muted)와 같은 회색이다. 잠긴 별도는 흐리게 해서 잠긴 것을 알아보게 한다.
            className={`relative z-10 h-6 min-w-0 border-0 bg-transparent px-0 text-[13px] font-semibold leading-none transition-colors duration-[500ms] ${
              basis === option.value
                ? 'text-ui-surface'
                : option.locked
                  ? 'cursor-not-allowed text-ui-muted opacity-40'
                  : 'text-ui-muted hover:text-ui-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>}
    </div>
  )
}
