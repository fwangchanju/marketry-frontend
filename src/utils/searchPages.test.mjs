import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { renderSearchPage } from '../../scripts/generate-search-pages.mjs'

const template = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
const pages = JSON.parse(readFileSync(new URL('./searchMetadata.json', import.meta.url), 'utf8'))

test('검색 페이지마다 첫 HTML에 각 제목과 대표 주소가 들어간다', () => {
  assert.equal(Object.keys(pages).length, 7)
  for (const [path, page] of Object.entries(pages)) {
    const html = renderSearchPage(template, path, page)
    assert.ok(html.includes(`<title>${page.title}</title>`))
    assert.ok(html.includes(`<link rel="canonical" href="https://marketry.co.kr${path}" />`))
    assert.ok(html.includes(`<meta name="description" content="${page.description}" />`))
    assert.ok(html.includes(`<meta property="og:url" content="https://marketry.co.kr${path}" />`))
    assert.ok(html.includes('<div id="root"></div>'))
  }
})

test('제목과 설명의 HTML 특수문자를 안전하게 표현한다', () => {
  const html = renderSearchPage(template, '/home', { title: 'A & B <C>', description: '"A & B"' })
  assert.ok(html.includes('<title>A &amp; B &lt;C&gt;</title>'))
  assert.ok(html.includes('content="&quot;A &amp; B&quot;"'))
})
