import { type CSSProperties, type ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { FRAME_BADGE_CLASS } from '@/components/FrameBadge'

type BadgeStyle = { badgeClassName?: string; badgeStyle?: CSSProperties }

// 서머리의 틀 — 제목 배지를 끌어서 순서를 바꾼다. 배지 색만 값으로 받고 시장 이름은 모른다.
export function SortableSummaryFrame({ title, captureId, index, children, captureUntil, badgeClassName, badgeStyle }: { title: string; captureId: string; index: number; children: ReactNode; captureUntil?: string } & BadgeStyle) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: title })
  const dragBadge = <span ref={setActivatorNodeRef} {...attributes} {...listeners} data-hint="끌어서 항목 순서 변경" style={badgeStyle} className={`${badgeClassName ?? FRAME_BADGE_CLASS} cursor-grab active:cursor-grabbing`}>{title}</span>
  return (
    <section
      ref={setNodeRef}
      aria-label={title}
      data-capture-until={captureUntil}
      style={{ order: index, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 20 : undefined, opacity: isDragging ? 0.7 : undefined }}
      className="home-summary-frame relative flex h-full min-w-[320px] flex-1 basis-0 flex-col bg-ui-background"
    >
      {/* 두 틀의 너비가 같다 — 틀 사이(안쪽)만 4px씩 띄우고 바깥쪽은 0이라 내용 폭이 같다. */}
      <div data-capture-frame={captureId} className={`flex min-h-0 flex-1 flex-col bg-ui-background ${index === 0 ? 'pl-0 pr-1' : 'pl-1 pr-0'}`}>
        <div className="flex min-h-0 flex-1 flex-col rounded-sm border border-ui-border bg-ui-background px-[7px] py-[7px]">
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
    <div className={`flex min-h-0 flex-col rounded-sm border border-transparent bg-ui-background pb-1.5 pl-[7px] pr-[7px] pt-[7px] ${className}`}>
      <div className="relative z-[6] flex h-6 min-h-6 shrink-0 items-center">
        <span style={badgeStyle} className={badgeClassName ?? FRAME_BADGE_CLASS}>{title}</span>
      </div>
      <div className="mt-0.5 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export type SummaryFrameItem = { title: string; captureId: string; children: ReactNode }

// 화면의 두 틀에 내용을 넣는 조립 — 한국·해외 서머리가 같은 코드를 쓴다.
export function SummaryScreenFrames({ frames, badgeClassName, badgeStyle }: { frames: SummaryFrameItem[] } & BadgeStyle) {
  return (
    <div data-capture-full-width className="flex min-h-0 min-w-full flex-1 bg-ui-background">
      {frames.map((frame, index) => (
        <SortableSummaryFrame key={frame.title} title={frame.title} captureId={frame.captureId} index={index} captureUntil={index === 1 ? '' : undefined} badgeClassName={badgeClassName} badgeStyle={badgeStyle}>
          {frame.children}
        </SortableSummaryFrame>
      ))}
    </div>
  )
}

// 캡처용 두 틀에 내용을 넣는 조립 — 화면과 같은 순서·내용을 쓰고, 틀별 차이는 값으로 받는다.
export function SummaryCaptureFrames({ frames, toolbar, frameWidth, captureFrameClassName, badgeClassName, badgeStyle }: { frames: SummaryFrameItem[]; toolbar: ReactNode; frameWidth: number; captureFrameClassName?: string } & BadgeStyle) {
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
