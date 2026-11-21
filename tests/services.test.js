import test from 'node:test'
import assert from 'node:assert/strict'
import { createSpot, updateSpot } from '../src/services/surfSpots.js'
import { createSession, updateSession, listSessions } from '../src/services/surfSessions.js'

test('CRUD rejects caller-supplied ownership before accessing the client', async () => {
  for (const call of [
    () => createSpot({ name: 'test', user_id: 'other' }),
    () => updateSpot('id', { user_id: 'other' }),
    () => createSession({ user_id: 'other' }),
    () => updateSession('id', { user_id: 'other' }),
  ]) {
    await assert.rejects(call(), { code: 'INVALID_INPUT' })
  }
})

test('session range rejects reversed, ambiguous dates and invalid pagination', async () => {
  for (const options of [
    { from: '2026-11-02T00:00:00+09:00', to: '2026-11-01T00:00:00+09:00' },
    { from: '2026-11-01' },
    { limit: 0 },
    { limit: 1001 },
    { offset: -1 },
  ]) {
    await assert.rejects(listSessions(options), { code: 'INVALID_INPUT' })
  }
})
