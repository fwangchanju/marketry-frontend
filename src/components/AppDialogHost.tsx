import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { getCurrentAppDialog, resolveCurrentAppDialog, subscribeAppDialogs } from '@/utils/appDialogBus'
import { HINT_BUBBLE_COLOR_CLASS, POPUP_SIZE_CLASS } from './hintBubbleStyle'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'
import PopupKindBadge from './PopupKindBadge'
import { playDialogBlockedSound } from '@/utils/dialogSound'

export default function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeAppDialogs, getCurrentAppDialog, getCurrentAppDialog)
  const mainAreaRect = useMainAreaRect(dialog !== null)
  const sectionRef = useRef<HTMLElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const actionButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // 입력칸이 있는 창에서 적은 글자 — 창이 바뀔 때마다 비운다.
  const [inputValue, setInputValue] = useState('')
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!dialog) {
      previousFocusRef.current?.focus()
      previousFocusRef.current = null
      return
    }
    previousFocusRef.current ??= document.activeElement instanceof HTMLElement ? document.activeElement : null
    setInputValue('')
    const initialFocus = dialog.input ? inputRef : dialog.kind === 'alert' ? actionButtonRef : cancelButtonRef
    initialFocus.current?.focus()
  }, [dialog])

  useEffect(() => {
    if (!dialog) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        resolveCurrentAppDialog(false)
        return
      }
      if (event.key !== 'Tab') return
      const buttons = Array.from(sectionRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
      if (buttons.length === 0) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (!buttons.some(button => button === document.activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
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
  return createPortal((
    <div className="fixed inset-0 z-[100] bg-ui-background/70" onPointerDown={handleBlockedPointerDown}>
      {/* NXT 안내창과 같이 가로는 메인 영역 가운데, 세로는 전체 화면 가운데에 놓는다. */}
      <div
        className={`flex items-center justify-center p-4 ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
        style={mainAreaRect ? { left: mainAreaRect.left, top: 0, width: mainAreaRect.width, height: '100dvh' } : undefined}
      >
      <section
        ref={sectionRef}
        tabIndex={-1}
        onDragStart={event => event.preventDefault()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        // 색은 설정창 말풍선·NXT 안내창과 같은 크림색 계열이다.
        className={`select-none outline-none ${POPUP_SIZE_CLASS} ${HINT_BUBBLE_COLOR_CLASS}`}
      >
        <h2 id="app-dialog-title" className={`flex items-center text-base font-bold text-ui-background`}>
          <PopupKindBadge kind={dialog.kind === 'alert' ? '정보' : dialog.kind === 'warning' ? '주의' : '확인'} />
          <span>
            {dialog.title}
          </span>
        </h2>
        <p id="app-dialog-message" className="mt-3 whitespace-pre-line break-keep text-sm leading-relaxed text-ui-background">
          {dialog.message}
          {dialog.mutedMessage && <><br /><span className="text-[var(--ui-control)]">{dialog.mutedMessage}</span></>}
          {dialog.followupMessage && <><br />{dialog.followupMessage}</>}
        </p>
        {dialog.input && (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            maxLength={dialog.input.maxLength}
            placeholder={dialog.input.placeholder}
            aria-label={dialog.input.placeholder}
            // 한글처럼 글자를 조합하며 치는 입력은 maxLength를 넘는 한 글자가 조합 중에 잠깐 보인다 — 넘는 순간 바로 잘라 낸다.
            onChange={event => setInputValue(event.target.value.slice(0, dialog.input?.maxLength))}
            onKeyDown={event => {
              // 한글을 치는 중에 누른 엔터는 글자를 확정할 뿐이다 — 이때 확인으로 넘기지 않는다.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing && event.keyCode !== 229) resolveCurrentAppDialog(true, inputValue.trim())
            }}
            className="mt-3 h-8 w-full rounded border border-[var(--ui-control)] bg-white/70 px-2 text-sm text-ui-background outline-none placeholder:text-[var(--ui-control)] focus:border-[var(--brand)]"
          />
        )}
        <div className="mt-auto flex justify-end gap-2 pt-3">
          {dialog.kind !== 'alert' && (
            <button ref={cancelButtonRef} type="button" onClick={dismiss} className="rounded-lg border-0 bg-ui-selection px-4 py-2 text-sm text-ui-surface transition-colors hover:bg-ui-control-hover focus-visible:bg-ui-control-hover focus:outline-none">
              취소
            </button>
          )}
          <button
            ref={actionButtonRef}
            type="button"
            onClick={() => resolveCurrentAppDialog(true, dialog.input ? inputValue.trim() : undefined)}
            className={`rounded-lg border-0 px-4 py-2 text-sm font-bold focus:outline-none focus-visible:brightness-110 ${dialog.kind === 'warning' ? 'bg-[#BC2F2F] text-ui-white transition-[filter] hover:brightness-110' : dialog.kind === 'alert' ? 'bg-ui-selection text-ui-surface transition-colors hover:bg-ui-control-hover focus-visible:bg-ui-control-hover' : 'bg-brand-surface text-ui-white transition-colors hover:bg-brand-surface-hover'}`}
          >
            {dialog.kind === 'alert' ? '닫기' : '확인'}
          </button>
        </div>
      </section>
      </div>
    </div>
  ), document.body)
}
