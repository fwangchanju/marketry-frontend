// modern-screenshot의 기본 sandbox는 iframe의 srcdoc를 지정한 직후 body를 쓰려 해 간헐적으로 null이 된다.
// 캡처 전에 body가 준비된 iframe을 넘겨 그 경쟁 상태를 막는다.
export async function withScreenshotSandbox<T>(ownerDocument: Document, capture: (sandbox: HTMLIFrameElement) => Promise<T>): Promise<T> {
  const sandbox = ownerDocument.createElement('iframe')
  sandbox.width = '0'
  sandbox.height = '0'
  sandbox.style.visibility = 'hidden'
  sandbox.style.position = 'fixed'
  sandbox.srcdoc = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body data-screenshot-sandbox-ready></body></html>'

  let animationFrame = 0
  let timeoutId = 0
  try {
    if (!ownerDocument.body || !ownerDocument.defaultView) throw new Error('Screenshot sandbox owner document is unavailable')

    await new Promise<void>((resolve, reject) => {
      const view = ownerDocument.defaultView!
      const checkReady = () => {
        if (sandbox.contentDocument?.body?.hasAttribute('data-screenshot-sandbox-ready')) {
          view.clearTimeout(timeoutId)
          resolve()
          return
        }
        animationFrame = view.requestAnimationFrame(checkReady)
      }
      timeoutId = view.setTimeout(() => reject(new Error('Screenshot sandbox did not become ready')), 5000)
      ownerDocument.body!.appendChild(sandbox)
      checkReady()
    })

    return await capture(sandbox)
  } finally {
    ownerDocument.defaultView?.clearTimeout(timeoutId)
    if (animationFrame) ownerDocument.defaultView?.cancelAnimationFrame(animationFrame)
    sandbox.remove()
  }
}
