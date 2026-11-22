import { conditionFields } from './conditionModel.js'
import { apiWind, hourlyWindMetadata, windNeedsReview } from '../lib/windUnits.js'
const keys = Object.keys(conditionFields)
const intervalKeys=new Set([...keys,'id','forecast_at','started_at','ended_at','api_values','manual_fields','manual_origins','context'])
export function isAutomaticInterval(row) {
  if(windNeedsReview(row)) return false
  if(Object.keys(row).some(key=>!intervalKeys.has(key))) return false
  if (row.manual_fields?.length || Object.keys(row.manual_origins || {}).length) return false
  if (!/^(forecast:)?\d{4}-\d{2}-\d{2}T/.test(row.id || '')) return false
  return keys.every(key => row[key] == null || row[key] === '' || (
    row.api_values?.[key]?.value != null && Number(row[key]) === Number(row.api_values[key].value)))
}
export function retainedInputs(rows = []) {
  return rows.filter(row => !isAutomaticInterval(row))
}
export function unresolvedSources(groups = []) {
  return groups.filter(group=>{
    try {
      const point=JSON.parse(group.metadata.context)
      return !Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) ||
        !Array.isArray(group.fields) || !Array.isArray(group.rows) ||
        group.rows.some(row=>!Number.isFinite(Date.parse(row.sampled_at))) ||
        (group.metadata.provider != null && group.metadata.provider!=='open-meteo')
    } catch { return true }
  })
}
// Keep the newest source value per field/timestamp, with its own provenance.
// Never retain full-day raw responses outside the selected forecast range.
export function relevantHourly(groups, ranges, ctx) {
  if (!ranges.length || !ctx) return []
  let point
  try { point=JSON.parse(ctx) } catch { return [] }
  const first=Date.parse(ranges[0].forecast_at), last=Date.parse(ranges.at(-1).forecast_at)
  const samples=new Map()
  const uncertain=new Set(unresolvedSources(groups))
  for (const group of groups || []) {
    if(uncertain.has(group)) continue
    let source
    try { source=JSON.parse(group.metadata.context) } catch { continue }
    if (source[0]!==point[0] || source[1]!==point[1]) continue
    for (const row of group.rows || []) {
      const time=Date.parse(row.sampled_at)
      if (time<first || time>last || !Number.isFinite(time)) continue
      for (const key of group.fields || []) {
        if (!keys.includes(key)) continue
        const id=key+':'+time, old=samples.get(id)
        if (old && Date.parse(old.metadata.fetched_at)>Date.parse(group.metadata.fetched_at)) continue
        const originalExtras=Object.fromEntries(Object.entries(row).filter(([name])=>!keys.includes(name)))
        samples.set(id,{fields:[key],rows:[{...originalExtras,[key]:row[key] ?? null}],metadata:{...hourlyWindMetadata(group)}})
      }
    }
  }
  const compact=new Map()
  for(const sample of samples.values()) {
    const id=JSON.stringify(sample.metadata)
    if(!compact.has(id)) compact.set(id,{fields:[],rows:[],metadata:sample.metadata})
    const group=compact.get(id), field=sample.fields[0], row=sample.rows[0]
    if(!group.fields.includes(field)) group.fields.push(field)
    const existing=group.rows.find(item=>item.sampled_at===row.sampled_at)
    if(existing) existing[field]=row[field]
    else group.rows.push({...row})
  }
  return [...compact.values()]
}
export function resetAutomaticValues(state, selection) {
  const next={...state}
  const changed=(state._selection || state.context) !== selection
  if (changed) {
    next.api_values={}
    // Selection changes must not erase the unit tag of preserved manual data.
    if(state.api_values?._wind_speed_storage) next.api_values._wind_speed_storage=state.api_values._wind_speed_storage
    if(state.api_values?._wind_speed_review) next.api_values._wind_speed_review=state.api_values._wind_speed_review
    if(windNeedsReview(state) && state.api_values?.wind_speed) next.api_values.wind_speed=state.api_values.wind_speed
    for (const key of keys) {
      if(key==='wind_speed' && windNeedsReview(state)) continue
      if (state.manual_fields?.includes(key)) continue
      const value=state[key], source=state.api_values?.[key], api=key==='wind_speed' && source ? apiWind(source.value,source) : source
      if (value == null || value === '' || (api?.value != null && Number(value)===Number(api.value))) next[key]=null
      else {
        // Legacy values without trustworthy provenance are user data until reviewed.
        next.manual_fields=[...new Set([...(next.manual_fields || []),key])]
      }
    }
  }
  return {...next,_selection:selection}
}
export function sessionValues(groups,start,end) {
  const midpoint=(Date.parse(start)+Date.parse(end))/2, values={}
  for (const key of keys) {
    const candidates=(groups || []).flatMap(group=>group.fields.includes(key) ? group.rows.filter(row=>row[key]!=null && Date.parse(row.sampled_at)>=Date.parse(start) && Date.parse(row.sampled_at)<Date.parse(end)).map(row=>({row,metadata:group.metadata})) : [])
    candidates.sort((a,b)=>Math.abs(Date.parse(a.row.sampled_at)-midpoint)-Math.abs(Date.parse(b.row.sampled_at)-midpoint) || Date.parse(a.row.sampled_at)-Date.parse(b.row.sampled_at))
    const chosen=candidates[0]
    if(chosen) {
      const normalized=key==='wind_speed' ? apiWind(chosen.row[key],chosen.metadata,chosen.row.wind_speed_review) : {}
      values[key]={...chosen.metadata,value:chosen.row[key],...normalized,sampled_at:chosen.row.sampled_at}
    }
  }
  return values
}
