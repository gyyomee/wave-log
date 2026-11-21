import test from 'node:test'
import assert from 'node:assert/strict'
import { forecastRange, forecastState } from '../src/journal/forecast.js'
import { timestampValues, editTimestamp, canResetCondition, resetTimestamp } from '../src/journal/timestampEdits.js'
import { savedConditionRows } from '../src/journal/savedConditions.js'
import { directions, directionLabel, travelRotation } from '../src/journal/directions.js'

const start='2026-11-01T08:00:00+09:00', end='2026-11-01T14:00:00+09:00'
const ctx=JSON.stringify([37,129,start,end])
const ranges=forecastRange(start,end)
function fixture() {
  return forecastState({context:ctx,condition_hourly:[{fields:['wave_height','wind_direction'],metadata:{context:ctx,provider:'open-meteo'},rows:[{sampled_at:ranges[1].forecast_at,wave_height:0,wind_direction:44.7},{sampled_at:ranges[2].forecast_at,wave_height:2,wind_direction:90}]}]},ranges,ctx)
}
test('exact hourly prefilling preserves zero, precise bearings, and missing values',()=>{
  const state=fixture()
  state.wave_height=9
  state.api_values={wave_height:{value:9,sampled_at:ranges[1].forecast_at}}
  assert.equal(timestampValues(state,state._forecast[0]).wave_height,null)
  assert.equal(timestampValues(state,state._forecast[1]).wave_height,0)
  assert.equal(timestampValues(state,state._forecast[1]).wind_direction,44.7)
  assert.equal(timestampValues(state,state._forecast[2]).wave_height,2)
})
test('timestamp edits are independent, deduplicated, and keep original source provenance',()=>{
  let state=fixture()
  const original=JSON.stringify(state.condition_hourly)
  state=editTimestamp(state,state._forecast[1],'wave_height',1.4,ctx)
  state=editTimestamp(state,state._forecast[1],'wave_height',1.7,ctx)
  state=editTimestamp(state,state._forecast[2],'wave_height',null,ctx)
  assert.equal(state.condition_intervals.length,2)
  assert.equal(timestampValues(state,state._forecast[1]).wave_height,1.7)
  assert.equal(timestampValues(state,state._forecast[2]).wave_height,null)
  assert.equal(state.condition_intervals[0].manual_origins.wave_height.api.value,0)
  state.condition_intervals[0].forecast_at=state.condition_intervals[0].forecast_at.replace('.000Z','Z')
  state=editTimestamp(state,state._forecast[1],'wave_period',8,ctx)
  assert.equal(state.condition_intervals.length,2)
  assert.equal(timestampValues(state,state._forecast[1]).wave_period,8)
  assert.equal(JSON.stringify(state.condition_hourly),original)
  const refreshed=forecastState({...state,condition_hourly:[]},ranges,ctx)
  assert.equal(timestampValues(refreshed,refreshed._forecast[1]).wave_height,1.7)
  assert.equal(timestampValues(refreshed,refreshed._forecast[2]).wave_height,null)
})
test('time changes hide obsolete timestamp edits without deleting them',()=>{
  let state=fixture()
  state=editTimestamp(state,state._forecast[1],'wave_height',3,ctx)
  const moved=forecastState(state,forecastRange('2026-11-02T22:00:00+09:00','2026-11-03T02:00:00+09:00'),ctx)
  assert.ok(moved._forecast.every(row=>timestampValues(moved,row).wave_height===null))
  assert.equal(moved.condition_intervals[0].wave_height,3)
  assert.equal(timestampValues(state,state._forecast[1]).wave_height,3)
})
test('new spot and newer null samples cannot inherit older automatic values',()=>{
  let state=fixture()
  state=editTimestamp(state,state._forecast[1],'wave_height',3,ctx)
  const moved=forecastState(state,ranges,JSON.stringify([38,130,start,end]))
  assert.equal(timestampValues(moved,moved._forecast[1]).wave_height,3)
  assert.equal(timestampValues(moved,moved._forecast[1]).wind_direction,null)
  const incoming={...state._forecast[1],wind_direction:null,api_values:{wind_direction:{context:ctx,value:null,sampled_at:ranges[1].forecast_at}}}
  assert.equal(timestampValues(state,incoming).wind_direction,null)
})
test('legacy manual baselines and overlapping manual intervals remain intact when a point is edited',()=>{
  let state={...fixture(),wave_height:4,manual_fields:['wave_height'],condition_intervals:[{id:'legacy',started_at:ranges[1].forecast_at,ended_at:ranges[2].forecast_at,wave_height:5,manual_fields:['wave_height'],api_values:{}}]}
  assert.equal(timestampValues(state,state._forecast[0]).wave_height,4)
  assert.equal(timestampValues(state,state._forecast[1]).wave_height,5)
  state=editTimestamp(state,state._forecast[1],'wave_height',null,ctx)
  assert.equal(timestampValues(state,state._forecast[1]).wave_height,null)
  assert.equal(state.wave_height,4)
  assert.equal(state.condition_intervals[0].wave_height,5)
})
test('saved timestamp presentation agrees with the editable table without scalar auto fallback',()=>{
  let state=fixture()
  state=editTimestamp(state,state._forecast[1],'wave_height',1.7,ctx)
  state.wave_height=9
  const rows=savedConditionRows({started_at:start,ended_at:end,conditions:state})
  assert.deepEqual(rows.map(row=>row.values.wave_height),[null,1.7,2,null])
  assert.equal(rows[1].values.wind_direction,44.7)
  assert.equal(rows[1].estimates.includes('wave_height'),false)
  assert.equal(rows[1].estimates.includes('wind_direction'),true)
})
test('16 FROM labels use TO arrows while preserving precise degrees',()=>{
  assert.equal(directions.length,16)
  assert.equal(new Set(directions.map(row=>row.value)).size,16)
  for(const [degrees,label,rotation] of [[0,'북(N)',180],[45,'북동(NE)',225],[90,'동(E)',270],[180,'남(S)',0],[270,'서(W)',90]]) {
    assert.equal(directionLabel(degrees),label)
    assert.equal(travelRotation(degrees),rotation)
  }
  assert.equal(directionLabel(44.7),'북동(NE)')
  assert.equal(travelRotation(44.7),224.7)
  assert.equal(directionLabel(null),'미입력')
})
test('individual reset restores API zero without changing other fields, timestamps or source data',()=>{
  let state=fixture()
  state=editTimestamp(state,state._forecast[1],'wave_height',3,ctx)
  state=editTimestamp(state,state._forecast[1],'wind_direction',90,ctx)
  state=editTimestamp(state,state._forecast[2],'wave_height',4,ctx)
  const originals=JSON.stringify(state.condition_hourly)
  assert.equal(canResetCondition(timestampValues(state,state._forecast[1]),'wave_height'),true)
  const next=resetTimestamp(state,state._forecast[1],'wave_height',ctx)
  assert.equal(timestampValues(next,next._forecast[1]).wave_height,0)
  assert.equal(timestampValues(next,next._forecast[1]).wind_direction,90)
  assert.equal(timestampValues(next,next._forecast[2]).wave_height,4)
  assert.equal(state.condition_intervals[0].wave_height,3)
  assert.deepEqual(next.condition_intervals[0].manual_origins,state.condition_intervals[0].manual_origins)
  assert.equal(JSON.stringify(next.condition_hourly),originals)
  const direction=resetTimestamp(next,next._forecast[1],'wind_direction',ctx)
  assert.equal(timestampValues(direction,direction._forecast[1]).wind_direction,44.7)
})
test('missing API values cannot clear manual input, but stored matching source values can reset it',()=>{
  let state=fixture()
  state=editTimestamp(state,state._forecast[0],'wave_height',3,ctx)
  assert.equal(canResetCondition(timestampValues(state,state._forecast[0]),'wave_height'),false)
  assert.equal(resetTimestamp(state,state._forecast[0],'wave_height',ctx),state)
  state=editTimestamp(state,state._forecast[1],'wave_height',4,ctx)
  const offline=forecastState({...state,condition_hourly:[]},ranges,ctx)
  assert.equal(timestampValues(resetTimestamp(offline,offline._forecast[1],'wave_height',ctx),offline._forecast[1]).wave_height,0)
  const moved=forecastState(state,ranges,JSON.stringify([38,130,start,end]))
  assert.equal(resetTimestamp(moved,moved._forecast[1],'wave_height',moved.context),moved)
})
