import test from 'node:test'
import assert from 'node:assert/strict'
import { coordinates, requestFor, parseMarine, fetchMarine } from '../src/services/marineApi.js'

const session = { id: 'test', spot_id: 'spot', started_at: '2025-06-01T23:30:00+09:00', ended_at: '2025-06-02T01:00:00+09:00' }
const spot = { latitude: 37.8, longitude: 129 }
const now = Date.parse('2025-06-03T00:00:00Z')
const request = requestFor(session, spot, now)
const hour = Date.parse('2025-06-01T15:00:00Z') / 1000
const body = { latitude: 37.75, longitude: 129.1, hourly: { time: [hour - 3600, hour, hour, hour + 3600], wave_height: [9, 0, 3, 9], swell_wave_period: [null, null, null, null] } }

test('coordinates reject absent, partial and invalid inputs, accept zero', () => {
  for (const s of [{}, { latitude: '', longitude: 2 }, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: Infinity }]) assert.throws(() => coordinates(s))
  assert.deepEqual(coordinates({ latitude: '0', longitude: '0' }), { latitude: 0, longitude: 0 })
})
test('hourly instants are inside start-inclusive end-exclusive interval across midnight', () => {
  const rows = parseMarine(body, request, session)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].sampled_at, '2025-06-01T15:00:00.000Z')
  assert.equal(rows[0].wave_height, 0)
  assert.equal(rows[0].swell_period, null)
  assert.equal(rows[0].data_source_type, 'archived_forecast')
})
test('historical marine endpoint and no-data boundaries', () => {
  assert.equal(new URL(request.url).hostname, 'marine-api.open-meteo.com')
  assert.equal(new URL(request.url).searchParams.get('models'), 'meteofrance_wave')
  assert.equal(new URL(request.url).searchParams.get('start_date'), '2025-06-01')
  assert.equal(new URL(request.url).searchParams.get('end_date'), '2025-06-01')
  assert.equal(requestFor({ ...session, started_at: '2020-01-01Z', ended_at: '2020-01-02Z' }, spot, now), null)
  assert.equal(requestFor({ ...session, started_at: '2025-06-01T00:10:00Z', ended_at: '2025-06-01T00:20:00Z' }, spot, now), null)
  assert.equal(parseMarine({ hourly: { time: [hour], wave_height: [null] } }, request, session).length, 0)
  const rows = parseMarine(body, { ...request, now: hour * 1000 - 1 }, session)
  assert.equal(rows[0].data_source_type, 'forecast')
})
test('API errors surface and in-flight duplicate requests share a fetch', async () => {
  let calls = 0
  const fetcher = async () => { calls++; return { ok: true, json: async () => body } }
  await Promise.all([fetchMarine(session, spot, { fetcher, now }), fetchMarine(session, spot, { fetcher, now })])
  assert.equal(calls, 1)
  await assert.rejects(fetchMarine(session, spot, { now, fetcher: async () => ({ ok: false, status: 429 }) }), /429/)
  await assert.rejects(fetchMarine(session, spot, { now, fetcher: async () => ({ ok: true, json: async () => ({ error: true }) }) }))
  assert.throws(() => parseMarine({}, request, session))
})
