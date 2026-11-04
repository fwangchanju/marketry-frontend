import assert from 'node:assert/strict'
import test from 'node:test'
import { fontCssFor } from './captureFonts.ts'

class FakeFontFace {
  constructor(url) {
    this.cssText = `@font-face { src: url('${url}'); }`
    this.style = { getPropertyValue: name => ({ 'font-family': 'Test', 'font-weight': '400', 'unicode-range': 'U+20-7e' })[name] ?? '' }
  }
}

globalThis.CSSFontFaceRule = FakeFontFace
globalThis.Node = { TEXT_NODE: 3 }
globalThis.window = globalThis
globalThis.getComputedStyle = () => ({ fontWeight: '400' })
globalThis.FileReader = class {
  readAsDataURL() { this.result = 'data:font/woff2;base64,AA=='; this.onload() }
}
const root = { textContent: 'test', childNodes: [{ nodeType: 3, textContent: 'test' }], querySelectorAll: () => [] }
const faces = Array.from({ length: 55 }, (_, i) => new FakeFontFace(`/font-${i}.woff2`))
globalThis.document = { baseURI: 'http://localhost/', fonts: { ready: Promise.resolve() }, styleSheets: [{ cssRules: faces }] }

test('글꼴 요청이 제한을 넘지 않고 모든 조각을 삽입한다', async () => {
  const requests = []
  globalThis.fetch = async url => {
    const now = Date.now()
    requests.push(now)
    const recent = requests.filter(time => now - time < 1000).length
    if (recent > 20) return { ok: false, status: 429 }
    return { ok: true, blob: async () => new Blob([url]) }
  }
  const [css, secondCss] = await Promise.all([fontCssFor(root), fontCssFor(root)])
  assert.equal((css.match(/data:font\/woff2/g) ?? []).length, 55)
  assert.equal(secondCss, css)
  assert.equal(requests.length, 55)
})

test('429가 계속되면 일부 글꼴로 캡처하지 않고 실패를 알린다', async () => {
  const { fontCssFor: freshFontCssFor } = await import('./captureFonts.ts?failure')
  document.styleSheets = [{ cssRules: [new FakeFontFace('/unavailable.woff2')] }]
  let attempts = 0
  globalThis.fetch = async () => { attempts += 1; return { ok: false, status: 429 } }
  await assert.rejects(freshFontCssFor(root), /글꼴을 받지 못했습니다\(429\)/)
  assert.equal(attempts, 3)
})

test('일시적인 429 뒤에는 글꼴을 다시 받아 삽입한다', async () => {
  const { fontCssFor: freshFontCssFor } = await import('./captureFonts.ts?retry')
  document.styleSheets = [{ cssRules: [new FakeFontFace('/retry.woff2')] }]
  let attempts = 0
  globalThis.fetch = async () => {
    attempts += 1
    return attempts === 1 ? { ok: false, status: 429 } : { ok: true, blob: async () => new Blob(['font']) }
  }
  assert.match(await freshFontCssFor(root), /data:font\/woff2/)
  assert.equal(attempts, 2)
})
