import test from 'node:test'
import assert from 'node:assert/strict'
import { initialRatings, initialIntent, validLocation, compass, mergePrefill, changeCondition, restoreCondition, contextKey, wetsuitNames } from '../src/journal/conditionModel.js'
import { representative, weatherEndpoint, parseConditions, fetchConditionSnapshot } from '../src/services/conditionApi.js'

test('new ratings default to 3 with explicit default provenance; editing preserves null', () => {
  const keys = ['overall_rating','wave_rating','crowd_level']
  assert.deepEqual(initialRatings(null, keys), { overall_rating: 3, wave_rating: 3, crowd_level: 3 })
  assert.deepEqual(initialRatings({ overall_rating: 5, wave_rating: null, crowd_level: 1 }, keys), { overall_rating: 5, wave_rating: '', crowd_level: 1 })
  assert.equal(initialIntent(null,keys).wave_rating, 'default')
  assert.equal(initialIntent({},keys).wave_rating, 'legacy')
})
test('selected external/saved coordinates are valid without requiring a result list', () => {
  assert.equal(validLocation({ external: true, latitude: 37, longitude: 129 }), true)
  assert.equal(validLocation({ id: 'saved', latitude: '0', longitude: '0' }), true)
  for (const s of [{}, { latitude: null, longitude: null }, { latitude: 91, longitude: 129 }]) assert.equal(validLocation(s), false)
})
test('API refresh updates only unedited values and preserves original manual provenance', () => {
  let state = mergePrefill({ manual_fields: [] }, { wave_height: { value: 1, context: 'old' }, wind_speed: { value: 2 } }, 'old')
  state = changeCondition(state, 'wave_height', '1.7')
  state = mergePrefill(state, { wave_height: { value: 3, context: 'new' }, wind_speed: { value: 5 } }, 'new')
  assert.equal(state.wave_height, '1.7')
  assert.equal(state.wind_speed, 5)
  assert.equal(state.manual_origins.wave_height.api.value, 1)
  assert.equal(restoreCondition(state,'wave_height').wave_height, 3)
  assert.deepEqual(restoreCondition(state,'wave_height').manual_fields, [])
})
test('compass rounds only the displayed label, preserves precise values and supports null', () => {
  assert.equal(compass(44.7), 'NE')
  assert.equal(compass(359), 'N')
  assert.equal(compass(180), 'S')
  assert.equal(compass(null), '알 수 없음')
})
test('representative sample is closest to midpoint within interval; tie uses earlier sample', () => {
  const rows = ['2026-11-01T15:00:00Z','2026-11-01T16:00:00Z','2026-11-01T17:00:00Z'].map(sampled_at => ({ sampled_at }))
  assert.equal(representative(rows,'2026-11-01T14:30:00Z','2026-11-01T16:30:00Z').sampled_at, rows[0].sampled_at)
  assert.equal(representative(rows,'2026-11-01T16:00:00Z','2026-11-01T17:00:00Z').sampled_at, rows[1].sampled_at)
  assert.equal(representative(rows,'2026-11-01T15:01:00Z','2026-11-01T15:59:00Z'), null)
})
test('time changes invalidate context and old weather uses reanalysis endpoint', () => {
  const spot = { latitude: 37, longitude: 129 }
  assert.notEqual(contextKey(spot,'2026-11-01T00:00Z','2026-11-01T01:00Z'), contextKey(spot,'2026-11-02T00:00Z','2026-11-02T01:00Z'))
  assert.equal(weatherEndpoint('2020-01-01', Date.parse('2026-11-01')).type, 'historical_model')
  assert.equal(weatherEndpoint('2026-11-02', Date.parse('2026-11-01')).type, 'forecast')
})
test('missing API weather values remain null and units are checked', () => {
  const mappings = { wind_speed_10m: 'wind_speed', temperature_2m: 'air_temperature' }
  const body = { hourly: { time: [1,2], wind_speed_10m: [null,0], temperature_2m: [null,-2] }, hourly_units: { wind_speed_10m: 'm/s', temperature_2m: '°C' } }
  assert.equal(parseConditions(body,mappings).length,1)
  assert.equal(parseConditions(body,mappings)[0].wind_speed,0)
  assert.throws(() => parseConditions({ ...body, hourly_units: { wind_speed_10m: 'km/h' } },mappings))
})
test('suits allow custom text and normalize previous values without guessing equipment', () => {
  const suits = wetsuitNames(['  Custom   suit ','custom suit','',null])
  assert.equal(suits.filter(s => s.toLowerCase().includes('custom')).length,1)
  assert.ok(suits.includes('3/2mm'))
})
test('prefill supports partial failures, does not request missing coordinates', async () => {
  const session = { id: 'draft-test', started_at: '2025-06-02T00:00:00Z', ended_at: '2025-06-02T02:00:00Z' }
  let calls = 0
  const fetcher = async url => {
    calls++
    if (url.includes('archive-api')) return { ok: false, status: 503 }
    const params = new URL(url).searchParams
    const hourly = { time: [Date.parse('2025-06-02T01:00:00Z') / 1000] }
    for (const key of params.get('hourly').split(',')) hourly[key] = [key === 'sea_surface_temperature' ? 19 : 1]
    return { ok: true, json: async () => ({ hourly }) }
  }
  await fetchConditionSnapshot(session, {}, { fetcher })
  assert.equal(calls,0)
  const result = await fetchConditionSnapshot(session,{ latitude: 37, longitude: 129 }, { fetcher, now: Date.parse('2026-11-01') })
  assert.equal(result.values.water_temperature.value,19)
  assert.equal(result.values.wave_height.value,1)
  assert.equal(result.values.wind_speed,undefined)
  assert.equal(result.errors.length,1)
  assert.equal(calls,3)
  assert.equal(result.hourly.length,2)
  assert.equal(result.hourly[0].raw_response.hourly.wave_height[0],1)
  assert.equal(result.hourly[1].raw_response.hourly.sea_surface_temperature[0],19)
})
