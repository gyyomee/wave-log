export const variables = {
  wave_height: 'wave_height', wave_period: 'wave_period', wave_direction: 'wave_direction',
  swell_wave_height: 'swell_height', swell_wave_period: 'swell_period',
  swell_wave_direction: 'swell_direction', swell_wave_peak_period: 'swell_peak_period',
  wind_wave_height: 'wind_wave_height', wind_wave_period: 'wind_wave_period', wind_wave_direction: 'wind_wave_direction',
}
export function coordinates(spot) {
  if ([spot?.latitude, spot?.longitude].some(v => v === null || v === undefined || String(v).trim() === '')) throw new Error('스팟 좌표를 입력해 주세요.')
  const latitude = Number(spot.latitude), longitude = Number(spot.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('올바른 위도와 경도를 입력해 주세요.')
  return { latitude, longitude }
}
export function requestFor(session, spot, now = Date.now()) {
  const point = coordinates(spot)
  const start = Date.parse(session.started_at), end = Date.parse(session.ended_at)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('잘못된 세션 시간입니다.')
  if (end - start > 32 * 86400000) throw new Error('파도 조회 범위가 너무 깁니다.')
  // Only actual hourly instants within [start, end), never interpolate.
  const first = Math.ceil(start / 3600000) * 3600000
  const last = Math.ceil(end / 3600000) * 3600000 - 3600000
  if (first > last || first < Date.parse('2021-10-01T00:00:00Z') || last > now + 9 * 86400000) return null
  const url = new URL('https://marine-api.open-meteo.com/v1/marine')
  const params = { ...point, hourly: Object.keys(variables).join(','), models: 'meteofrance_wave', cell_selection: 'sea', length_unit: 'metric', timeformat: 'unixtime', timezone: 'GMT', start_date: new Date(first).toISOString().slice(0,10), end_date: new Date(last).toISOString().slice(0,10) }
  for (const [k,v] of Object.entries(params)) url.searchParams.set(k,v)
  return { url: url.toString(), first, last, point, now }
}
export function parseMarine(body, request, session) {
  if (!Array.isArray(body?.hourly?.time)) throw new Error('해양 API 응답 형식이 올바르지 않습니다.')
  for (const api of Object.keys(variables)) {
    const expected = api.endsWith('height') ? 'm' : api.endsWith('direction') ? '°' : 's'
    if (body.hourly[api]?.some(v => v !== null) && body.hourly_units?.[api] && body.hourly_units[api] !== expected) throw new Error('예상하지 못한 해양 데이터 단위입니다.')
  }
  const seen = new Set()
  return body.hourly.time.flatMap((seconds,i) => {
    const time = seconds * 1000
    if (typeof seconds !== 'number' || !Number.isFinite(time) || time < request.first || time > request.last || time % 3600000 || seen.has(time)) return []
    seen.add(time)
    const values = Object.fromEntries(Object.entries(variables).map(([api,field]) => {
      const v = body.hourly[api]?.[i]
      return [field, typeof v === 'number' && Number.isFinite(v) && v >= 0 && (!field.endsWith('direction') || v <= 360) ? v : null]
    }))
    if (Object.values(values).every(v => v === null)) return []
    return [{ session_id: session.id, sampled_at: new Date(time).toISOString(), ...values,
      data_provider: 'open-meteo', data_model: 'meteofrance_wave',
      data_source_type: time < request.now ? 'archived_forecast' : 'forecast',
      requested_latitude: request.point.latitude, requested_longitude: request.point.longitude,
      model_latitude: Number.isFinite(body.latitude) ? body.latitude : null,
      model_longitude: Number.isFinite(body.longitude) ? body.longitude : null,
      session_started_at: session.started_at, session_ended_at: session.ended_at, spot_id: session.spot_id,
      fetched_at: new Date(request.now).toISOString() }]
  })
}
const pending = new Map()
export function fetchMarine(session, spot, { fetcher = fetch, now = Date.now() } = {}) {
  const request = requestFor(session, spot, now)
  if (!request) return Promise.resolve([])
  const key = session.id + request.url + request.first + ':' + request.last
  if (pending.has(key)) return pending.get(key)
  const task = (async () => {
    const response = await fetcher(request.url, { signal: AbortSignal.timeout(20000) })
    if (!response.ok) throw new Error('해양 API 요청 실패 (' + response.status + ')')
    const body = await response.json()
    if (body.error) throw new Error('해양 API에서 요청을 처리하지 못했습니다.')
    return parseMarine(body, request, session)
  })().finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}
