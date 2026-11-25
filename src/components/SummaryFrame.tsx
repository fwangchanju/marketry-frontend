import { type CSSProperties, type ReactNode, type RefObject, useState } from 'react'
import { DndContext, closestCenter, type DndContextProps } from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FRAME_BADGE_CLASS } from '@/utils/frameBadge'
import { SUMMARY_CAPTURE_FRAME_HEIGHT } from '@/utils/screenshotToPreview'

type BadgeStyle = { badgeClassName?: string; badgeStyle?: CSSProperties }

// 서머리의 틀 — 제목 배지를 끌어서 순서를 바꾼다. 배지 색만 값으로 받고 시장 이름은 모른다.
// 호버 상태는 두 틀을 감싼 조립이 갖는다 — 한쪽 배지에 올려도 양쪽 선이 함께 보인다.
export function SortableSummaryFrame({ title, captureId, index, children, captureUntil, showBorder, onBadgeHover, badgeClassName, badgeStyle }: { title: string; captureId: string; index: number; children: ReactNode; captureUntil?: string; showBorder: boolean; onBadgeHover: (hovered: boolean) => void } & BadgeStyle) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: title })
  const dragBadge = <span ref={setActivatorNodeRef} {...attributes} {...listeners} data-hint="끌어서 항목 순서 변경" onMouseEnter={() => onBadgeHover(true)} onMouseLeave={() => onBadgeHover(false)} style={badgeStyle} className={`${badgeClassName ?? FRAME_BADGE_CLASS} cursor-grab active:cursor-grabbing`}>{title}</span>
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      data-capture-until={captureUntil}
      style={{ order: index, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.7 : undefined }}
      className="home-summary-frame relative flex h-full min-w-[320px] flex-1 basis-0 flex-col bg-ui-background"
    >
      {/* 두 틀 사이 간격은 4px — 오른쪽 틀의 왼쪽 여백만 둔다. */}
      <div data-capture-frame={captureId} className={`flex min-h-0 flex-1 flex-col bg-ui-background ${index === 0 ? 'pl-0 pr-0' : 'pl-1 pr-0'}`}>
        <div className={`flex min-h-0 flex-1 flex-col border bg-ui-background ${showBorder ? 'border-ui-border' : 'border-transparent'}`}>
          <div className="relative z-[6] flex h-6 min-h-6 shrink-0 items-center">
            {dragBadge}
          </div>
          <div className="mt-0.5 flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </div>
    </section>
  )
}

// 3:4 캡처용 판의 틀 — SortableSummaryFrame의 안쪽 틀과 같은 모양이다(끌기·정렬 없이 고정).
export function CaptureFrame({ title, className = '', children, badgeClassName, badgeStyle }: { title: string; className?: string; children: ReactNode } & BadgeStyle) {
  return (
    <div className={`flex min-h-0 flex-col rounded-sm border border-transparent bg-ui-background ${className}`}>
      <div className="relative z-[6] flex h-6 min-h-6 shrink-0 items-center">
        <span style={badgeStyle} className={badgeClassName ?? FRAME_BADGE_CLASS}>{title}</span>
      </div>
      <div className="mt-0.5 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export type SummaryFrameItem = { title: string; captureId: string; children: ReactNode }

// 화면의 두 틀에 내용을 넣는 조립 — 한국·일본·미국 서머리가 같은 코드를 쓴다.
export function SummaryScreenFrames({ frames, badgeClassName, badgeStyle }: { frames: SummaryFrameItem[] } & BadgeStyle) {
  const [badgeHovered, setBadgeHovered] = useState(false)
  return (
    <div data-capture-full-width className="flex min-h-0 min-w-full flex-1 bg-ui-background">
      {frames.map((frame, index) => (
        <SortableSummaryFrame key={frame.title} title={frame.title} captureId={frame.captureId} index={index} captureUntil={index === 1 ? '' : undefined} showBorder={badgeHovered} onBadgeHover={setBadgeHovered} badgeClassName={badgeClassName} badgeStyle={badgeStyle}>
          {frame.children}
        </SortableSummaryFrame>
      ))}
    </div>
  )
}

// 순서 끌기까지 감싼 화면 틀 조립. 한국·일본·미국 서머리가 같은 감지기·충돌 판정·순서 목록을 쓰게 한다.
// 스크롤을 푸는 조건은 시장별로 다르므로 이 조립 밖에 둔다.
export function SortableSummaryScreenFrames({ frames, order, sensors, onDragEnd, badgeClassName, badgeStyle }: {
  frames: SummaryFrameItem[]
  order: string[]
  sensors: DndContextProps['sensors']
  onDragEnd: DndContextProps['onDragEnd']
} & BadgeStyle) {
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={horizontalListSortingStrategy}>
        <SummaryScreenFrames frames={frames} badgeClassName={badgeClassName} badgeStyle={badgeStyle} />
      </SortableContext>
    </DndContext>
  )
}

// 화면 밖에 숨겨 둔 캡처판 — 두 서머리가 같은 크기·스타일·툴바를 쓰고, 프레임 목록만 시장별로 받는다.
export function HiddenSummaryCaptureFrames({ captureRef, frameCount, frames, toolbar, frameWidth, badgeClassName, badgeStyle }: {
  captureRef: RefObject<HTMLDivElement | null>
  frameCount: number
  frames: SummaryFrameItem[]
  toolbar: ReactNode
  frameWidth: number
} & BadgeStyle) {
  return (
    <div ref={captureRef} aria-hidden="true" data-summary-fixed-capture className="fixed flex flex-col bg-ui-background" style={{ left: 0, top: 0, width: frameWidth * frameCount, height: SUMMARY_CAPTURE_FRAME_HEIGHT, opacity: 0, pointerEvents: 'none' }}>
      <SummaryCaptureFrames frames={frames} toolbar={toolbar} frameWidth={frameWidth} badgeClassName={badgeClassName} badgeStyle={badgeStyle} />
    </div>
  )
}

// 캡처용 두 틀에 내용을 넣는 조립 — 화면과 같은 순서·내용을 쓰고, 틀별 차이는 값으로 받는다.
export function SummaryCaptureFrames({ frames, toolbar, frameWidth, captureFrameClassName = 'min-h-0 flex-1', badgeClassName, badgeStyle }: { frames: SummaryFrameItem[]; toolbar: ReactNode; frameWidth: number; captureFrameClassName?: string } & BadgeStyle) {
  return (
    <div className="flex min-h-0 flex-1 bg-ui-background">
      {frames.map(frame => (
        <div key={frame.title} data-capture-fixed-frame={frame.captureId} data-capture-frame={frame.captureId} className="flex h-full shrink-0 flex-col bg-ui-background p-1" style={{ width: frameWidth }}>
          {toolbar}
          <CaptureFrame title={frame.title} className={captureFrameClassName} badgeClassName={badgeClassName} badgeStyle={badgeStyle}>
            {frame.children}
          </CaptureFrame>
        </div>
      ))}
    </div>
  )
}
