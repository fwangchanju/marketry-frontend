import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.tsx'
import queryClient from './api/queryClient.ts'
import { resetGuestSettingsOnLoad } from './utils/guestSettingsReset.ts'
import { applyMobileTheme, readMobileTheme } from './utils/mobileTheme.ts'

// 훅이 처음 그려지며 저장값을 읽기 전에 먼저 지운다.
resetGuestSettingsOnLoad()
// 첫 화면이 깜박이지 않게 저장된 모바일 모드를 그리기 전에 적용한다.
applyMobileTheme(readMobileTheme())

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
