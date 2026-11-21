import { conditionFields, changeCondition } from './conditionModel.js'
function sameLocation(a,b) {
  try {
    const left=JSON.parse(a),right=JSON.parse(b)
    return Number.isFinite(left[0]) && Number.isFinite(left[1]) && left[0]===right[0] && left[1]===right[1]
  } catch { return false }
}
export function timestampValues(state, forecast) {
  const saved=(state.condition_intervals || []).find(row=>Date.parse(row.forecast_at)===Date.parse(forecast.forecast_at))
  const values={...forecast,manual_fields:[],api_values:forecast.api_values || {}}
  for(const key of Object.keys(conditionFields)) {
    const original=saved?.api_values?.[key]
    if(!Object.hasOwn(forecast.api_values || {},key) && Date.parse(original?.sampled_at)===Date.parse(forecast.forecast_at) && sameLocation(original?.context || saved?.context,state.context)) {
      values[key]=original.value ?? null
      values.api_values={...values.api_values,[key]:original}
    }
    if(saved?.manual_fields?.includes(key)) { values[key]=saved[key] ?? null; values.manual_fields.push(key) }
    else {
      const legacy=(state.condition_intervals || []).find(row=>!row.forecast_at && row.manual_fields?.includes(key) && Date.parse(row.started_at)<=Date.parse(forecast.forecast_at) && Date.parse(row.ended_at)>Date.parse(forecast.forecast_at))
      const source=legacy || (state.manual_fields?.includes(key) ? state : null)
      if(source) { values[key]=source[key] ?? null; values.manual_fields.push(key) }
      else if(!Object.hasOwn(forecast.api_values || {},key) && values[key]==null && Date.parse(state.api_values?.[key]?.sampled_at)===Date.parse(forecast.forecast_at) && sameLocation(state.api_values[key].context,state.context)) values[key]=state[key] ?? null
    }
  }
  return values
}
export function editTimestamp(state, forecast, key, value, context) {
  const rows=[...(state.condition_intervals || [])]
  const index=rows.findIndex(row=>Date.parse(row.forecast_at)===Date.parse(forecast.forecast_at))
  const existing=index>=0 ? rows[index] : {id:forecast.id,forecast_at:forecast.forecast_at,started_at:forecast.forecast_at,ended_at:new Date(Date.parse(forecast.forecast_at)+1).toISOString(),manual_fields:[],api_values:{}}
  const updated=changeCondition({...existing,context,api_values:{...existing.api_values,...forecast.api_values}},key,value)
  if(index>=0) rows[index]=updated
  else rows.push(updated)
  return {...state,condition_intervals:rows}
}
export function canResetCondition(row,key) {
  const value=row.api_values?.[key]?.value, spec=conditionFields[key]
  return row.manual_fields?.includes(key) && typeof value==='number' && Number.isFinite(value) && value>=spec.min && value<=spec.max
}
export function resetTimestamp(state,forecast,key,context) {
  const row=timestampValues(state,forecast)
  if(!canResetCondition(row,key)) return state
  return editTimestamp(state,{...forecast,api_values:row.api_values},key,row.api_values[key].value,context)
}
