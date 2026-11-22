import { coordinates } from '../services/marineApi.js'
import { cleanName, nameKey } from './suggestions.js'
import { markWindStorage, normalizeWindRecord, windNeedsReview } from '../lib/windUnits.js'
export const conditionFields = {
  wave_height: { label: '파고', unit: 'm', min: 0, max: 50 },
  wave_period: { label: '파도 주기', unit: 's', min: 0, max: 100 },
  swell_height: { label: '너울 높이', unit: 'm', min: 0, max: 50 },
  swell_period: { label: '너울 주기', unit: 's', min: 0, max: 100 },
  swell_direction: { label: '너울 방향', unit: '°', min: 0, max: 360, direction: true },
  wind_speed: { label: '풍속', unit: 'm/s', displayUnit: 'kts', min: 0, max: 150 },
  wind_direction: { label: '풍향', unit: '°', min: 0, max: 360, direction: true },
  water_temperature: { label: '수온', unit: '°C', min: -10, max: 50 },
  air_temperature: { label: '기온', unit: '°C', min: -100, max: 70 },
}
export const compassPoints = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
export function compass(value) {
  if (value === null || value === undefined || value === '') return '알 수 없음'
  return compassPoints[Math.round(((Number(value) % 360 + 360) % 360) / 22.5) % 16]
}
export function validLocation(spot) { try { coordinates(spot); return true } catch { return false } }
export function initialRatings(session, keys) {
  return Object.fromEntries(keys.map(k => [k, session ? session[k] ?? '' : 3]))
}
export function initialIntent(session, keys) {
  return Object.fromEntries(keys.map(k => [k, session ? 'legacy' : 'default']))
}
export function contextKey(spot, start, end) {
  if (!validLocation(spot) || !Number.isFinite(Date.parse(start)) || !(Date.parse(end) > Date.parse(start))) return ''
  return JSON.stringify([Number(spot.latitude), Number(spot.longitude), new Date(start).toISOString(), new Date(end).toISOString()])
}
export function mergePrefill(state, incoming, context) {
  state=normalizeWindRecord(state)
  const next = { ...state, api_values: { ...(state.api_values || {}), ...incoming }, context }
  if(windNeedsReview(state)) next.api_values.wind_speed=state.api_values?.wind_speed
  for (const key of Object.keys(incoming)) if (!state.manual_fields?.includes(key) && !(key==='wind_speed' && windNeedsReview(state))) {
    next[key] = incoming[key]?.value ?? null
    if(key==='wind_speed') next.api_values=markWindStorage(next,'api-prefill').api_values
  }
  return next
}
export function changeCondition(state, key, value) {
  if(key==='wind_speed') state=markWindStorage(normalizeWindRecord(state),'manual-canonical-input')
  return { ...state, [key]: value, manual_fields: [...new Set([...(state.manual_fields || []), key])],
    manual_origins: { ...state.manual_origins, [key]: state.manual_origins?.[key] || { api: state.api_values?.[key] || null, context: state.context || '', edited_at: new Date().toISOString() } } }
}
export function restoreCondition(state, key) {
  const origins = { ...state.manual_origins }
  delete origins[key]
  return { ...state, [key]: state.api_values?.[key]?.value ?? null, manual_fields: (state.manual_fields || []).filter(k => k !== key), manual_origins: origins }
}
export function wetsuitNames(previous) {
  const map = new Map()
  for (const value of ['보드숏/수영복','스프링 슈트','3/2mm','4/3mm','5/3mm','5/4mm','기타', ...previous]) if (nameKey(value) && !map.has(nameKey(value))) map.set(nameKey(value), cleanName(value))
  return [...map.values()]
}
