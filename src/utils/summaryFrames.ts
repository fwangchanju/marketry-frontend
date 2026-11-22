// 서머리 두 틀의 제목과 캡처 이름. 화면 틀·고정 캡처판·캡처창 선택지가 같은 쌍을 쓰게 한다.
// 시장별로 내용은 다르지만 틀의 이름과 캡처 대상은 같다.
export const MARKET_MAP_FRAME = { title: '업종 지도', captureId: 'market-map' } as const
export const GROUP_CHANGE_FRAME = { title: '그룹 등락률 (%)', captureId: 'group-change-rate' } as const

export const SUMMARY_FRAMES = [MARKET_MAP_FRAME, GROUP_CHANGE_FRAME] as const
export const SUMMARY_FRAME_TITLES = SUMMARY_FRAMES.map(frame => frame.title)

export function captureIdForFrameTitle(title: string): string {
  return SUMMARY_FRAMES.find(frame => frame.title === title)?.captureId ?? ''
}

// 캡처창의 틀 선택지. 두 서머리가 같은 순서 값과 같은 셀렉터 규칙을 쓴다.
export function frameCaptureOptionsFor(titles: readonly string[]) {
  return titles.map((title, selectedSlot) => {
    const captureId = captureIdForFrameTitle(title)
    return {
      id: captureId,
      label: ['좌측', '우측'][selectedSlot],
      selector: `[data-capture-frame="${captureId}"]`,
      selectedSlot: selectedSlot as 0 | 1,
      mode: 'content' as const,
    }
  })
}
