import { KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useLocalPersistedState } from '@/hooks/useLocalPersistedState'
import { SUMMARY_FRAME_TITLES } from '@/utils/summaryFrames'

const SUMMARY_FRAME_ORDER_KEY = 'marketry-home-frame-order'
const DEFAULT_SUMMARY_FRAME_ORDER: string[] = [...SUMMARY_FRAME_TITLES]

// 서머리 두 틀의 순서를 기억하고 끌어서 바꾸는 부분. 한국·일본·미국 서머리가 같은 값과 같은 동작을 쓴다.
export function useSummaryFrameOrder() {
  const frameSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const [summaryFrameOrder, setSummaryFrameOrder] = useLocalPersistedState(SUMMARY_FRAME_ORDER_KEY, DEFAULT_SUMMARY_FRAME_ORDER)
  // 예전 이름('시장 지도'·'요약 지도')으로 저장된 순서도 새 이름('업종 지도')의 같은 자리로 읽는다.
  const savedSummaryFrameOrder = summaryFrameOrder.map(title => (title === '시장 지도' || title === '요약 지도' ? '업종 지도' : title))
  const safeSummaryFrameOrder = [
    ...savedSummaryFrameOrder.filter((title, index) => DEFAULT_SUMMARY_FRAME_ORDER.includes(title) && savedSummaryFrameOrder.indexOf(title) === index),
    ...DEFAULT_SUMMARY_FRAME_ORDER.filter(title => !savedSummaryFrameOrder.includes(title)),
  ]
  const handleFrameDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = safeSummaryFrameOrder.indexOf(String(active.id))
    const to = safeSummaryFrameOrder.indexOf(String(over.id))
    if (from >= 0 && to >= 0) setSummaryFrameOrder(arrayMove(safeSummaryFrameOrder, from, to))
  }
  const orderFrames = <T extends { title: string }>(frames: T[]): T[] =>
    [...frames].sort((a, b) => safeSummaryFrameOrder.indexOf(a.title) - safeSummaryFrameOrder.indexOf(b.title))
  return { frameSensors, safeSummaryFrameOrder, handleFrameDragEnd, orderFrames }
}
