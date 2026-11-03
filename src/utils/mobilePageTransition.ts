import type { NavigateFunction } from 'react-router-dom'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export function navigateWithMobileSlide(navigate: NavigateFunction, to: string) {
  const viewTransitionDocument = document as ViewTransitionDocument
  if (!viewTransitionDocument.startViewTransition) {
    navigate(to)
    return
  }

  document.documentElement.dataset.mobilePageSlide = 'next'
  try {
    const transition = viewTransitionDocument.startViewTransition(() => {
      navigate(to, { flushSync: true })
    })
    const clearTransitionDirection = () => {
      delete document.documentElement.dataset.mobilePageSlide
    }
    void transition.finished.then(clearTransitionDirection, clearTransitionDirection)
  } catch {
    delete document.documentElement.dataset.mobilePageSlide
    navigate(to)
  }
}
