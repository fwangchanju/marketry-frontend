import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

// 시장을 한국/그 밖으로 나누는 이름을 다시 만들지 않는다(2026-11-25 사용자 결정). 서버 주소와 저장 이름은 그대로 둔다.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = readdirSync(root, { recursive: true }).map(String).filter(name => /\.tsx?$/.test(name))

test('파일과 코드 이름에 Overseas·Phone을 쓰지 않는다', () => {
  for (const name of files) {
    assert.ok(!/overseas|phone/i.test(name), name)
    const source = readFileSync(join(root, name), 'utf8')
    assert.equal(source.match(/\b\w*(Overseas|OVERSEAS_|Phone[A-Z])\w*/)?.[0], undefined, name)
  }
})
