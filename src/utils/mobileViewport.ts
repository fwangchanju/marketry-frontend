// MOBILE에서 실제로 보이는 화면 영역. 두 손가락으로 화면을 확대·이동하면 window.innerWidth/innerHeight는 그대로지만
// visualViewport의 크기와 시작점이 바뀐다. 팝업·하단 설정 줄은 이 영역을 기준으로 놓는다.
// pageLeft/pageTop은 문서 좌표라 absolute로 붙이는 MOBILE 팝업과 같은 기준을 쓴다. 없는 브라우저는 스크롤+오프셋으로 대신한다.
export function mobileViewport() {
  const vv = window.visualViewport
  return {
    left: vv?.pageLeft ?? window.scrollX + (vv?.offsetLeft ?? 0),
    top: vv?.pageTop ?? window.scrollY + (vv?.offsetTop ?? 0),
    width: vv?.width ?? window.innerWidth,
    height: vv?.height ?? window.innerHeight,
    scale: vv?.scale ?? 1,
  }
}
