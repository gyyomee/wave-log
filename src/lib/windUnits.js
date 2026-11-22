export const KNOTS_PER_MS = 3600 / 1852
export const toKnots = value => value == null ? null : value * KNOTS_PER_MS
export const fromKnots = value => value == null || value === '' ? null : Number(value) / KNOTS_PER_MS
export const isWindUnit=unit=>unit==='kts' || unit==='m/s'
export function windToDisplay(value,unit='kts') {
  if(!isWindUnit(unit)) throw new Error('Unsupported wind unit')
  return value==null ? null : unit==='kts' ? toKnots(value) : value
}
export function windFromInput(value,unit='kts') {
  if(!isWindUnit(unit)) throw new Error('Unsupported wind unit')
  return value==null || value==='' ? null : unit==='kts' ? fromKnots(value) : Number(value)
}
export function formatWind(value,unit='kts') {
  const display=windToDisplay(value,unit)
  return display==null ? '-' : new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(display)+' '+unit
}
const marker = '_wind_speed_storage'
const number = value => value == null || value === '' || typeof value === 'boolean' ? null : Number(value)
const valid = value => Number.isFinite(value) && value >= 0 && value <= 150
function unitName(unit) {
  return ({ms:'m/s','m/s':'m/s',kn:'kts',kt:'kts',kts:'kts',knots:'kts'})[unit] || null
}
function legacyWeather(meta) {
  return meta.provider === 'open-meteo' && meta.source === 'weather' &&
    ['era5','best_match'].includes(meta.model) &&
    ['forecast','archived_forecast','historical_model'].includes(meta.source_type) &&
    Number.isFinite(Date.parse(meta.fetched_at)) && typeof meta.context === 'string' && meta.context.startsWith('[')
}
function reviewedWind(value,review) {
  if(!review || !isWindUnit(review.unit) || number(value)!==number(review.original_value) || !Number.isFinite(Date.parse(review.confirmed_at))) return null
  const converted=windFromInput(value,review.unit)
  return valid(converted) ? {value:converted,unit:'m/s',reason:'user-reviewed-unit',original_value:value,original_unit:review.unit} : null
}
export function apiWind(value, meta = {}, review) {
  const raw = number(value)
  if(raw == null) return {value:null,unit:'m/s',reason:'empty'}
  const reviewed=reviewedWind(value,review)
  if(reviewed) return reviewed
  const explicit = meta.unit ?? meta.wind_speed_unit ?? meta.response_unit
  const unit = explicit != null ? unitName(explicit) : legacyWeather(meta) ? 'm/s' : null
  const converted = unit === 'kts' ? fromKnots(raw) : raw
  if(!unit || !valid(converted)) return {value:null,unit:'unknown',reason:'missing-or-invalid-api-unit',original_value:value}
  return {value:converted,unit:'m/s',reason:explicit != null ? 'explicit-api-unit' : 'legacy-ms-request-code',original_value:value,original_unit:unit}
}
export function windResolution(row = {}) {
  const raw = Object.hasOwn(row,'wind_speed') ? row.wind_speed : row.manual_fields?.includes('wind_speed') ? null : row.api_values?.wind_speed?.value
  const stored = row.api_values?.[marker]
  const reviewed=reviewedWind(raw,row.api_values?._wind_speed_review)
  if(stored?.unit!=='m/s' && reviewed) return reviewed
  if(stored) {
    const value=number(raw)
    return stored.unit === 'm/s' && (value == null || valid(value))
      ? {value,unit:'m/s',reason:stored.reason || 'tagged-storage'}
      : {value:null,unit:'unknown',reason:stored.reason || 'review-required',original_value:raw}
  }
  if(raw == null || raw === '') return {value:null,unit:'m/s',reason:'empty'}
  if(row.manual_fields?.includes('wind_speed')) {
    const value=fromKnots(raw)
    return valid(value) ? {value,unit:'m/s',reason:'historical-manual-knots',original_value:raw,original_unit:'kts'} : {value:null,unit:'unknown',reason:'invalid-manual-value',original_value:raw}
  }
  const api=row.api_values?.wind_speed
  if(api && number(raw) === number(api.value)) return apiWind(raw,api)
  return {value:null,unit:'unknown',reason:'unclassified-record',original_value:raw}
}
export function normalizeWindRow(row = {}) {
  if(row.api_values?.[marker]?.unit==='m/s' || (!Object.hasOwn(row,'wind_speed') && !row.api_values?.wind_speed)) return row
  const result=windResolution(row)
  return {...row,wind_speed:result.unit==='unknown' ? row.wind_speed ?? row.api_values?.wind_speed?.value : result.value,
    api_values:{...row.api_values,[marker]:{version:1,...result}}}
}
export function normalizeWindRecord(record = {}) {
  const row=normalizeWindRow(record)
  return {...row,...(record.condition_intervals ? {condition_intervals:record.condition_intervals.map(normalizeWindRow)} : {})}
}
// Values passed here are canonical m/s. Historical raw input stays in the marker.
export function markWindStorage(row, reason) {
  return {...row,api_values:{...row.api_values,[marker]:{...row.api_values?.[marker],version:1,unit:'m/s',reason}}}
}
export function windNeedsReview(row) { return windResolution(row).unit === 'unknown' }
export function hourlyWindMetadata(group) {
  const responseUnit=group.raw_response?.hourly_units?.wind_speed_10m
  return responseUnit ? {...group.metadata,response_unit:responseUnit} : group.metadata || {}
}
export function windInventory(record = {}) {
  const entries=[]
  for(const [path,row] of [['session',record],...(record.condition_intervals || []).map((row,i)=>['condition_intervals['+i+']',row])]) {
    const result=windResolution(row)
    const value=Object.hasOwn(row,'wind_speed') ? row.wind_speed : row.manual_fields?.includes('wind_speed') ? null : row.api_values?.wind_speed?.value
    if(value==null || value==='') continue
    entries.push({path,time:row.forecast_at || row.started_at || null,value,reason:result.reason,
      category:result.unit==='unknown' ? 'unknown' : result.reason==='user-reviewed-unit' ? 'reviewed' : row.manual_fields?.includes('wind_speed') && result.reason!=='manual-canonical-input' ? 'manual' : result.reason==='legacy-ms-request-code' ? 'apiInferred' : result.reason==='explicit-api-unit' ? 'apiVerified' : 'tagged'})
  }
  for(const [i,group] of (record.condition_hourly || []).entries()) {
    if(!group.fields?.includes('wind_speed')) continue
    for(const [j,row] of (group.rows || []).entries()) {
      if(row.wind_speed==null || row.wind_speed==='') continue
      const result=apiWind(row.wind_speed,hourlyWindMetadata(group),row.wind_speed_review)
      entries.push({path:'condition_hourly['+i+'].rows['+j+']',time:row.sampled_at,value:row.wind_speed,reason:result.reason,
        category:result.unit==='unknown' ? 'unknown' : result.reason==='user-reviewed-unit' ? 'reviewed' : result.reason==='legacy-ms-request-code' ? 'apiInferred' : 'apiVerified'})
    }
  }
  return entries
}
export function windAudit(record = {}) { return windInventory(record).filter(entry=>entry.category==='unknown') }
