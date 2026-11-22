import { conditionFields } from './conditionModel.js'
import { seoulParts } from './dates.js'
import { forecastRange, forecastState } from './forecast.js'
import { timestampValues } from './timestampEdits.js'
import { normalizeWindRecord, windResolution } from '../lib/windUnits.js'

export const savedFields = ['wave_height','wave_period','swell_direction','wind_speed','wind_direction','water_temperature','air_temperature']
export function conditionRecord(value) { return (Array.isArray(value) ? value[0] : value) || {} }
export function savedValue(row, key) {
  if(key==='wind_speed') return windResolution(row).value
  const raw = Object.hasOwn(row,key) ? row[key] : row.manual_fields?.includes(key) ? null : row.api_values?.[key]?.value
  if (raw == null || (typeof raw==='string' && raw.trim()==='') || typeof raw === 'boolean') return null
  const n=Number(raw), spec=conditionFields[key]
  return Number.isFinite(n) && n>=spec.min && n<=spec.max ? n : null
}
export function formatSaved(value,unit) { return value == null ? '-' : new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value)+unit }
function hasValues(row) { return savedFields.some(key=>savedValue(row,key)!=null || row.manual_fields?.includes(key)) }
function timeLabel(row) {
  const start=row.forecast_at || row.started_at, end=row.ended_at
  const a=seoulParts(start)
  if(!row.forecast_at && Number.isFinite(Date.parse(end)) && Date.parse(end)>Date.parse(start)+1000) {
    const b=seoulParts(end)
    return a.date+' '+a.time+' ~ '+(a.date===b.date ? '' : b.date+' ')+b.time
  }
  return a.date+' '+a.time
}
// Presentation only: never regenerate forecasts or mutate the stored record.
export function savedConditionRows(session, input=session.conditions) {
  const base=normalizeWindRecord(conditionRecord(input))
  const modern=(base.condition_intervals || []).some(row=>row.id?.startsWith('forecast:') && row.forecast_at && row.manual_fields?.length)
  const legacyManual=(base.condition_intervals || []).some(row=>!row.id?.startsWith('forecast:') && row.manual_fields?.length)
  if(modern || (base.condition_hourly?.length && !legacyManual)) {
    const forecasts=forecastState(base,forecastRange(session.started_at,session.ended_at),base.context || '')._forecast
    if(forecasts.length) return forecasts.map(forecast=>{
      const row=timestampValues(base,forecast)
      return {id:forecast.id,timestamp:forecast.forecast_at,label:timeLabel(forecast),values:Object.fromEntries(savedFields.map(key=>[key,savedValue(row,key)])),estimates:savedFields.filter(key=>row[key]!=null && !row.manual_fields.includes(key) && row.api_values[key]?.value!=null)}
    })
  }
  const intervals=(base.condition_intervals || []).filter(row=>{
    const t=Date.parse(row.forecast_at || row.started_at), end=Date.parse(row.ended_at)
    if(!Number.isFinite(t) || !hasValues(row)) return false
    if(row.manual_fields?.length) return true
    return t>=Date.parse(session.started_at) && t<=Date.parse(session.ended_at) && (!Number.isFinite(end) || end<=Date.parse(session.ended_at)+1)
  }).slice().sort((a,b)=>Date.parse(a.forecast_at || a.started_at)-Date.parse(b.forecast_at || b.started_at))
  const manual=intervals.filter(row=>row.manual_fields?.length)
  const candidates=manual.length ? manual : hasValues(base) ? [] : intervals
  const sources=candidates.length ? candidates : [base]
  const rows=sources.map((row,index)=>{
    const values={}, estimates=[]
    for(const key of savedFields) {
      const source=row.manual_fields?.includes(key) ? row : base.manual_fields?.includes(key) ? base : savedValue(row,key)!=null ? row : base
      values[key]=savedValue(source,key)
      if(values[key]!=null && !source.manual_fields?.includes(key) && source.api_values?.[key]?.value!=null) estimates.push(key)
    }
    return { id:row.id || 'session-'+index, timestamp:row===base ? null : row.forecast_at || row.started_at, label:row===base ? '전체' : timeLabel(row), values, estimates }
  })
  // Keep an independently recorded session value if timestamped edits differ.
  if(candidates.length && savedFields.some(key=>base.manual_fields?.includes(key) && rows.some(row=>row.values[key]!==savedValue(base,key)))) {
    rows.unshift({id:'session',label:'전체',values:Object.fromEntries(savedFields.map(key=>[key,savedValue(base,key)])),estimates:[]})
  }
  return rows
}
export function calendarConditions(session) {
  const rows=savedConditionRows(session)
  return { ...rows[0], multiple:rows.length>1 }
}
