import { seoulParts } from './dates.js'
import { parseTime } from './timePicker.js'
export function sessionTimes(date,start,end,session) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !parseTime(start) || !parseTime(end)) return {error:'시작·종료 시간을 확인해 주세요.',started_at:'',ended_at:''}
  const originalStart=session && seoulParts(session.started_at),originalEnd=session && seoulParts(session.ended_at)
  const day=originalStart?.date || date
  const at=(d,t)=>d+'T'+t+':00+09:00'
  if(!Number.isFinite(Date.parse(at(day,start))) || seoulParts(at(day,start)).date!==day) return {error:'날짜를 확인해 주세요.',started_at:'',ended_at:''}
  let started_at=at(day,start),ended_at
  if(session && start===originalStart.time && end===originalEnd.time) {
    started_at=session.started_at;ended_at=session.ended_at
  } else {
    const longLegacy=session && Date.parse(session.ended_at)-Date.parse(session.started_at)>=86400000
    if(start===end && !longLegacy) return {error:'시작과 종료 시간은 달라야 합니다.',started_at:'',ended_at:''}
    const endDate=longLegacy ? originalEnd.date : end<start ? new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10) : day
    if(session && start===originalStart.time) started_at=session.started_at
    ended_at=session && end===originalEnd.time && endDate===originalEnd.date ? session.ended_at : at(endDate,end)
  }
  if(Date.parse(ended_at)<=Date.parse(started_at)) return {error:'종료 시각은 시작 시각 이후여야 합니다.',started_at:'',ended_at:''}
  const endDate=seoulParts(ended_at).date
  return {started_at,ended_at,date:day,endDate,overnight:endDate!==day,nextDay:endDate===new Date(Date.parse(day+'T00:00:00Z')+86400000).toISOString().slice(0,10),error:''}
}
