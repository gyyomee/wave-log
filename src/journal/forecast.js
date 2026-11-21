import { contextKey, conditionFields } from './conditionModel.js'
import { retainedInputs, relevantHourly, resetAutomaticValues, unresolvedSources } from './conditionPersistence.js'
const hour = 3600000, step = 3 * hour, offset = 9 * hour
export function forecastRange(start, end) {
  const a = Date.parse(start), b = Date.parse(end)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b-a > 31*24*hour) return []
  const first = Math.floor((a+offset)/step)*step-offset
  const previous = Math.floor((b+offset)/step)*step-offset
  const last = b-previous<=90*60000 ? previous : previous+step
  const rows = []
  for (let time=first; time<=last; time+=step) {
    const forecast_at = new Date(time).toISOString()
    rows.push({ id:'forecast:'+forecast_at, forecast_at })
  }
  return rows
}
export function forecastState(state, ranges, ctx) {
  const condition_hourly=relevantHourly(state.condition_hourly,ranges,ctx)
  const forecast=ranges.map(range=>{
    const row={...range,api_values:{}}
    for(const key of Object.keys(conditionFields)) row[key]=null
    for(const group of condition_hourly) {
      const sample=group.rows.find(item=>Date.parse(item.sampled_at)===Date.parse(range.forecast_at))
      if(!sample) continue
      for(const key of group.fields) {
        const spec=conditionFields[key], value=sample[key]
        row[key]=typeof value==='number' && value>=spec.min && value<=spec.max ? value : null
        row.api_values[key]={...group.metadata,value:row[key],sampled_at:sample.sampled_at}
      }
    }
    return row
  })
  return {...resetAutomaticValues(state,ctx),context:ctx,condition_intervals:retainedInputs(state.condition_intervals),condition_hourly:[...unresolvedSources(state.condition_hourly),...condition_hourly],_forecast:forecast}
}
export function forecastRequest(start,end,spot) {
  const ranges=forecastRange(start,end)
  if (!ranges.length) return null
  const started_at=ranges[0].forecast_at
  const ended_at=new Date(Date.parse(ranges.at(-1).forecast_at)+hour).toISOString()
  return { started_at,ended_at,context:contextKey(spot,started_at,ended_at) }
}
export function currentManualIntervals(state,start,end) {
  return retainedInputs(state.condition_intervals)
}
