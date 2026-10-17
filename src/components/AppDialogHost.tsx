import { useEffect, useRef, useSyncExternalStore } from 'react'
import { getCurrentAppDialog, resolveCurrentAppDialog, subscribeAppDialogs } from '@/utils/appDialogBus'
import { HINT_BUBBLE_COLOR_CLASS, POPUP_SIZE_CLASS } from './hintBubbleStyle'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'
import PopupKindBadge from './PopupKindBadge'
import { playDialogBlockedSound } from '@/utils/dialogSound'

export default function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeAppDialogs, getCurrentAppDialog, getCurrentAppDialog)
  const mainAreaRect = useMainAreaRect(dialog !== null)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        resolveCurrentAppDialog(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dialog])

  if (!dialog) return null

  const dismiss = () => resolveCurrentAppDialog(false)

  // 창 바깥(막힌 곳)을 누르면 짧은 소리를 내고 창을 살짝 흔들어, 닫아야 뒤 화면을 쓸 수 있다는 것을 알려 준다(윈도우 네이티브 창의 동작과 같다). 움직임을 줄이는 설정이면 흔들지 않고 소리만 낸다.
  const handleBlockedPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (sectionRef.current?.contains(event.target as Node)) return
    playDialogBlockedSound()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    sectionRef.current?.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-7px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-out' },
    )
  }

  // 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 반드시 버튼이나 Esc로 답해야 한다.
  return (
    <div className="fixed inset-0 z-[100] bg-ui-background/70" onPointerDown={handleBlockedPointerDown}>
      {/* 어두운 배경은 화면 전체를 덮고, 창은 메인 영역 안의 가운데에 놓는다. */}
      <div
        className={`flex items-center justify-center p-4 ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
        style={mainAreaRect ? { left: mainAreaRect.left, top: mainAreaRect.top, width: mainAreaRect.width, height: mainAreaRect.height } : undefined}
      >
      <section
        ref={sectionRef}
        onDragStart={event => event.preventDefault()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        // 색은 설정창 말풍선·NXT 안내창과 같은 크림색 계열이다.
        className={`select-none ${POPUP_SIZE_CLASS} ${HINT_BUBBLE_COLOR_CLASS} ${dialog.adminOnly ? 'border-[3px] border-[var(--status-error)]' : ''}`}
      >
        <h2 id="app-dialog-title" className={`flex items-center text-base font-bold ${dialog.adminOnly ? 'text-[var(--status-error-ink)]' : 'text-ui-background'}`}>
          <PopupKindBadge kind={dialog.kind === 'confirm' ? '확인' : '알림'} />
          <span>
            {dialog.title}
            {dialog.adminOnly && ' ⚠'}
          </span>
        </h2>
        <p id="app-dialog-message" className="mt-3 whitespace-pre-line break-keep text-sm leading-relaxed text-ui-background">{dialog.message}</p>
        <div className="mt-auto flex justify-end gap-2 pt-3">
          {dialog.kind === 'confirm' && (
            <button type="button" onClick={dismiss} className="rounded-lg border-0 bg-[var(--panel-gray)] px-4 py-2 text-sm text-ui-surface transition-colors hover:bg-ui-control-hover">
              취소
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => resolveCurrentAppDialog(true)}
            className={`rounded-lg border-0 px-4 py-2 text-sm font-bold text-ui-white transition-colors ${dialog.adminOnly ? 'bg-[var(--status-error-ink)] hover:bg-[var(--status-error-hover)]' : 'bg-[var(--brand-surface)] hover:bg-[var(--brand-surface-hover)]'}`}
          >
            {dialog.kind === 'confirm' ? '확인' : '닫기'}
          </button>
        </div>
      </section>
      </div>
    </div>
  )
}
