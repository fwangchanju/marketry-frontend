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

// 브라우저 캐시 확인 요청이면 캐시에 없다고(504) 답한다.
const uncached = handler => async (url, init) => (init?.cache === 'only-if-cached' ? { ok: false, status: 504 } : handler(url, init))

test('글꼴 요청이 제한을 넘지 않고 모든 조각을 삽입한다', async () => {
  const requests = []
  globalThis.fetch = uncached(async url => {
    const now = Date.now()
    requests.push(now)
    const recent = requests.filter(time => now - time < 1000).length
    if (recent > 20) return { ok: false, status: 429 }
    return { ok: true, blob: async () => new Blob([url]) }
  })
  const [css, secondCss] = await Promise.all([fontCssFor(root), fontCssFor(root)])
  assert.equal((css.match(/data:font\/woff2/g) ?? []).length, 55)
  assert.equal(secondCss, css)
  assert.equal(requests.length, 55)
})

test('429가 계속되면 일부 글꼴로 캡처하지 않고 실패를 알린다', async () => {
  const { fontCssFor: freshFontCssFor } = await import('./captureFonts.ts?failure')
  document.styleSheets = [{ cssRules: [new FakeFontFace('/unavailable.woff2')] }]
  let attempts = 0
  globalThis.fetch = uncached(async () => { attempts += 1; return { ok: false, status: 429 } })
  await assert.rejects(freshFontCssFor(root), /글꼴을 받지 못했습니다\(429\)/)
  assert.equal(attempts, 3)
})

test('일시적인 429 뒤에는 글꼴을 다시 받아 삽입한다', async () => {
  const { fontCssFor: freshFontCssFor } = await import('./captureFonts.ts?retry')
  document.styleSheets = [{ cssRules: [new FakeFontFace('/retry.woff2')] }]
  let attempts = 0
  globalThis.fetch = uncached(async () => {
    attempts += 1
    return attempts === 1 ? { ok: false, status: 429 } : { ok: true, blob: async () => new Blob(['font']) }
  })
  assert.match(await freshFontCssFor(root), /data:font\/woff2/)
  assert.equal(attempts, 2)
})

test('브라우저 캐시에 있는 조각은 요청 간격 없이 바로 쓴다', async () => {
  const { fontCssFor: freshFontCssFor } = await import('./captureFonts.ts?http-cache')
  document.styleSheets = [{ cssRules: Array.from({ length: 50 }, (_, i) => new FakeFontFace(`/cached-${i}.woff2`)) }]
  const modes = new Set()
  globalThis.fetch = async (url, init) => {
    modes.add(init?.cache)
    return { ok: true, blob: async () => new Blob([url]) }
  }
  const startedAt = Date.now()
  const css = await freshFontCssFor(root)
  assert.equal((css.match(/data:font\/woff2/g) ?? []).length, 50)
  assert.deepEqual([...modes], ['only-if-cached'])
  assert.ok(Date.now() - startedAt < 1000)
})

test('브라우저 캐시 확인이 실패하면 서버에서 받는다', async () => {
  const { fontCssFor: freshFontCssFor } = await import('./captureFonts.ts?http-cache-error')
  document.styleSheets = [{ cssRules: [new FakeFontFace('/probe-error.woff2')] }]
  let requests = 0
  globalThis.fetch = async (url, init) => {
    if (init?.cache === 'only-if-cached') throw new TypeError('unsupported')
    requests += 1
    return { ok: true, blob: async () => new Blob([url]) }
  }
  assert.match(await freshFontCssFor(root), /data:font\/woff2/)
  assert.equal(requests, 1)
})

function fakeIndexedDb() {
  const stored = new Map()
  const done = (request, result) => {
    request.result = result
    queueMicrotask(() => request.onsuccess?.())
    return request
  }
  const store = transaction => ({
    get: url => done({}, stored.get(url)),
    put: (value, url) => {
      stored.set(url, value)
      queueMicrotask(() => transaction.oncomplete?.())
    },
  })
  const db = {
    transaction: () => {
      const transaction = { objectStore: () => store(transaction) }
      return transaction
    },
  }
  return { stored, open: () => done({}, db) }
}

test('렌더러 판은 저장소에 둔 글꼴을 다음 페이지에서 서버 요청 없이 쓴다', async () => {
  const db = fakeIndexedDb()
  globalThis.indexedDB = db
  globalThis.location = { search: '?capture=mobile' }
  document.styleSheets = [{ cssRules: [new FakeFontFace('/stored.woff2')] }]
  let requests = 0
  globalThis.fetch = uncached(async () => { requests += 1; return { ok: true, blob: async () => new Blob(['font']) } })
  try {
    const { fontCssFor: firstPage } = await import('./captureFonts.ts?store-first')
    assert.match(await firstPage(root), /data:font\/woff2/)
    assert.equal(requests, 1)
    assert.equal(db.stored.size, 1)

    const { fontCssFor: nextPage } = await import('./captureFonts.ts?store-next')
    assert.match(await nextPage(root), /data:font\/woff2/)
    assert.equal(requests, 1)
  } finally {
    delete globalThis.indexedDB
    delete globalThis.location
  }
})

test('일반 페이지는 글꼴을 저장소에 두지 않는다', async () => {
  const db = fakeIndexedDb()
  globalThis.indexedDB = db
  globalThis.location = { search: '' }
  document.styleSheets = [{ cssRules: [new FakeFontFace('/normal.woff2')] }]
  globalThis.fetch = async () => ({ ok: true, blob: async () => new Blob(['font']) })
  try {
    const { fontCssFor: normalPage } = await import('./captureFonts.ts?store-normal')
    assert.match(await normalPage(root), /data:font\/woff2/)
    assert.equal(db.stored.size, 0)
  } finally {
    delete globalThis.indexedDB
    delete globalThis.location
  }
})
