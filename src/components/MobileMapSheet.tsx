import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MOBILE_BALANCED_BOX_SIZE_RATIO, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'

// 폰 지도 하단 설정 줄. 업종 지도 설정 줄(MobileMarketSummaryPage)과 같은 클래스·구조·열림 애니메이션·끌어서 여닫기를 쓴다.
// 마켓은 한국·일본·미국 세 가지이며 누르면 해당 지도로 이동한다. 박스 크기는 지도 설정 값과 연결된다.
export type MobileMapMarket = 'korea' | 'japan' | 'usa'

const SETTING_CHIP_CLASS = 'h-[32px] rounded-[4px] border-0 px-1 text-[13px] font-medium'
const CHIP_ON = 'bg-brand-surface text-ui-on-dark'
const CHIP_OFF = 'bg-ui-control text-ui-white'
const SETTINGS_BAR_HEIGHT = 24

const MARKET_OPTIONS: { key: MobileMapMarket; label: string; path: string; summaryPath: string }[] = [
  { key: 'korea', label: '한국', path: '/map/korea', summaryPath: '/summary/korea?map' },
  { key: 'japan', label: '일본', path: '/map/japan', summaryPath: '/summary/japan?map' },
  { key: 'usa', label: '미국', path: '/map/usa', summaryPath: '/summary/usa?map' },
]
const BOX_OPTIONS: { value: number; label: string }[] = [
  { value: 100, label: '시총 비례' },
  { value: MOBILE_BALANCED_BOX_SIZE_RATIO, label: '균형' },
  { value: 0, label: '동일' },
]

// 열림 상태는 앱 메모리에만 둔다(브라우저 저장 없음). 마켓을 바꿔 다른 지도로 가도 유지된다.
const sheetMemory = { open: false }
function rememberSheetOpen(next: boolean) {
  sheetMemory.open = next
}

// 설정 줄 한 칸 — 이름은 왼쪽, 선택지는 오른쪽에 한 줄로 둔다(업종 지도 설정 줄과 같다).
function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-[80px] shrink-0"><h3 className="text-[12px] font-semibold leading-tight">{label}</h3></div>
      {children}
    </div>
  )
}

type Drag = { y: number; start: number; max: number; moved: boolean }

export default function MobileMapSheet({ current, boxSize, onChangeBoxSize }: { current: MobileMapMarket; boxSize: number; onChangeBoxSize: (value: number) => void }) {
  const [open, setOpenState] = useState(sheetMemory.open)
  const [layoutReady, setLayoutReady] = useState(false)
  const [height, setHeight] = useState(0)
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const suppressClickRef = useRef(false)
  const normalizedBox = normalizeMobileBoxSizeRatio(boxSize)
  const navigate = useNavigate()
  const location = useLocation()
  // 업종 지도에서 마켓을 바꾸면 같은 종류의 지도로 간다(종목 지도는 종목 지도로 유지).
  const isSectorMap = location.pathname.startsWith('/summary/')
  // 처음 그릴 때는 열림 애니메이션을 재생하지 않도록, 첫 그리기 뒤에 전환을 켠다(업종 지도와 같다).
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLayoutReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const measureHeight = () => Math.min(contentRef.current?.scrollHeight ?? 0, window.innerHeight * (window.innerHeight <= 500 ? 0.6 : 0.4) - SETTINGS_BAR_HEIGHT)
  const commitOpen = (next: boolean, openHeight: number) => {
    if (next) setHeight(openHeight)
    rememberSheetOpen(next)
    setOpenState(next)
  }
  const toggleOpen = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    commitOpen(!open, measureHeight())
  }
  // 페이지가 바뀌어 열린 채로 들어오면, 내용이 그려진 뒤 한 번 높이를 잰다.
  const attachContent = (node: HTMLDivElement | null) => {
    contentRef.current = node
    if (node && open && height === 0) setHeight(measureHeight())
  }
  // 손가락으로 누른 채 끌어서 여닫는다(터치·펜만, 업종 지도와 같다).
  const onHandleDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    const max = measureHeight()
    dragRef.current = { y: event.clientY, start: open ? max : 0, max, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onHandleMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const delta = drag.y - event.clientY
    if (Math.abs(delta) > 5) drag.moved = true
    if (drag.moved) setDragHeight(Math.max(0, Math.min(drag.max, drag.start + delta)))
  }
  const onHandleUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.moved) {
      commitOpen(drag.start + drag.y - event.clientY > drag.max / 2, drag.max)
      suppressClickRef.current = true
    }
    dragRef.current = null
    setDragHeight(null)
  }
  const onHandleCancel = () => {
    dragRef.current = null
    setDragHeight(null)
  }
  const shownHeight = dragHeight ?? (open ? height : 0)
  return (
    <section aria-label="설정" role="region" className="relative z-10 mx-1 shrink-0 rounded-t-[16px] rounded-b-none border-t border-ui-border bg-ui-panel shadow-[0_-6px_24px_rgba(0,0,0,0.25)]">
      <div className="relative h-[24px]">
        <button
          type="button"
          aria-label={open ? '설정 닫기' : '설정 열기'}
          aria-expanded={open}
          onClick={toggleOpen}
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleCancel}
          className="absolute left-1/2 top-0 flex h-[24px] w-16 -translate-x-1/2 touch-none items-center justify-center border-0 bg-transparent p-0 text-ui-white before:absolute before:left-1/2 before:top-1/2 before:h-[48px] before:w-[48px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
        >
          <span aria-hidden="true" className="h-1 w-12 -translate-y-0.5 rounded-full bg-ui-muted" />
        </button>
      </div>
      <div style={{ height: `${shownHeight}px`, transition: dragHeight === null && layoutReady ? 'height 240ms ease-out' : 'none' }} className="overflow-hidden motion-reduce:!transition-none">
        <div ref={attachContent} inert={!open && dragHeight === null} className="max-h-[calc(40dvh-24px)] [@media(max-height:500px)]:max-h-[calc(60dvh-24px)] overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <SettingRow label="마켓">
            <div role="radiogroup" aria-label="마켓 선택" className="grid flex-1 grid-cols-3 gap-1.5">
              {MARKET_OPTIONS.map(option => (
                <button key={option.key} type="button" role="radio" aria-checked={current === option.key} onClick={() => navigate(isSectorMap ? option.summaryPath : option.path, { state: { mobileBoxSize: boxSize } })} className={`${SETTING_CHIP_CLASS} ${current === option.key ? CHIP_ON : CHIP_OFF}`}>{option.label}</button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="박스 크기">
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {BOX_OPTIONS.map(option => (
                <button key={option.value} type="button" aria-pressed={normalizedBox === option.value} onClick={() => onChangeBoxSize(option.value)} className={`${SETTING_CHIP_CLASS} ${normalizedBox === option.value ? CHIP_ON : CHIP_OFF}`}>{option.label}</button>
              ))}
            </div>
          </SettingRow>
        </div>
      </div>
    </section>
  )
}
