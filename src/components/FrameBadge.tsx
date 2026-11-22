import type { ReactNode } from 'react'
import { FRAME_BADGE_CLASS } from '@/utils/frameBadge'

export default function FrameBadge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${FRAME_BADGE_CLASS} ${className}`}>{children}</span>
}
