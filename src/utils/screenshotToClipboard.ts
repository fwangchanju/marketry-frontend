import { domToBlob } from 'modern-screenshot'
import { shareScreenshotOptions } from './screenshotScale'

// domToBlob/domToPng이 무거워서 호출 직후 바로 시작하면, 그 직전에 호출한 setState(예: "복사 중"
// 스피너 표시)가 화면에 그려질 새도 없이 메인 스레드가 막혀버린다 — 두 번의 requestAnimationFrame으로
// 한 번 페인트된 뒤에 무거운 작업을 시작한다(ScreenshotModal 미리보기 스크린샷과 동일한 패턴).
export function waitForNextPaint(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

export async function screenshotElementToClipboard(el: HTMLElement): Promise<void> {
  await waitForNextPaint()
  const blob = await domToBlob(el, shareScreenshotOptions(el))
  if (!blob) throw new Error('스크린샷을 찍지 못했습니다')
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

// 공유창 미리보기로 이미 찍어 둔 이미지를 그대로 복사한다 — 같은 영역을 다시 찍지 않으므로 바로 끝난다.
export async function copyDataUrlToClipboard(dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
