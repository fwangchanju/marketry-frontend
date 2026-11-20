import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// 폰 지도 하단 설정 줄. 업종 지도 설정 줄(MobileMarketSummaryPage)과 같은 클래스·구조를 쓴다.
// 마켓은 한국·일본·미국 세 가지이며 누르면 해당 지도로 이동한다. 분류 기준·박스 크기는 이 화면에서만 바뀌고 저장되지 않는다.
export type MobileMapMarket = 'korea' | 'japan' | 'usa'

const SETTING_CHIP_CLASS = 'h-[32px] rounded-[4px] border-0 px-1 text-[13px] font-medium'
const CHIP_ON = 'bg-brand-surface text-ui-on-dark'
const CHIP_OFF = 'bg-ui-control text-ui-white'

const MARKET_OPTIONS: { key: MobileMapMarket; label: string; path: string }[] = [
  { key: 'korea', label: '한국', path: '/map/korea' },
  { key: 'japan', label: '일본', path: '/map/japan' },
  { key: 'usa', label: '미국', path: '/map/usa' },
]
const CLASSIFY_OPTIONS = ['MARKETRY', '거래소', '내 기준']
const BOX_OPTIONS = ['동일', '균형', '시총 비례']

// 설정 줄 한 칸 — 이름은 왼쪽, 선택지는 오른쪽에 한 줄로 둔다(업종 지도 설정 줄과 같다).
function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <div className="w-[80px] shrink-0"><h3 className="text-[12px] font-semibold leading-tight">{label}</h3></div>
      {children}
    </div>
  )
}

export default function MobileMapSheet({ current }: { current: MobileMapMarket }) {
  const [open, setOpen] = useState(false)
  const [classify, setClassify] = useState(CLASSIFY_OPTIONS[0])
  const [box, setBox] = useState(BOX_OPTIONS[2])
  const navigate = useNavigate()
  return (
    <section aria-label="설정" role="region" className="relative z-10 mx-1 shrink-0 rounded-t-[16px] rounded-b-none border-t border-ui-border bg-ui-panel shadow-[0_-6px_24px_rgba(0,0,0,0.25)]">
      <div className="relative h-[24px]">
        <button
          type="button"
          aria-label={open ? '설정 닫기' : '설정 열기'}
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}
          className="absolute left-1/2 top-0 flex h-[24px] w-16 -translate-x-1/2 touch-none items-center justify-center border-0 bg-transparent p-0 text-ui-white before:absolute before:left-1/2 before:top-1/2 before:h-[48px] before:w-[48px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
        >
          <span aria-hidden="true" className="h-1 w-12 -translate-y-0.5 rounded-full bg-ui-muted" />
        </button>
      </div>
      {open && (
        <div className="max-h-[calc(40dvh-24px)] [@media(max-height:500px)]:max-h-[calc(60dvh-24px)] overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)]">
          <SettingRow label="분류 기준">
            <div role="radiogroup" aria-label="분류 기준" className="grid flex-1 grid-cols-3 gap-1.5">
              {CLASSIFY_OPTIONS.map(option => (
                <button key={option} type="button" role="radio" aria-checked={classify === option} onClick={() => setClassify(option)} className={`${SETTING_CHIP_CLASS} ${classify === option ? CHIP_ON : CHIP_OFF}`}>{option}</button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="마켓">
            <div role="radiogroup" aria-label="마켓 선택" className="grid flex-1 grid-cols-3 gap-1.5">
              {MARKET_OPTIONS.map(option => (
                <button key={option.key} type="button" role="radio" aria-checked={current === option.key} onClick={() => navigate(option.path)} className={`${SETTING_CHIP_CLASS} ${current === option.key ? CHIP_ON : CHIP_OFF}`}>{option.label}</button>
              ))}
            </div>
          </SettingRow>
          <SettingRow label="박스 크기">
            <div className="grid flex-1 grid-cols-3 gap-1.5">
              {BOX_OPTIONS.map(option => (
                <button key={option} type="button" aria-pressed={box === option} onClick={() => setBox(option)} className={`${SETTING_CHIP_CLASS} ${box === option ? CHIP_ON : CHIP_OFF}`}>{option}</button>
              ))}
            </div>
          </SettingRow>
        </div>
      )}
    </section>
  )
}
