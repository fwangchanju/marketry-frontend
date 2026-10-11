import { useEffect, useSyncExternalStore } from 'react'
import { getCurrentAppDialog, resolveCurrentAppDialog, subscribeAppDialogs } from '@/utils/appDialogBus'
import { HINT_BUBBLE_COLOR_CLASS } from './hintBubbleStyle'
import { useMainAreaRect } from '@/hooks/useMainAreaRect'

export default function AppDialogHost() {
  const dialog = useSyncExternalStore(subscribeAppDialogs, getCurrentAppDialog, getCurrentAppDialog)
  const mainAreaRect = useMainAreaRect(dialog !== null)

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

  // 바깥(어두운 배경)을 눌러도 닫히지 않는다 — 반드시 버튼이나 Esc로 답해야 한다.
  return (
    <div className="fixed inset-0 z-[100] bg-black/70">
      {/* 어두운 배경은 화면 전체를 덮고, 창은 메인 영역 안의 가운데에 놓는다. */}
      <div
        className={`flex items-center justify-center p-4 ${mainAreaRect ? 'absolute' : 'h-full w-full'}`}
        style={mainAreaRect ? { left: mainAreaRect.left, top: mainAreaRect.top, width: mainAreaRect.width, height: mainAreaRect.height } : undefined}
      >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="app-dialog-title"
        aria-describedby="app-dialog-message"
        // 색은 설정창 말풍선·NXT 안내창과 같은 크림색 계열이다.
        className={`w-full max-w-sm p-5 ${HINT_BUBBLE_COLOR_CLASS} ${dialog.adminOnly ? 'border-[3px] border-[#ff4d2e]' : ''}`}
      >
        <h2 id="app-dialog-title" className={`text-base font-bold ${dialog.adminOnly ? 'text-[#d92b0f]' : 'text-black'}`}>
          {dialog.adminOnly && '⚠ '}
          {dialog.kind === 'confirm' ? '확인' : '안내'}
        </h2>
        {dialog.adminOnly && (
          <p className="mt-2 bg-[#ff4d2e] px-2 py-1 text-[13px] font-bold text-white">ADMIN 전용 · 모든 사용자 화면에 바로 반영됩니다</p>
        )}
        <p id="app-dialog-message" className="mt-3 whitespace-pre-line break-keep text-sm leading-relaxed text-black">{dialog.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          {dialog.kind === 'confirm' && (
            <button type="button" onClick={dismiss} className="nes-btn border-gray-600 bg-black px-4 py-2 text-sm text-white hover:bg-gray-800">
              취소
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => resolveCurrentAppDialog(true)}
            className={`nes-btn px-4 py-2 text-sm font-bold ${dialog.adminOnly ? 'border-[#ff4d2e] bg-[#ff4d2e] text-white hover:bg-[#e03a1c]' : 'border-[var(--accent)] bg-[var(--accent)] text-black hover:bg-[var(--accent-hover)]'}`}
          >
            {dialog.kind === 'confirm' ? '확인' : '닫기'}
          </button>
        </div>
      </section>
      </div>
    </div>
  )
}
