import test from 'node:test'
import assert from 'node:assert/strict'
import { matchSpots, cleanName, nameKey, boardNames, canonicalBoard, resolveSpot } from '../src/journal/suggestions.js'
import { ratings, seoulParts } from '../src/journal/dates.js'

test('spot ranking preserves IDs, regions and coordinates', () => {
  const spots = [
    { id: 'contains', name: 'East Beach', region: 'A' },
    { id: 'prefix', name: 'Beach North', region: 'B' },
    { id: 'exact', name: 'Beach', region: 'C', latitude: 12, longitude: 34 },
  ]
  const results = matchSpots(spots, ' beach ')
  assert.deepEqual(results.map(s => s.id), ['exact', 'prefix', 'contains'])
  assert.equal(results[0], spots[2])
  assert.deepEqual(matchSpots(spots, 'unknown'), [])
  assert.equal(matchSpots(spots, 'C')[0].id, 'exact')
})

test('board suggestions normalize whitespace and equivalent names', () => {
  const names = boardNames([{ board_name: '  Long   Board ' }, { board_name: 'long board' }, { board_name: null }])
  assert.deepEqual(names, ['Long Board'])
  assert.equal(canonicalBoard(' LONG  board ', names), 'Long Board')
  assert.equal(canonicalBoard(' New   Board ', names), 'New Board')
  assert.equal(canonicalBoard(' ', names), null)
  assert.equal(nameKey('  Beach '), 'beach')
  assert.equal(cleanName('a\t b'), 'a b')
})

test('visible ratings exclude performance; Seoul overnight dates stay distinct', () => {
  assert.deepEqual(Object.keys(ratings), ['overall_rating', 'wave_rating', 'crowd_level'])
  assert.equal(seoulParts('2026-11-01T14:30:00Z').date, '2026-11-01')
  assert.equal(seoulParts('2026-11-01T15:30:00Z').date, '2026-11-02')
})

test('submission reuses selected and normalized exact spots without creation', async () => {
  const spot = { id: 'one', name: 'Beach', latitude: 12, longitude: 34 }
  const fail = () => { throw new Error('Unexpected create') }
  assert.equal((await resolveSpot([spot], 'one', 'Beach', fail)).spot, spot)
  assert.equal((await resolveSpot([spot], '', ' beach ', fail)).spot, spot)
  await assert.rejects(resolveSpot([spot, { ...spot, id: 'two', region: 'Other' }], '', 'Beach', fail))
})

test('new spot submission creates once; retry reuses returned ID', async () => {
  let calls = 0
  const create = async input => { calls++; return { id: 'new', ...input } }
  const first = await resolveSpot([], '', ' New   Beach ', create)
  assert.equal(first.spot.name, 'New Beach')
  assert.equal(first.created, true)
  await resolveSpot([first.spot], first.spot.id, first.spot.name, create)
  assert.equal(calls, 1)
})
