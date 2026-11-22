import { isWindUnit, windAudit, apiWind } from './windUnits.js'

// Only interpretation metadata changes. Original numbers and source units stay intact.
export function windReviewPatch(record,issue,unit,confirmedAt=new Date().toISOString()) {
  if(!isWindUnit(unit)) throw new Error('풍속 단위를 선택해 주세요.')
  const current=windAudit(record).find(item=>item.path===issue.path && item.time===issue.time && item.value===issue.value)
  if(!current) throw new Error('기록이 변경되었거나 이미 확인되었습니다. 다시 불러와 주세요.')
  const review={unit,original_value:current.value,confirmed_at:confirmedAt}
  if(apiWind(current.value,{},review).unit==='unknown') throw new Error('해당 단위로 해석할 수 없는 풍속입니다.')
  if(issue.path==='session') return {api_values:{...record.api_values,_wind_speed_review:review}}
  const interval=/^condition_intervals\[(\d+)\]$/.exec(issue.path)
  if(interval) return {condition_intervals:record.condition_intervals.map((row,i)=>i===Number(interval[1]) ? {...row,api_values:{...row.api_values,_wind_speed_review:review}} : row)}
  const hourly=/^condition_hourly\[(\d+)\]\.rows\[(\d+)\]$/.exec(issue.path)
  if(hourly) return {condition_hourly:record.condition_hourly.map((group,i)=>i===Number(hourly[1]) ? {...group,rows:group.rows.map((row,j)=>j===Number(hourly[2]) ? {...row,wind_speed_review:review} : row)} : group)}
  throw new Error('지원하지 않는 기록 위치입니다.')
}
