import { test, mock } from 'node:test'
import assert from 'node:assert/strict'

test('place search empty/error paths do not fabricate locations', async () => {
  let response = { data: { places: [] }, error: null }
  let calls = 0
  mock.module('../src/lib/supabase.js', { namedExports: { supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'test-user' } } }) },
    functions: { invoke: async (name, { body }) => {
      calls++; assert.equal(name, 'search-places'); assert.ok(body.query.length <= 80)
      return response
    } },
  } } })
  const { searchPlaces } = await import('../src/services/placeSearch.js')
  assert.deepEqual(await searchPlaces('a'), [])
  assert.equal(calls, 0)
  assert.deepEqual(await searchPlaces('Unavailable overseas beach'), [])
  response = { error: new Error('Not deployed') }
  await assert.rejects(searchPlaces('Beach'), /장소 검색/)
})
