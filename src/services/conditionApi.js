import { fetchMarine, coordinates, requestFor } from './marineApi.js'
import { conditionFields, contextKey } from '../journal/conditionModel.js'

export function representative(rows, start, end) {
  const a = Date.parse(start), b = Date.parse(end), midpoint = (a + b) / 2
  return rows.filter(r => Date.parse(r.sampled_at) >= a && Date.parse(r.sampled_at) < b)
    .sort((x,y) => Math.abs(Date.parse(x.sampled_at) - midpoint) - Math.abs(Date.parse(y.sampled_at) - midpoint) || Date.parse(x.sampled_at) - Date.parse(y.sampled_at))[0] || null
}
export function weatherEndpoint(start, now = Date.now()) {
  return Date.parse(start) < now - 90 * 86400000
    ? { url: 'https://archive-api.open-meteo.com/v1/archive', model: 'era5', type: 'historical_model' }
    : { url: 'https://api.open-meteo.com/v1/forecast', model: null, type: Date.parse(start) < now ? 'archived_forecast' : 'forecast' }
}
async function json(url, fetcher) {
  const r = await fetcher(url, { signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error('API 요청 실패 (' + r.status + ')')
  const body = await r.json()
  if (body.error || !Array.isArray(body.hourly?.time)) throw new Error('API 데이터 없음')
  return body
}
export function parseConditions(body, mappings) {
  return body.hourly.time.flatMap((seconds, i) => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return []
    const row = { sampled_at: new Date(seconds * 1000).toISOString() }
    for (const [api, field] of Object.entries(mappings)) {
      const value = body.hourly[api]?.[i], spec = conditionFields[field]
      if (body.hourly_units?.[api] && body.hourly_units[api] !== spec.unit) throw new Error('API 단위 불일치')
      row[field] = typeof value === 'number' && Number.isFinite(value) && value >= spec.min && value <= spec.max ? value : null
    }
    return Object.keys(mappings).some(k => row[mappings[k]] !== null) ? [row] : []
  })
}
const cache = new Map()
export function fetchConditionSnapshot(session, spot, { fetcher = fetch, now = Date.now(), savedMarine = [] } = {}) {
  const key = contextKey(spot, session.started_at, session.ended_at)
  if (!key) return Promise.resolve({ values: {}, errors: ['위치와 시작·종료 시각을 확인해 주세요.'] })
  const hit = cache.get(key)
  if (hit && hit.expires > now) return hit.task
  const task = (async () => {
    const point = coordinates(spot)
    const start = Date.parse(session.started_at), end = Date.parse(session.ended_at)
    if (end - start > 32 * 86400000) throw new Error('조건 조회 범위가 너무 깁니다.')
    const first = Math.ceil(start / 3600000) * 3600000, last = Math.ceil(end / 3600000) * 3600000 - 3600000
    if (first > last) return { values: Object.fromEntries(Object.keys(conditionFields).map(k => [k, { value: null, context: key }])), errors: ['세션 구간 내 시간별 데이터 없음'] }
    const dates = { latitude: point.latitude, longitude: point.longitude, start_date: new Date(first).toISOString().slice(0,10), end_date: new Date(last).toISOString().slice(0,10), timezone: 'GMT', timeformat: 'unixtime' }
    const weather = weatherEndpoint(session.started_at, now)
    function url(base, params) {
      const u = new URL(base)
      for (const [k,v] of Object.entries(params)) u.searchParams.set(k, String(v))
      return u.toString()
    }
    const available = savedMarine.filter(s => Number(s.requested_latitude) === point.latitude && Number(s.requested_longitude) === point.longitude && Date.parse(s.session_started_at) === start && Date.parse(s.session_ended_at) === end)
    const waveFields = ['wave_height','wave_period','swell_height','swell_period','swell_direction']
    const raw = {}
    async function rawJson(name, requestUrl) {
      const body = await json(requestUrl, fetcher)
      raw[name] = body
      return body
    }
    const groups = [
      { fields: waveFields, source: 'marine', model: 'meteofrance_wave', type: start < now ? 'archived_forecast' : 'forecast', run: async () => {
        if (available.length) return available
        if (!requestFor(session, spot, now)) return []
        return fetchMarine(session, spot, { fetcher: async (...args) => {
          const response = await fetcher(...args)
          return { ok: response.ok, status: response.status, json: async () => {
            const body = await response.json()
            raw.wave = body
            return body
          } }
        }, now })
      } },
      { fields: ['water_temperature'], source: 'marine', model: 'best_match SST', type: start < now ? 'archived_forecast' : 'forecast', run: async () => {
        if (first < Date.parse('2022-01-01T00:00:00Z') || last > now + 9 * 86400000) return []
        return parseConditions(await rawJson('sst', url('https://marine-api.open-meteo.com/v1/marine', { ...dates, hourly: 'sea_surface_temperature', cell_selection: 'sea' })), { sea_surface_temperature: 'water_temperature' })
      } },
      { fields: ['wind_speed','wind_direction','air_temperature'], source: 'weather', model: weather.model || 'best_match', type: weather.type, run: async () => parseConditions(await rawJson('weather', url(weather.url, { ...dates, hourly: 'wind_speed_10m,wind_direction_10m,temperature_2m', wind_speed_unit: 'ms', ...(weather.model ? { models: weather.model } : {}) })), { wind_speed_10m: 'wind_speed', wind_direction_10m: 'wind_direction', temperature_2m: 'air_temperature' }) },
    ]
    const responses = await Promise.allSettled(groups.map(g => g.run()))
    const values = {}, errors = [], hourly = []
    responses.forEach((r,i) => {
      const g = groups[i]
      const row = r.status === 'fulfilled' ? representative(r.value.filter(sample => g.fields.some(field => sample[field] != null)), session.started_at, session.ended_at) : null
      if (r.status === 'rejected') { errors.push(g.source + ': ' + r.reason.message); return }
      hourly.push({ fields: g.fields, rows: r.value, raw_response: raw[['wave','sst','weather'][i]] || null, metadata: { provider: 'open-meteo', source: g.source, model: g.model, source_type: g.type, fetched_at: new Date(now).toISOString(), context: key } })
      for (const field of g.fields) values[field] = { value: row?.[field] ?? null, sampled_at: row?.sampled_at ?? null, provider: 'open-meteo', source: g.source, model: g.model, source_type: g.type, fetched_at: row?.fetched_at || new Date(now).toISOString(), context: key }
    })
    if (errors.length) cache.delete(key)
    return { values, errors, hourly }
  })().catch(e => { cache.delete(key); throw e })
  if (cache.size > 30) cache.delete(cache.keys().next().value)
  cache.set(key, { task, expires: now + 5 * 60000 })
  return task
}
