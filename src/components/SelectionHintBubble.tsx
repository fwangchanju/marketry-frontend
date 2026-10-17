import { CloseIcon } from '@/components/icons/AppIcons'
import { HINT_BUBBLE_COLOR_CLASS } from '@/components/hintBubbleStyle'

// 여러 줄 선택 안내 — 표 아래쪽 가운데에 잠깐 뜬다. 보이는 쪽(표 영역)이 relative여야 한다.
// 모양은 다른 페이지의 말풍선(크림색 바탕, 강조는 빨간 굵은 글씨)과 같다.
export default function SelectionHintBubble({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      className={`absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 px-4 py-2 text-sm ${HINT_BUBBLE_COLOR_CLASS}`}
    >
      <span>
        여러 줄은 <b className="text-status-error-ink">드래그</b>하거나 <b className="text-status-error-ink">Shift + 클릭</b>으로 한 번에 선택할 수 있어요.
      </span>
      <button type="button" onClick={onClose} aria-label="안내 닫기" className="border-0 bg-transparent p-0 text-ui-muted hover:text-ui-background">
        <CloseIcon strokeWidth={2.3} className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
