import type { ReactNode } from 'react'
import DisclaimerNotice from '@/components/DisclaimerNotice'

// 모든 페이지에서 면책 문구와 링크를 동일한 28px 하단 줄에 배치한다.
export default function DisclaimerFooter({ rightContent, captureFullWidthAlign = false }: { rightContent?: ReactNode; captureFullWidthAlign?: boolean }) {
  return (
    <div data-capture-full-width-align={captureFullWidthAlign ? '' : undefined} className="flex h-7 shrink-0 items-end justify-between gap-3">
      <div className="flex h-7 min-w-0 items-end">
        <DisclaimerNotice />
      </div>
      {rightContent}
    </div>
  )
}
