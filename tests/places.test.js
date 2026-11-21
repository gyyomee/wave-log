import test from 'node:test'
import assert from 'node:assert/strict'
import { savePlace, ratingValue } from '../src/journal/suggestions.js'

test('zero and blank ratings map to null; saved ratings remain unchanged', () => {
  for (const value of [0, '0', '', null]) assert.equal(ratingValue(value), null)
  for (const value of [1,2,3,4,5]) assert.equal(ratingValue(value), value)
})
test('explicit external choice reuses exact location or updates same spot ID', async () => {
  const existing = { id: 'owned', name: 'Beach', latitude: 37, longitude: 129 }
  const place = { name: 'Beach', latitude: 37, longitude: 129, region: 'Region', country: 'KR' }
  const fail = () => { throw new Error('Unexpected create') }
  assert.equal((await savePlace([existing], '', place, fail, fail)).spot.id, 'owned')
  let patch
  const updated = await savePlace([{ ...existing, latitude: null, longitude: null }], 'owned', place, fail, async (id, values) => {
    patch = values
    return { ...existing, ...values, id }
  })
  assert.equal(updated.spot.id, 'owned')
  assert.equal(patch.latitude, 37)
  assert.equal(updated.created, false)
})
test('new explicit place persists its supplied location and region', async () => {
  const place = { name: 'New beach', latitude: 37, longitude: 129, region: 'Coast', country: 'KR' }
  const result = await savePlace([], '', place, async values => ({ id: 'new', ...values }), () => {})
  assert.equal(result.created, true)
  assert.equal(result.spot.region, 'Coast')
  assert.equal(result.spot.longitude, 129)
})
