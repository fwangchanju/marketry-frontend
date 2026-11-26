import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MOBILE_POPUP_BACKDROP_CLASS, MOBILE_POPUP_SCALE, MOBILE_POPUP_Z_CLASS, mobilePopupTop } from '@/utils/mobilePopupScale'
import PopupHeader, { PopupListDot } from '@/components/PopupHeader'
import { popupBadgeClass } from '@/components/popupBadgeStyle'
import { POPUP_ROW_IDLE_CLASS, POPUP_ROW_SELECTED_CLASS } from '@/components/popupHeaderStyle'
import { useTouchSlideSelect } from '@/hooks/useTouchSlideSelect'
import { swallowNextClick } from '@/utils/swallowNextClick'
import { MOBILE_BALANCED_BOX_SIZE_RATIO, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'

// MOBILE 지도 상단 줄 오른쪽 아이콘 두 개 — 박스 크기와 사용 방법.
// 하단 설정 줄을 없애면서(2026-11-27 사용자 결정) 박스 크기만 이리로 옮겼다. 마켓은 위아래 밀기와 툴바 시장 배지로 바꾼다.

const BOX_OPTIONS: { value: number; label: string }[] = [
  { value: 100, label: '시가총액 비례' },
  { value: MOBILE_BALANCED_BOX_SIZE_RATIO, label: '균형 조정' },
  { value: 0, label: '동일 크기' },
]
// 박스 크기 줄 — BASIS 팝업 줄과 같은 모양. 손가락을 누른 채 밀면 손가락 밑 줄에 바탕이 따라가고, 손을 뗀 줄이 선택된다(useTouchSlideSelect).
const ROW_CLASS = '-mx-2 flex items-center rounded-none border-0 px-4 py-1 text-left text-ui-white transition-colors [-webkit-tap-highlight-color:transparent]'
const ICON_BUTTON_CLASS = 'flex h-[44px] w-[40px] items-center justify-center border-0 bg-transparent p-0 text-ui-text disabled:opacity-30'

// 사용 방법 창은 처음 들어오면 자동으로 한 번 뜬다. "하루 동안 보지 않기"를 고르고 닫으면 그동안 띄우지 않는다(이 브라우저에만 저장, 2026-11-27 사용자 결정 7일→하루).
const GUIDE_HIDDEN_UNTIL_KEY = 'marketry:mobile-map-guide-hidden-until'
const GUIDE_HIDE_DAYS = 1
// 한 번 열어 본 뒤에는 페이지를 넘길 때마다 다시 띄우지 않는다(새로 고침 전까지).
const guideMemory = { autoShown: false }

function guideHidden(): boolean {
  try {
    const until = Number(window.localStorage.getItem(GUIDE_HIDDEN_UNTIL_KEY) ?? 0)
    return Number.isFinite(until) && until > Date.now()
  } catch {
    return false
  }
}

function hideGuideForDays() {
  try {
    window.localStorage.setItem(GUIDE_HIDDEN_UNTIL_KEY, String(Date.now() + GUIDE_HIDE_DAYS * 24 * 60 * 60 * 1000))
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 닫힌다.
  }
}

// 상단 두 아이콘의 선 굵기 1.4(2026-11-27 사용자 지시로 1.8에서 가늘게).
function BoxSizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-[22px] w-[22px]">
      <rect x="3" y="3" width="10" height="11" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="11" width="6" height="10" rx="1" />
      <rect x="3" y="16" width="10" height="5" rx="1" />
    </svg>
  )
}

function GuideIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" className="h-[22px] w-[22px]">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.3 2.4c-.5.2-.8.6-.8 1.1V14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" />
    </svg>
  )
}

// 박스 크기 창 — 지도 팝업·툴바 팝업과 같은 자리(가로 가운데, 세로 가운데가 화면 높이 55%)에 뜬다. 바깥을 누르면 닫힌다.
function BoxSizePopup({ value, onChange, onClose, triggerRef }: { value: number; onChange: (value: number) => void; onClose: () => void; triggerRef: React.RefObject<HTMLButtonElement | null> }) {
  const popupRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const popup = popupRef.current
    if (!popup) return
    const { width, height } = popup.getBoundingClientRect()
    popup.style.left = `${(window.innerWidth - width) / 2}px`
    popup.style.top = `${mobilePopupTop(window.innerHeight, height)}px`
    popup.style.visibility = 'visible'
  })
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (popupRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      // 바깥 누름은 창만 닫고 아래 화면은 누르지 않는다.
      swallowNextClick()
      onClose()
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [onClose, triggerRef])
  const normalized = normalizeMobileBoxSizeRatio(value)
  const slideSelect = useTouchSlideSelect()
  return createPortal(
    <>
    <div aria-hidden="true" className={MOBILE_POPUP_BACKDROP_CLASS} />
    {/* 툴바 팝업(BASIS)과 같은 양식: 1.3배, 둥근 패널, 사방 8px, 머리줄과 구분선, 줄 앞 점, 고른 줄은 청록 바탕(2026-11-27 사용자 지시). 이 창은 툴바 팝업 부품 밖이라 같은 값을 직접 쓴다. */}
    <div ref={popupRef} role="dialog" aria-label="박스 크기" className={`fixed ${MOBILE_POPUP_Z_CLASS} w-max rounded-[9px] bg-ui-panel p-2 text-sm font-normal tracking-normal text-ui-white shadow-2xl`} style={{ left: 0, top: 0, transform: `scale(${MOBILE_POPUP_SCALE})`, transformOrigin: 'top left', visibility: 'hidden' }}>
      <PopupHeader>BOX SIZE</PopupHeader>
      <div role="radiogroup" aria-label="박스 크기" className="flex flex-col" {...slideSelect}>
        {BOX_OPTIONS.map(option => (
          <button key={option.value} type="button" data-slide-item role="radio" aria-checked={normalized === option.value} onClick={() => { onChange(option.value); onClose() }} className={`${ROW_CLASS} ${normalized === option.value ? POPUP_ROW_SELECTED_CLASS : POPUP_ROW_IDLE_CLASS}`}>
            <PopupListDot />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
    </>,
    document.body,
  )
}

// 동작 이름은 왼쪽·오른쪽, 위·아래처럼 한글로 맞춘다(2026-11-27 사용자 결정). 설명은 한 줄로 끝나게 짧게 쓴다.
const GUIDE_ROWS: { title: string; text: string; icon: React.ReactNode }[] = [
  {
    title: '왼쪽·오른쪽으로 밀기',
    text: 'MAP · SECTOR · GRAPH 페이지 이동',
    icon: <svg viewBox="0 0 40 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12h32M10 6l-6 6 6 6M30 6l6 6-6 6" /></svg>,
  },
  {
    title: '위로 밀기',
    text: '한국 · 일본 · 미국 국가 변경',
    icon: <svg viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 36V4M6 10l6-6 6 6" /></svg>,
  },
  {
    title: '두 손가락으로 확대·축소',
    text: 'MAP 확대',
    icon: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 32l10-10M32 8L22 18M8 32v-8M8 32h8M32 8v8M32 8h-8" /></svg>,
  },
  {
    title: '길게 누르기',
    text: '업종·종목 상세정보 보기',
    icon: <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="20" cy="20" r="6" fill="currentColor" stroke="none" /><circle cx="20" cy="20" r="13" strokeDasharray="4 4" /></svg>,
  },
]

function GuideDialog({ onClose }: { onClose: (hideForDays: boolean) => void }) {
  const [hideForDays, setHideForDays] = useState(false)
  const close = () => onClose(hideForDays)
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-label="사용 방법" className="w-full max-w-[320px] rounded-xl bg-ui-panel px-[calc(1rem*1.3)] pb-[calc(0.5rem*1.3)] text-ui-white shadow-2xl" onClick={event => event.stopPropagation()}>
        {/* 머리줄은 툴바 팝업과 같은 공통 부품(PopupHeader)을 쓴다(2026-11-27 사용자 지시, 글자 크기까지 맞춤). 이 창은 배율 없이 그려지므로
            머리줄 묶음에만 MOBILE 팝업 배율(zoom 1.3)을 줘서 글자·높이·구분선·여백이 BASIS·BOX SIZE와 똑같이 보이게 한다.
            -mx-4는 창의 좌우 여백을 상쇄해 구분선이 다른 팝업처럼 창 끝에서 8px 안쪽에서 끊기게 하고, 창 좌우 여백은 머리줄 글자 시작 위치에 맞춘다. */}
        <div className="-mx-4 px-2 pt-2" style={{ zoom: MOBILE_POPUP_SCALE }}>
          <PopupHeader>HOW TO USE</PopupHeader>
        </div>
        <ul className="m-0 list-none p-0">
          {GUIDE_ROWS.map(row => (
            <li key={row.title} className="flex items-center gap-3 py-2.5">
              <span aria-hidden="true" className="flex h-[36px] w-[36px] shrink-0 items-center justify-center text-ui-muted [&>svg]:max-h-[30px] [&>svg]:max-w-[30px]">{row.icon}</span>
              <span>
                <span className="block text-[14px] font-semibold">{row.title}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-ui-muted">{row.text}</span>
              </span>
            </li>
          ))}
        </ul>
        {/* 닫기는 엄지가 닿는 아래에 둔다(2026-11-27 사용자 결정 — 위쪽 ✕는 폰에서 누르기 불편).
            구분선 아래 높이와 닫기 배지는 캘린더 팝업 아래 줄에 맞춘다(같은 날 사용자 결정). 닫기는 팝업 배지 공통 양식(popupBadgeClass)을 쓰고,
            이 창은 배율 없이 그려지므로 배지에만 MOBILE 팝업 배율(zoom 1.3)을 줘서 캘린더 적용 배지와 같은 크기로 보이게 한다. 위아래 여백도 배율을 반영한 8px. */}
        {/* 아래 구분선도 머리줄 구분선처럼 창 끝에서 8px(배율 반영) 안쪽에서 끊는다. 안쪽 글자 위치는 그대로(2026-11-27 사용자 지시). */}
        <div className="mx-[calc(-0.5rem*1.3)] mt-1 flex items-center justify-between gap-3 border-t border-ui-border px-[calc(0.5rem*1.3)] pt-[calc(0.5rem*1.3)]">
          <label className="flex items-center gap-2 text-[14px] text-ui-muted">
            <input type="checkbox" className="thin-check" checked={hideForDays} onChange={event => setHideForDays(event.target.checked)} />
            하루 동안 보지 않기
          </label>
          <button type="button" onClick={close} style={{ zoom: MOBILE_POPUP_SCALE }} className={`${popupBadgeClass('action', true)} bg-brand-surface text-ui-white`}>닫기</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default function MobileMapTopActions({ boxSize, onChangeBoxSize, boxSizeDisabled }: { boxSize: number; onChangeBoxSize: (value: number) => void; boxSizeDisabled: boolean }) {
  const [boxOpen, setBoxOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(() => !guideMemory.autoShown && guideHidden() === false)
  useEffect(() => { if (guideOpen) guideMemory.autoShown = true }, [guideOpen])
  const boxButtonRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex items-center">
      {/* 그룹 등락률에는 박스가 없어 흐리게 막는다(2026-11-27 사용자 결정). */}
      <button ref={boxButtonRef} type="button" aria-label="박스 크기" aria-expanded={boxOpen} disabled={boxSizeDisabled} onClick={() => setBoxOpen(open => !open)} className={ICON_BUTTON_CLASS}>
        <BoxSizeIcon />
      </button>
      <button type="button" aria-label="사용 방법" onClick={() => setGuideOpen(true)} className={ICON_BUTTON_CLASS}>
        <GuideIcon />
      </button>
      {boxOpen && !boxSizeDisabled && <BoxSizePopup value={boxSize} onChange={onChangeBoxSize} onClose={() => setBoxOpen(false)} triggerRef={boxButtonRef} />}
      {guideOpen && <GuideDialog onClose={hideForDays => { if (hideForDays) hideGuideForDays(); setGuideOpen(false) }} />}
    </div>
  )
}
