import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import queryClient from './api/queryClient.ts'
import { resetGuestSettingsOnLoad } from './utils/guestSettingsReset.ts'

// 사이트 조작은 마우스·터치로만 한다. React와 팝업의 전역 키 처리보다 먼저 차단한다.
// 검색·이름 편집 같은 문자 입력과 브라우저 자체 단축키는 유지한다.
const controlKeys = new Set([
  'Tab', 'Enter', ' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'PageUp', 'PageDown', 'Backspace',
])
const blockKeyboardControls = (event: KeyboardEvent) => {
  const target = event.target
  const textInput = target instanceof HTMLInputElement
    && ['text', 'search', 'email', 'url', 'tel', 'password', 'number'].includes(target.type)
  const multiline = target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable)
  if ((textInput || multiline) && event.key !== 'Tab' && event.key !== 'Escape'
    && (event.key !== 'Enter' || multiline)) return

  event.stopImmediatePropagation()
  const browserShortcut = event.metaKey || event.ctrlKey || event.altKey
  const rangeInput = target instanceof HTMLInputElement && target.type === 'range'
  if (controlKeys.has(event.key) && (!browserShortcut || rangeInput || event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault()
  }
}
window.addEventListener('keydown', blockKeyboardControls, true)
window.addEventListener('keyup', blockKeyboardControls, true)
import.meta.hot?.dispose(() => {
  window.removeEventListener('keydown', blockKeyboardControls, true)
  window.removeEventListener('keyup', blockKeyboardControls, true)
})

// 훅이 처음 그려지며 저장값을 읽기 전에 먼저 지운다.
resetGuestSettingsOnLoad()

async function enableMocking() {
  if (import.meta.env.MODE !== 'mock') return
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </StrictMode>,
  )
})
