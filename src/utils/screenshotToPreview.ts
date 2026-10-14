import { domToPng } from 'modern-screenshot'
import { shareScreenshotOptions } from './screenshotScale'

// 공유 이미지는 긴 변이 1280px이 되게 찍고, 작은 박스의 글자는 뺀다(screenshotScale.ts 참고).
// regionSelector를 주면 맨 왼쪽부터 그 요소의 오른쪽 끝까지만 찍는다.
export async function screenshotElementToDataUrl(el: HTMLElement, regionSelector?: string): Promise<string> {
  return domToPng(el, shareScreenshotOptions(el, regionSelector))
}
