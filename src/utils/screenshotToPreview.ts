import { domToPng } from 'modern-screenshot'
import { shareScreenshotOptions } from './screenshotScale'

// 공유 이미지는 긴 변이 1280px이 되게 찍고, 작은 박스의 글자는 뺀다(screenshotScale.ts 참고).
export async function screenshotElementToDataUrl(el: HTMLElement): Promise<string> {
  return domToPng(el, shareScreenshotOptions(el))
}
