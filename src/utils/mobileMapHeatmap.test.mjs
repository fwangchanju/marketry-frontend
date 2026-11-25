import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

test('지도와 MOBILE 화면은 모바일 히트맵 변환과 경로 버튼 클래스를 공통 유틸에서 가져온다', () => {
  const pagesDir = join(dirname(fileURLToPath(import.meta.url)), '../pages')
  for (const name of ['../components/MapScreen.tsx', '../markets/SnapshotMobile.tsx', '../markets/KoreaMobile.tsx']) {
    const source = readFileSync(join(pagesDir, name), 'utf8')
    assert.ok(source.includes("from '@/utils/mobileMapHeatmap'"), `${name}에서 공통 유틸을 가져온다`)
    assert.ok(!source.includes('function toDisplayGroup('), `${name}에서 변환 함수를 다시 만들지 않는다`)
    assert.ok(!source.includes("const BREADCRUMB_LINK_CLASS ="), `${name}에서 경로 버튼 클래스를 다시 만들지 않는다`)
  }
})
