import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

test('service CRUD workflow and query filters (mocked Supabase, no database)', async () => {
  const calls = []
  let response
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } }, error: null }) },
    from(table) {
      const call = { table, steps: [] }
      calls.push(call)
      const query = { then(resolve) { return Promise.resolve({ data: response, error: null }).then(resolve) } }
      for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'lt', 'range', 'single']) {
        query[method] = (...args) => { call.steps.push([method, ...args]); return query }
      }
      return query
    },
  }
  mock.module('../src/lib/supabase.js', { namedExports: { supabase: client } })
  const spots = await import('../src/services/surfSpots.js')
  const sessions = await import('../src/services/surfSessions.js')
  const spot = { id: 'spot-test', user_id: 'user-a', name: 'Isolated test' }
  response = spot
  assert.deepEqual(await spots.createSpot({ name: spot.name }), spot)
  assert.deepEqual(calls.at(-1).steps[0], ['insert', { name: spot.name, user_id: 'user-a' }])
  response = [spot]
  assert.deepEqual(await spots.listSpots(), [spot])
  const input = { spot_id: spot.id, started_at: '2026-11-01T09:00:00+09:00', ended_at: '2026-11-01T10:00:00+09:00' }
  const session = { ...input, id: 'session-test', user_id: 'user-a', spot }
  response = session
  assert.deepEqual(await sessions.createSession(input), session)
  assert.equal(calls.at(-1).steps[0][1].started_at, '2026-11-01T00:00:00.000Z')
  assert.equal(calls.at(-1).steps[0][1].user_id, 'user-a')
  assert.deepEqual(await sessions.getSession(session.id), session)
  assert.ok(calls.at(-1).steps.some(([method, value]) => method === 'select' && value.includes('surf_sessions_owned_spot_fkey')))
  response = [session]
  await sessions.listSessions({ from: '2026-11-01T00:00:00+09:00', to: '2026-11-02T00:00:00+09:00' })
  assert.ok(calls.at(-1).steps.some(step => JSON.stringify(step) === JSON.stringify(['gte', 'started_at', '2026-10-31T15:00:00.000Z'])))
  assert.ok(calls.at(-1).steps.some(step => JSON.stringify(step) === JSON.stringify(['lt', 'started_at', '2026-11-01T15:00:00.000Z'])))
  assert.ok(calls.at(-1).steps.some(([method, field, options]) => method === 'order' && field === 'started_at' && options.ascending === false))
  response = { ...session, notes: 'Updated' }
  assert.equal((await sessions.updateSession(session.id, { notes: 'Updated' })).notes, 'Updated')
  assert.deepEqual(calls.at(-1).steps[0], ['update', { notes: 'Updated' }])
  response = { id: session.id }
  assert.deepEqual(await sessions.deleteSession(session.id), response)
  response = { ...spot, name: 'Updated spot' }
  await spots.updateSpot(spot.id, { name: 'Updated spot' })
  response = { id: spot.id }
  await spots.deleteSpot(spot.id)
  for (const call of calls.filter(call => call.steps[0][0] !== 'insert')) {
    assert.ok(call.steps.some(([method, field, value]) => method === 'eq' && field === 'user_id' && value === 'user-a'))
  }
  for (const call of calls.filter(call => ['update', 'delete'].includes(call.steps[0][0]))) {
    assert.ok(call.steps.some(([method, field]) => method === 'eq' && field === 'id'))
  }
})
