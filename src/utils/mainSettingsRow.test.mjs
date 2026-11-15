import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

// 메인·설정창 바깥 여백(좌우 4px)과 두 영역 사이 간격(설정창을 열었을 때만 4px)은 `main-settings-row`(index.css)에서만 관리한다.
// 페이지마다 `gap-[4px]`를 따로 넣으면 설정창을 닫았을 때 여백이 한 번 더 생겨 시장마다 오른쪽 끝이 어긋난다(2026-11-16).
const ROOT = join(import.meta.dirname, '..')
const FILES = [
  ...readdirSync(join(ROOT, 'pages')).map(f => join(ROOT, 'pages', f)),
  join(ROOT, 'components', 'DocumentPageLayout.tsx'),
]

test('main-settings-row에는 gap-[4px]를 따로 넣지 않는다', () => {
  const offenders = FILES
    .filter(file => file.endsWith('.tsx'))
    .filter(file => /main-settings-row[^"`]*gap-\[4px\]/.test(readFileSync(file, 'utf8')))
    .map(file => file.slice(ROOT.length + 1))
  assert.deepEqual(offenders, [])
})

test('main-settings-row 바깥 여백은 index.css에서 4px로 정해져 있다', () => {
  const css = readFileSync(join(ROOT, 'index.css'), 'utf8')
  assert.match(css, /\.main-settings-row \{\s*padding-inline: 4px;\s*\}/)
  assert.match(css, /\.main-settings-row:has\(\[data-settings-panel-shell\]\) \{\s*column-gap: 4px;\s*\}/)
})
