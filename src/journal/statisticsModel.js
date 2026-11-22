import { seoulParts } from './dates.js'
import { cleanName, nameKey } from './suggestions.js'
import { conditionRecord, savedConditionRows } from './savedConditions.js'
import { forecastRange } from './forecast.js'
import { windAudit, windInventory } from '../lib/windUnits.js'

const finite=value=>typeof value==='number' && Number.isFinite(value)
export const mean=values=>{const valid=values.filter(finite);return valid.length ? valid.reduce((a,b)=>a+b,0)/valid.length : null}
const score=value=>Number.isInteger(value) && value>=1 && value<=5 ? value : null
export function filterStatistics(sessions,{from='',to='',spotId=''}={}) {
  return sessions.filter(session=>{
    if(!Number.isFinite(Date.parse(session.started_at))) return false
    const day=seoulParts(session.started_at).date
    return (!from || day>=from) && (!to || day<=to) && (!spotId || session.spot_id===spotId)
  })
}
// One wind sample per session: closest saved clock point to the session midpoint.
// Ambiguous units exclude the entire session's wind, not its other statistics.
export function sessionWind(session) {
  const conditions=conditionRecord(session.conditions), reviews=windAudit(conditions)
  if(reviews.length || session.conditionsError) return {value:null,unit:'m/s',status:'review',reviews}
  const ranges=forecastRange(session.started_at,session.ended_at)
  const first=Date.parse(ranges[0]?.forecast_at),last=Date.parse(ranges.at(-1)?.forecast_at)
  const middle=(Date.parse(session.started_at)+Date.parse(session.ended_at))/2
  const rows=savedConditionRows(session).filter(row=>finite(row.values.wind_speed))
  const ranked=rows.map(row=>{
    const time=row.timestamp ? Date.parse(row.timestamp) : middle
    return {row,time}
  }).filter(item=>!item.row.timestamp || (item.time>=first && item.time<=last))
    .sort((a,b)=>Math.abs(a.time-middle)-Math.abs(b.time-middle) || a.time-b.time)
  return {value:ranked[0]?.row.values.wind_speed ?? null,unit:'m/s',status:ranked.length ? 'resolved' : 'missing',reviews:[]}
}
function summary(sessions) {
  const winds=sessions.map(sessionWind)
  return {count:sessions.length,days:new Set(sessions.map(s=>seoulParts(s.started_at).date)).size,
    hours:sessions.reduce((total,s)=>{const duration=(Date.parse(s.ended_at)-Date.parse(s.started_at))/3600000;return total+(finite(duration) && duration>0 ? duration : 0)},0),
    overall:mean(sessions.map(s=>score(s.overall_rating))),wave:mean(sessions.map(s=>score(s.wave_rating))),crowd:mean(sessions.map(s=>score(s.crowd_level))),
    windMs:mean(winds.map(w=>w.value)),windCount:winds.filter(w=>w.status==='resolved').length,windExcluded:winds.filter(w=>w.status==='review').length}
}
export function journalStatistics(sessions,filters) {
  const selected=filterStatistics(sessions,filters)
  function groups(key,label) {
    const buckets=new Map()
    for(const session of selected) {
      const id=key(session)
      if(!buckets.has(id)) buckets.set(id,{id,label:label(session),sessions:[]})
      buckets.get(id).sessions.push(session)
    }
    return [...buckets.values()].map(group=>({id:group.id,label:group.label,...summary(group.sessions)}))
  }
  const reviews=selected.flatMap(session=>windAudit(conditionRecord(session.conditions)).map(issue=>({sessionId:session.id,date:seoulParts(session.started_at).date,spot:session.spot?.name || '스팟',...issue})))
  const inventory={manual:0,apiVerified:0,apiInferred:0,reviewed:0,tagged:0,unknown:0}
  for(const session of selected) for(const entry of windInventory(conditionRecord(session.conditions))) inventory[entry.category]++
  return {...summary(selected),reviews,inventory,
    months:groups(s=>seoulParts(s.started_at).date.slice(0,7),s=>seoulParts(s.started_at).date.slice(0,7)).sort((a,b)=>b.id.localeCompare(a.id)),
    spots:groups(s=>s.spot_id,s=>s.spot?.name || '스팟').sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label)),
    boards:groups(s=>nameKey(s.board_name),s=>cleanName(s.board_name) || '미입력').sort((a,b)=>b.count-a.count || a.label.localeCompare(b.label))}
}
