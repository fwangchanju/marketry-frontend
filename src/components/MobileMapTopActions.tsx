import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MOBILE_POPUP_BACKDROP_CLASS, MOBILE_POPUP_Z_CLASS, mobilePopupTop } from '@/utils/mobilePopupScale'
import { swallowNextClick } from '@/utils/swallowNextClick'
import { MOBILE_BALANCED_BOX_SIZE_RATIO, normalizeMobileBoxSizeRatio } from '@/utils/sectorLayoutWeights'

// MOBILE 지도 상단 줄 오른쪽 아이콘 두 개 — 박스 크기와 사용 방법.
// 하단 설정 줄을 없애면서(2026-11-27 사용자 결정) 박스 크기만 이리로 옮겼다. 마켓은 위아래 밀기와 툴바 시장 배지로 바꾼다.

const BOX_OPTIONS: { value: number; label: string }[] = [
  { value: 100, label: '시총 비례' },
  { value: MOBILE_BALANCED_BOX_SIZE_RATIO, label: '균형' },
  { value: 0, label: '동일' },
]
// 옛 하단 설정 줄의 선택 칩과 같은 모양이다.
const CHIP_CLASS = 'h-[36px] rounded-[4px] border-0 px-3 text-[14px] font-medium'
const CHIP_ON = 'bg-brand-surface text-ui-on-dark'
const CHIP_OFF = 'bg-ui-control text-ui-white'
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

function BoxSizeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[22px] w-[22px]">
      <rect x="3" y="3" width="10" height="11" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="11" width="6" height="10" rx="1" />
      <rect x="3" y="16" width="10" height="5" rx="1" />
    </svg>
  )
}

function GuideIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-[22px] w-[22px]">
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
  return createPortal(
    <>
    <div aria-hidden="true" className={MOBILE_POPUP_BACKDROP_CLASS} />
    <div ref={popupRef} role="dialog" aria-label="박스 크기" className={`fixed ${MOBILE_POPUP_Z_CLASS} rounded-xl bg-ui-panel p-3 text-ui-white shadow-2xl`} style={{ left: 0, top: 0, visibility: 'hidden' }}>
      <h3 className="mb-2 text-[13px] font-semibold leading-tight">박스 크기</h3>
      <div role="radiogroup" aria-label="박스 크기" className="flex gap-1.5">
        {BOX_OPTIONS.map(option => (
          <button key={option.value} type="button" role="radio" aria-checked={normalized === option.value} onClick={() => { onChange(option.value); onClose() }} className={`${CHIP_CLASS} ${normalized === option.value ? CHIP_ON : CHIP_OFF}`}>{option.label}</button>
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
      <div role="dialog" aria-modal="true" aria-label="사용 방법" className="w-full max-w-[320px] rounded-xl bg-ui-panel px-4 pb-2 text-ui-white shadow-2xl" onClick={event => event.stopPropagation()}>
        {/* 머리줄은 창 위 끝과 첫 구분선 사이에 중간 정렬한다(2026-11-27 사용자 결정, 글자 16→18px). */}
        <h2 className="m-0 flex h-[56px] items-center gap-2 text-[18px] font-bold"><span className="text-ui-text [&>svg]:h-[24px] [&>svg]:w-[24px]"><GuideIcon /></span>HOW TO USE</h2>
        <ul className="m-0 list-none p-0">
          {GUIDE_ROWS.map(row => (
            <li key={row.title} className="flex items-center gap-3 border-t border-ui-border py-2.5">
              <span aria-hidden="true" className="flex h-[36px] w-[36px] shrink-0 items-center justify-center text-ui-muted [&>svg]:max-h-[30px] [&>svg]:max-w-[30px]">{row.icon}</span>
              <span>
                <span className="block text-[14px] font-semibold">{row.title}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-ui-muted">{row.text}</span>
              </span>
            </li>
          ))}
        </ul>
        {/* 닫기는 엄지가 닿는 아래에 둔다(2026-11-27 사용자 결정 — 위쪽 ✕는 폰에서 누르기 불편).
            구분선 아래 높이와 닫기 배지는 캘린더 팝업 아래 줄(구분선~바닥 약 43px, 적용 배지 약 50×25px 청록)에 맞춘다(같은 날 사용자 결정). */}
        <div className="mt-1 flex h-[37px] items-center justify-between gap-3 border-t border-ui-border pt-2">
          <label className="flex h-full items-center gap-2 text-[14px] text-ui-muted">
            <input type="checkbox" className="thin-check" checked={hideForDays} onChange={event => setHideForDays(event.target.checked)} />
            하루 동안 보지 않기
          </label>
          <button type="button" onClick={close} className="h-[25px] shrink-0 rounded border-0 bg-brand-surface px-[11px] text-center text-[14px] font-normal leading-none text-ui-white">닫기</button>
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
