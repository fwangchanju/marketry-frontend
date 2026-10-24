import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseOAuthReturnLocation } from './oauthReturn.ts'

test('reads only the allowlisted login error and preserves the rest of the URL', () => {
  assert.deepEqual(
    parseOAuthReturnLocation('/custom/sector', '?tab=mine&error=notice&loginError=cancelled&view=compact', '#stocks'),
    { error: 'cancelled', returnTo: '/custom/sector?tab=mine&error=notice&view=compact#stocks' },
  )
})

test('ignores unknown login error values and unrelated error parameters', () => {
  assert.equal(parseOAuthReturnLocation('/home', '?error=oauth_failed&loginError=provider_detail', ''), null)
})

test('preserves the hash when no query parameters remain', () => {
  assert.deepEqual(parseOAuthReturnLocation('/graph', '?loginError=oauth_failed', '#comparison'), {
    error: 'oauth_failed',
    returnTo: '/graph#comparison',
  })
})
