import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

test('해외 섹터·그래프와 국내 그래프 화면은 캡처창 열기·복사 상태를 직접 만들지 않는다', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '../pages')
  for (const name of ['OverseasSectorView.tsx', 'OverseasGraphView.tsx', 'GraphPage.tsx']) {
    const source = readFileSync(join(pagesDir, name), 'utf8')
    assert.ok(source.includes('useScreenshotShare'), `${name}에서 공통 훅을 쓴다`)
    assert.ok(!source.includes('copyStatus'), `${name}에서 복사 상태를 직접 만들지 않는다`)
    assert.ok(!source.includes('setShareOpen') && !source.includes('setIsShareOpen'), `${name}에서 창 열림 상태를 직접 만들지 않는다`)
    assert.ok(!source.includes('copyDataUrlToClipboard'), `${name}에서 복사 함수를 직접 만들지 않는다`)
  }
})
