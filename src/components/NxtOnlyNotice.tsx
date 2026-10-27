import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import PopupKindBadge from '@/components/PopupKindBadge'
import { HINT_BUBBLE_COLOR_CLASS, POPUP_SIZE_CLASS } from '@/components/hintBubbleStyle'
import type { TreemapSectorNode } from '@/types/api'
import { toCount } from '@/utils/format'
import { collectItems } from '@/utils/sectorAverage'
import type { NxtOnlyWindow } from '@/utils/tradingWindow'

interface Props {
  active: boolean
  window: NxtOnlyWindow | null
  ready: boolean
  nodes: TreemapSectorNode[]
}

// 팝업 위치는 페이지마다 같다 — 가로는 메인 영역(data-main-area)의 가운데, 세로는 전체 화면 높이의 중간이다. 부모 칸 기준으로 두면 페이지마다 칸이 달라 위치가 어긋난다.
// 메인 영역의 가로 위치와 폭은 설정창을 열고 닫거나 창 크기를 바꿀 때마다 다시 잰다.
function useMainAreaSpan(anchor: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [span, setSpan] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const mainArea = anchor.current?.closest<HTMLElement>('[data-main-area]')
    if (!enabled || !mainArea) return
    const measure = () => {
      const rect = mainArea.getBoundingClientRect()
      setSpan(previous => (previous && previous.left === rect.left && previous.width === rect.width ? previous : { left: rect.left, width: rect.width }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(mainArea)
    globalThis.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      globalThis.removeEventListener('resize', measure)
    }
  }, [anchor, enabled])
  return span
}

function Notice({ active, window, ready, nodes }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const titleId = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const shown = active && Boolean(window) && ready && !dismissed
  const span = useMainAreaSpan(anchorRef, shown)
  const stockTotal = useMemo(() => nodes.reduce((sum, node) => sum + collectItems(node).length, 0), [nodes])
  if (!active || !window || !ready || dismissed) return null
  return (
    <div
      ref={anchorRef}
      data-capture-ignore
      style={span ? { left: span.left, width: span.width } : { left: 0, right: 0 }}
      className="pointer-events-none fixed top-0 z-30 flex h-dvh items-center justify-center p-4"
    >
      <section role="status" aria-labelledby={titleId} className={`${HINT_BUBBLE_COLOR_CLASS} ${POPUP_SIZE_CLASS} pointer-events-auto select-none`}>
        <h2 id={titleId} className="flex items-center text-base font-bold text-ui-background"><PopupKindBadge kind="정보" />{window.fromMinutes < 12 * 60 ? '프리 마켓' : '애프터 마켓'}</h2>
        <p className="mt-3 break-keep text-sm leading-relaxed text-ui-background">
          {window.label.replace(/ /g, '')}에는 NXT 종목만 표시됩니다.
          <br />
          <span className="text-[var(--ui-control)]">(총 {toCount(stockTotal)}종목이며, 설정에 따라 다를 수 있습니다.)</span>
          {window.fromMinutes >= 12 * 60 && <><br />종가 확인은 상단 애프터 마켓 배지 우측 버튼을 이용하세요.</>}
        </p>
        <div className="mt-auto flex justify-end pt-3">
          <button type="button" onClick={() => setDismissed(true)} className="rounded-lg border-0 bg-ui-selection px-4 py-2 text-sm font-bold text-ui-surface transition-colors hover:bg-ui-control-hover">닫기</button>
        </div>
      </section>
    </div>
  )
}

// 페이지 진입과 NXT 단독 시간대 전환마다 닫기 상태를 새로 시작한다.
export default function NxtOnlyNotice(props: Props) {
  const location = useLocation()
  return <Notice key={`${location.key}:${props.active ? props.window?.label : 'off'}`} {...props} />
}
