import { useState } from 'react'
import { copyDataUrlToClipboard, screenshotElementToClipboard } from '@/utils/screenshotToClipboard'

type CopyStatus = 'idle' | 'copying' | 'copied' | 'error'

// 서머리 화면과 캡처창이 같은 열기·복사 상태를 쓰게 한다.
// 미리보기 이미지가 있으면 그걸 복사하고, 없으면 창을 열 때 기억한 메인 영역을 복사한다.
export function useScreenshotShare() {
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const [isWhole, setIsWhole] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const open = (element: HTMLElement | null, whole = false) => {
    setTarget(element)
    setIsWhole(whole)
  }
  const close = () => setTarget(null)

  const copy = async (previewSrc?: string | null) => {
    if (!previewSrc && !target) return
    setCopyStatus('copying')
    try {
      if (previewSrc) await copyDataUrlToClipboard(previewSrc)
      else if (target) await screenshotElementToClipboard(target)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    } finally {
      setTimeout(() => setCopyStatus('idle'), 2000)
    }
  }

  const copyLabel = copyStatus === 'copying' ? 'Copying' : copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Failed' : 'Copy'

  return { target, isOpen: target !== null, isWhole, open, close, copy, copyLabel, isCopying: copyStatus === 'copying' }
}
