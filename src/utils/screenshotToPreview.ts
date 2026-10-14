import { domToPng } from 'modern-screenshot'
import { captureRegionRect, shareScreenshotOptions } from './screenshotScale'
import { trimToContent } from './screenshotTrim'

// 영역만 찍은 이미지의 사방 여백(CSS px) — 틀 두 개를 찍을 때 아래쪽 여백(틀 아래 끝과 면책 문구 윗변 사이)과 같은 폭이다.
const REGION_MARGIN_CSS_PX = 4

// 공유 이미지는 긴 변이 1280px이 되게 찍고, 작은 박스의 글자는 뺀다(screenshotScale.ts 참고).
// regionSelector를 주면 그 요소들이 차지한 영역만 찍고, 내용 기준으로 사방 여백을 같게 맞춘다.
export async function screenshotElementToDataUrl(el: HTMLElement, regionSelector?: string): Promise<string> {
  const options = shareScreenshotOptions(el, regionSelector)
  const dataUrl = await domToPng(el, options)
  if (!regionSelector || !captureRegionRect(el, regionSelector)) return dataUrl
  return trimToContent(dataUrl, REGION_MARGIN_CSS_PX * options.scale)
}
