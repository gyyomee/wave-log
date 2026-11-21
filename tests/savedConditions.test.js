import test from 'node:test'
import assert from 'node:assert/strict'
import { savedConditionRows, calendarConditions, formatSaved } from '../src/journal/savedConditions.js'

const session={id:'s',started_at:'2026-11-01T00:00:00Z',ended_at:'2026-11-01T06:00:00Z',wave_rating:5}
function snapshot(time,height,manual=false) {
  return {id:time,forecast_at:time,started_at:time,ended_at:new Date(Date.parse(time)+1).toISOString(),wave_height:height,wave_period:9,manual_fields:manual?['wave_height']:[],api_values:{wave_height:{value:0.5}}}
}
test('calendar and detail use the same saved values, not wave ratings or API originals',()=>{
  const s={...session,conditions:{wave_height:0.8,wave_period:9,manual_fields:['wave_height'],api_values:{wave_height:{value:1.5}},condition_intervals:[snapshot('2026-11-01T03:00:00Z',1.5)]}}
  assert.equal(savedConditionRows(s).length,1)
  assert.equal(calendarConditions(s).values.wave_height,0.8)
  assert.equal(calendarConditions(s).values.wave_period,9)
  assert.deepEqual(calendarConditions(s).values,savedConditionRows(s)[0].values)
})
test('manual clearing and zero values do not fall back to API values',()=>{
  const s={...session,conditions:{wave_height:null,wave_period:0,manual_fields:['wave_height'],api_values:{wave_height:{value:2}}}}
  assert.equal(calendarConditions(s).values.wave_height,null)
  assert.equal(formatSaved(calendarConditions(s).values.wave_height,'m'),'-')
  assert.equal(formatSaved(calendarConditions(s).values.wave_period,'s'),'0s')
})
test('old sessions without condition records display missing values safely',()=>{
  assert.equal(calendarConditions(session).values.wave_height,null)
  assert.equal(savedConditionRows({...session,conditions:[]}).length,1)
  assert.equal(calendarConditions({...session,conditions:[{wave_height:'1.2',wave_period:'8'}]}).values.wave_height,1.2)
})
test('multiple manual samples remain individually timestamped and are never averaged',()=>{
  const data={wave_height:0.5,api_values:{wave_height:{value:0.5}},condition_intervals:[snapshot('2026-11-01T04:00:00Z',1.2,true),snapshot('2026-11-01T01:00:00Z',0.8,true)]}
  const original=JSON.stringify(data), s={...session,conditions:data}
  const rows=savedConditionRows(s)
  assert.deepEqual(rows.map(row=>row.values.wave_height),[0.8,1.2])
  assert.equal(calendarConditions(s).values.wave_height,0.8)
  assert.equal(calendarConditions(s).multiple,true)
  assert.equal(JSON.stringify(data),original)
})
test('independent manual session values are not lost when point edits differ',()=>{
  const s={...session,conditions:{wave_height:2,manual_fields:['wave_height'],condition_intervals:[snapshot('2026-11-01T01:00:00Z',1,true)]}}
  assert.deepEqual(savedConditionRows(s).map(row=>row.values.wave_height),[2,1])
})
test('legacy automatic snapshots are bounded to the saved session and dates survive midnight',()=>{
  const s={...session,started_at:'2026-11-01T14:00:00Z',ended_at:'2026-11-01T17:00:00Z',conditions:{condition_intervals:[
    snapshot('2026-10-01T00:00:00Z',9),snapshot('2026-11-01T14:00:00Z',0.7),snapshot('2026-11-01T16:00:00Z',1),
  ]}}
  const rows=savedConditionRows(s)
  assert.deepEqual(rows.map(row=>row.label),['2026-11-01 23:00','2026-11-02 01:00'])
  assert.deepEqual(rows.map(row=>row.values.wave_height),[0.7,1])
})
