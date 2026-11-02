// 캡처 이미지에 넣을 글꼴 CSS — 찍을 영역에 실제로 쓰인 글자와 굵기의 조각만 고른다.
// 글꼴은 글자 범위(unicode-range)별로 약 276개 조각으로 쪼개져 있다. 캡처 라이브러리는 기본값으로 조각을 전부 내려받아 이미지에
// 넣기 때문에(캡처 한 번에 요청 250건 안팎) 조각을 쪼갠 뒤 캡처가 느려졌다. 화면에서 브라우저가 필요한 조각만 받는 것과 같은 기준으로 고른다.

type FontFace = { rule: CSSFontFaceRule; family: string; weight: number; ranges: Array<[number, number]> }

let cachedFaces: FontFace[] | null = null

function parseRanges(value: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = []
  for (const match of value.matchAll(/U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/gi)) {
    const start = Number.parseInt(match[1].replaceAll('?', '0'), 16)
    const end = match[2] ? Number.parseInt(match[2], 16) : Number.parseInt(match[1].replaceAll('?', 'f'), 16)
    ranges.push([start, end])
  }
  return ranges
}

// @layer·@media 같은 묶음 안에 든 글꼴 정의까지 읽는다.
function collectFontFaces(rules: CSSRuleList, faces: FontFace[]) {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSFontFaceRule) {
      const family = rule.style.getPropertyValue('font-family').replaceAll(/['"]/g, '').trim()
      const weight = Number.parseInt(rule.style.getPropertyValue('font-weight'), 10) || 400
      faces.push({ rule, family, weight, ranges: parseRanges(rule.style.getPropertyValue('unicode-range')) })
    } else if ('cssRules' in rule) {
      collectFontFaces((rule as CSSGroupingRule).cssRules, faces)
    }
  }
}

function readFontFaces(): FontFace[] {
  if (cachedFaces) return cachedFaces
  const faces: FontFace[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      collectFontFaces(sheet.cssRules, faces)
    } catch {
      // 다른 출처의 스타일시트는 읽을 수 없다.
    }
  }
  // 스타일시트가 아직 다 안 올라온 상태(조각이 하나도 없음)일 때는 저장하지 않는다.
  if (faces.length > 0) cachedFaces = faces
  return faces
}

// CSS 글꼴 굵기 대응 — 정확히 있는 굵기, 없으면 400~500은 서로, 그 위는 더 굵은 쪽 먼저, 그 아래는 더 얇은 쪽 먼저.
function matchedWeight(wanted: number, available: number[]): number {
  if (available.includes(wanted)) return wanted
  const sorted = [...available].sort((a, b) => a - b)
  const lighter = sorted.filter(weight => weight < wanted).reverse()
  const heavier = sorted.filter(weight => weight > wanted)
  if (wanted >= 400 && wanted <= 500) {
    const between = sorted.filter(weight => weight > wanted && weight <= 500)
    return [...between, ...lighter, ...heavier][0] ?? sorted[0]
  }
  return (wanted < 400 ? [...lighter, ...heavier] : [...heavier, ...lighter])[0] ?? sorted[0]
}

function usedWeights(root: HTMLElement): Set<number> {
  const weights = new Set<number>()
  const visit = (element: Element) => {
    const hasText = Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '')
    if (hasText) weights.add(Number.parseInt(getComputedStyle(element).fontWeight, 10) || 400)
  }
  visit(root)
  for (const element of Array.from(root.querySelectorAll('*'))) visit(element)
  return weights
}

function usedCodePoints(root: HTMLElement): Set<number> {
  const points = new Set<number>()
  for (let code = 0x20; code <= 0x7e; code += 1) points.add(code) // 기본 라틴 문자·숫자·기호는 항상 포함한다.
  for (const char of root.textContent ?? '') points.add(char.codePointAt(0) ?? 0)
  return points
}

// 한 번 내려받은 글꼴 조각은 data URL로 메모리에 두고 다음 캡처에서 다시 받지 않는다.
const embeddedFonts = new Map<string, Promise<string>>()

const FONT_FETCH_ATTEMPTS = 3

function wait(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

async function fetchFontDataUrl(url: string): Promise<string> {
  let lastError: unknown
  for (let attempt = 1; attempt <= FONT_FETCH_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`글꼴을 받지 못했습니다(${response.status}): ${url}`)
      const blob = await response.blob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      lastError = error
      if (attempt < FONT_FETCH_ATTEMPTS) await wait(300 * attempt)
    }
  }
  throw lastError
}

function embedFontUrl(url: string): Promise<string> {
  const cached = embeddedFonts.get(url)
  if (cached) return cached
  const loading = fetchFontDataUrl(url)
  // 실패한 요청은 다음 캡처에서 다시 시도한다.
  loading.catch(() => embeddedFonts.delete(url))
  embeddedFonts.set(url, loading)
  return loading
}

// 글꼴 정의의 파일 주소를 내려받은 data URL로 바꾼다. 캡처 라이브러리는 cssText를 받으면 파일을 대신 받아 주지 않아서 직접 넣어야 한다.
async function embedFontUrls(cssText: string): Promise<string> {
  const urls = [...new Set(Array.from(cssText.matchAll(/url\((['"]?)([^)'"]+)\1\)/g), match => match[2]))]
  // 일부 조각만 빠지면 해당 글자만 대체 글꼴로 그려져 한 이미지 안에서 폭과 굵기가 달라진다.
  // 필요한 글꼴은 전부 넣거나 캡처를 실패시킨다.
  const entries = await Promise.all(
    urls.map(async url => [url, await embedFontUrl(new URL(url, document.baseURI).href)] as const),
  )
  let embedded = cssText
  for (const [url, dataUrl] of entries) embedded = embedded.split(url).join(dataUrl)
  return embedded
}

// 찍을 영역에 필요한 글꼴 CSS(파일은 data URL로 넣은 것). 글꼴 정의를 못 읽거나 고른 조각이 하나도 없거나 받지 못하면 undefined(라이브러리 기본 동작)다.
export async function fontCssFor(root: HTMLElement | HTMLElement[]): Promise<string | undefined> {
  // 동적 글꼴 조각이 아직 로드 중이면 캡처 시점에 따라 굵기·폭이 달라진다.
  await document.fonts?.ready
  const faces = readFontFaces()
  if (faces.length === 0) return undefined
  const roots = Array.isArray(root) ? root : [root]
  const points = new Set(roots.flatMap(element => [...usedCodePoints(element)]))
  const wanted = new Set(roots.flatMap(element => [...usedWeights(element)]))
  const picked: string[] = []
  for (const family of new Set(faces.map(face => face.family))) {
    const familyFaces = faces.filter(face => face.family === family)
    const available = [...new Set(familyFaces.map(face => face.weight))]
    const neededWeights = new Set([...wanted].map(weight => matchedWeight(weight, available)))
    for (const face of familyFaces) {
      if (!neededWeights.has(face.weight)) continue
      const covers = face.ranges.length === 0 || face.ranges.some(([start, end]) => [...points].some(point => point >= start && point <= end))
      if (covers) picked.push(face.rule.cssText)
    }
  }
  if (picked.length === 0) return undefined
  return embedFontUrls(picked.join('\n'))
}
