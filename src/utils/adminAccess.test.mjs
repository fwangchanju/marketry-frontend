import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { isAdminSession } from './adminAccess.ts'

test('로그인한 관리자만 관리자로 본다', () => {
  assert.equal(isAdminSession({ authenticated: true, role: 'ADMIN' }), true)
})

test('일반 회원·특별 회원은 관리자가 아니다', () => {
  assert.equal(isAdminSession({ authenticated: true, role: 'USER' }), false)
  assert.equal(isAdminSession({ authenticated: true, role: 'USER', special: true }), false)
})

test('로그인하지 않았거나 세션을 아직 모를 때는 role이 ADMIN이어도 관리자가 아니다', () => {
  assert.equal(isAdminSession({ authenticated: false, role: 'ADMIN' }), false)
  assert.equal(isAdminSession({ role: 'ADMIN' }), false)
  assert.equal(isAdminSession({ authenticated: true, role: null }), false)
  assert.equal(isAdminSession(undefined), false)
  assert.equal(isAdminSession(null), false)
})

// 관리자 판단을 화면마다 따로 쓰면 한 곳만 느슨해져 관리자 전용이 일반 회원에게 보인다.
// 세션의 role을 직접 'ADMIN'과 비교하는 코드는 adminAccess.ts 밖에 두지 않는다(회원 표의 다른 회원 role 비교는 예외).
test('세션 role을 adminAccess.ts 밖에서 직접 ADMIN과 비교하지 않는다', () => {
  const allowedFiles = new Set(['adminAccess.ts', 'AdminMembers.tsx'])
  const found = []
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.(ts|tsx)$/.test(name) && !allowedFiles.has(name)) {
        readFileSync(path, 'utf8').split('\n').forEach((line, index) => {
          if (/role\s*===?\s*'ADMIN'/.test(line)) found.push(`${path}:${index + 1}`)
        })
      }
    }
  }
  walk(new URL('..', import.meta.url).pathname)
  assert.deepEqual(found, [], '관리자 판단은 isAdminSession()을 쓴다')
})
