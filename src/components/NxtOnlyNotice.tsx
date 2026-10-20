import { useId, useMemo, useState } from 'react'
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

function Notice({ active, window, ready, nodes }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const titleId = useId()
  const stockTotal = useMemo(() => nodes.reduce((sum, node) => sum + collectItems(node).length, 0), [nodes])
  if (!active || !window || !ready || dismissed) return null
  return (
    <div data-capture-ignore className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center p-4">
      <section role="status" aria-labelledby={titleId} className={`${HINT_BUBBLE_COLOR_CLASS} ${POPUP_SIZE_CLASS} pointer-events-auto select-none`}>
        <h2 id={titleId} className="flex items-center text-base font-bold text-ui-background"><PopupKindBadge kind="안내" />{window.fromMinutes < 12 * 60 ? '프리 마켓' : '애프터 마켓'}</h2>
        <p className="mt-3 break-keep text-sm leading-relaxed text-ui-background">
          {window.label.replace(/ /g, '')}에는 NXT 거래 가능 종목만 표시됩니다.
          <br />
          <span className="text-ui-muted">최대 {toCount(stockTotal)}종목이며, 설정에 따라 다를 수 있습니다.</span>
          {window.fromMinutes >= 12 * 60 && <><br /><span className="text-ui-muted">메인 마켓 종가는 상단 종가 버튼으로 확인하세요.</span></>}
        </p>
        <div className="mt-auto flex justify-end pt-3">
          <button type="button" onClick={() => setDismissed(true)} className="rounded-lg border-0 bg-[var(--brand-surface)] px-4 py-2 text-sm font-bold text-ui-white transition-colors hover:bg-[var(--brand-surface-hover)]">닫기</button>
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
