import { SUMMARY_CAPTURE_FRAME_WIDTH } from '@/utils/screenshotToPreview'

export const TOOLBAR_SIDE_GUTTER = 6
// px-3(0.75rem)과 p-1(0.25rem)은 rem 기반이라 480px 이하에서 루트 글자 크기가 80%로 줄면 함께 작아진다.
// 계산값을 쓰지 않으면 좁은 폭에서 막대가 툴바 첫 배지 왼쪽에 닿지 않는다.
function remPixels(rem: number) {
  return rem * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)
}
const PATH_NAV_LEFT_PADDING_REM = 0.75
const SECTION_LEFT_PADDING_REM = 0.25
// 390px MOBILE에서 보던 경로 줄(글자 16px·줄 32px)을 810px 판 기준으로 옮기는 배율.
// 그래프 글자처럼 판 배율에 따라 함께 줄어들게 경로 줄에도 같은 판 좌표를 쓴다.
const MOBILE_REFERENCE_WIDTH = 390
export const MOBILE_PATH_CANVAS_ZOOM = SUMMARY_CAPTURE_FRAME_WIDTH / MOBILE_REFERENCE_WIDTH

// MOBILE 판 안의 경로 줄 맨 앞 막대를 위 툴바 첫 배지 왼쪽에 맞추기 위한 가로 이동량(px).
// framePadding은 판 바깥 여백(일반 화면 4px, 서머리의 그래프 미리보기 8px)이다. 세로는 바꾸지 않는다.
// 경로 줄은 판 기준 배율로 그려진 뒤 판 배율까지 곱해지므로 판 여백은 그 배율로 나누고,
// 화면에서 6px이 되어야 하는 툴바 여백은 전체 배율로 나눠 판 좌표로 바꾼다.
export function mobilePathBarLeftShift(framePadding: number) {
  const panelScale = window.innerWidth / SUMMARY_CAPTURE_FRAME_WIDTH
  const pathScale = MOBILE_PATH_CANVAS_ZOOM * panelScale
  return (framePadding + remPixels(SECTION_LEFT_PADDING_REM)) / MOBILE_PATH_CANVAS_ZOOM
    + remPixels(PATH_NAV_LEFT_PADDING_REM)
    - TOOLBAR_SIDE_GUTTER / pathScale
}
