import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

test('marine snapshot storage preserves old data and deduplicates retrieval (mocked)', async () => {
  let stored = [{ session_id: 'session', spot_id:'spot', requested_latitude:37,requested_longitude:129,sampled_at: '2025-06-01T00:00:00Z', wave_height: 1 }]
  let fetched = []
  let fetchCalls = 0
  let writes = 0
  let rpcCalls = 0
  let failure = null
  let rpcError = null
  const client = {
    from() {
      return {
        select() { return this },
        eq(field, id) { assert.equal(field, 'session_id'); assert.equal(id, 'session'); return this },
        order() { return Promise.resolve({ data: stored, error: null }) },
        upsert(rows, options) {
          assert.deepEqual(options, { onConflict: 'session_id,sampled_at', ignoreDuplicates: true })
          writes++
          stored = rows
          return Promise.resolve({ data: null, error: null })
        },
      }
    },
    rpc(name, args) {
      assert.equal(name, 'replace_session_marine')
      assert.equal(args.target_session, 'session')
      rpcCalls++
      if (!rpcError) stored = args.samples
      return Promise.resolve({ data: null, error: rpcError })
    },
  }
  mock.module('../src/lib/supabase.js', { namedExports: { supabase: {
    ...client, auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) },
  } } })
  mock.module('../src/services/marineApi.js', { namedExports: {
    fetchMarine: async () => { fetchCalls++; if (failure) throw failure; return fetched },
    coordinates:spot=>spot,
  } })
  const { retrieveMarine } = await import('../src/services/marineSamples.js')
  const session = { id: 'session',spot_id:'spot',started_at:'2025-06-01T00:00:00Z',ended_at:'2025-06-01T01:00:00Z' }
  const spot={latitude:37,longitude:129}
  const original = stored
  assert.deepEqual(await retrieveMarine(session, spot), original)
  assert.equal(fetchCalls, 0)
  await assert.rejects(retrieveMarine(session, spot, true), /기존 스냅샷/)
  assert.equal(stored, original)
  assert.equal(rpcCalls, 0)
  failure = new Error('Network failed')
  await assert.rejects(retrieveMarine(session, spot, true), /Network failed/)
  assert.equal(stored, original)
  failure = null
  fetched = [{ ...original[0], wave_height: 2 }]
  rpcError = { code: '42501', message: 'Denied' }
  await assert.rejects(retrieveMarine(session, spot, true), { code: '42501' })
  assert.equal(stored, original)
  rpcError = null
  assert.deepEqual(await retrieveMarine(session, spot, true), fetched)
  stored = []
  const before = fetchCalls
  await Promise.all([retrieveMarine(session, spot), retrieveMarine(session, spot)])
  assert.equal(fetchCalls, before + 1)
  assert.equal(writes, 1)
})
