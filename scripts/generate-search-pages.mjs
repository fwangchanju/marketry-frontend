import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const siteUrl = 'https://marketry.co.kr'
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

function replaceOnce(html, pattern, replacement) {
  const matches = [...html.matchAll(pattern)]
  if (matches.length !== 1) throw new Error(`Expected one metadata tag for ${pattern}, found ${matches.length}`)
  return html.replace(pattern, () => replacement)
}

export function renderSearchPage(template, path, { title, description }) {
  const url = escapeHtml(`${siteUrl}${path}`)
  const safeTitle = escapeHtml(title)
  const safeDescription = escapeHtml(description)
  let html = replaceOnce(template, /<title>[^<]*<\/title>/g, `<title>${safeTitle}</title>`)
  html = replaceOnce(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?\s*>/g, `<link rel="canonical" href="${url}" />`)
  html = replaceOnce(html, /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/g, `<meta name="description" content="${safeDescription}" />`)
  html = replaceOnce(html, /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?\s*>/g, `<meta property="og:url" content="${url}" />`)
  html = replaceOnce(html, /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/g, `<meta property="og:title" content="${safeTitle}" />`)
  html = replaceOnce(html, /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/g, `<meta property="og:description" content="${safeDescription}" />`)
  if (path !== '/home') {
    const siteNameSchema = /<script\s+type="application\/ld\+json"\s+data-site-name>[\s\S]*?<\/script>\s*/g
    if ([...html.matchAll(siteNameSchema)].length !== 1) throw new Error('Expected one site name schema block for the homepage')
    html = html.replace(siteNameSchema, '')
  }
  return html
}

async function generate() {
  const pages = JSON.parse(await readFile('src/utils/searchMetadata.json', 'utf8'))
  const template = await readFile('dist/index.html', 'utf8')
  for (const [path, page] of Object.entries(pages)) {
    if (!/^\/(?:home|(?:map|graph)\/(?:kospi|kosdaq|allstock))$/.test(path)) throw new Error(`Unexpected search page path: ${path}`)
    const destination = resolve('dist', `.${path}.html`)
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, renderSearchPage(template, path, page))
  }
  await writeFile('dist/index.html', renderSearchPage(template, '/home', pages['/home']))
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await generate()
