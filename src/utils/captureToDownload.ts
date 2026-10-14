import { domToPng } from 'modern-screenshot'
import { shareCaptureOptions } from './captureScale'
import { waitForNextPaint } from './captureToClipboard'
import { fileTimestamp } from './fileTimestamp'

// 스크린샷 내려받기 파일 이름 — 화면이름-년월일_시분초.png (예: MAP-20261008_004512.png).
export function captureFileName(page: 'MAP' | 'GROUP' | 'CUSTOM' | 'HOME', now: Date = new Date()): string {
  return `${page}-${fileTimestamp(now)}.png`
}

// 공유창 미리보기로 이미 찍어 둔 이미지를 그대로 내려받는다 — 같은 영역을 다시 찍지 않는다.
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export async function captureElementToDownload(el: HTMLElement, filename: string): Promise<void> {
  await waitForNextPaint()
  const dataUrl = await domToPng(el, shareCaptureOptions(el))
  downloadDataUrl(dataUrl, filename)
}
