import test from 'node:test'
import assert from 'node:assert/strict'
import { isAutomaticInterval, retainedInputs, relevantHourly } from '../src/journal/conditionPersistence.js'
import { forecastRange, forecastState } from '../src/journal/forecast.js'
import { journalSaver } from '../src/services/journalSave.js'
import { relevantMarine } from '../src/services/relevantMarine.js'
import { toKnots } from '../src/lib/windUnits.js'
const start='2026-10-01T08:00:00+09:00', end='2026-10-01T14:00:00+09:00'
const ctx=JSON.stringify([37,129,start,end])
test('only proven automatic interval rows are removed; manual nulls and ambiguous records survive',()=>{
  const auto={id:'forecast:2026-10-01T00:00:00Z',wave_height:2,api_values:{wave_height:{value:2}},manual_fields:[]}
  const manual={...auto,manual_fields:['wave_height'],wave_height:null}
  const unknown={...auto,wave_height:3}
  assert.equal(isAutomaticInterval(auto),true)
  assert.equal(isAutomaticInterval(manual),false)
  assert.deepEqual(retainedInputs([auto,manual,unknown]),[manual,unknown])
  assert.equal(retainedInputs([{id:'unknown',wave_height:null}]).length,1)
})
test('changing time removes old auto values and sources but preserves explicit session values',()=>{
  const groups=[{fields:['wave_height'],metadata:{context:ctx,fetched_at:'2026-10-02T00:00:00Z'},rows:[{sampled_at:'2026-10-01T00:00:00Z',wave_height:2}]}]
  const state={context:ctx,wave_height:2,api_values:{wave_height:{value:2}},wind_speed:4,manual_fields:['wind_speed'],condition_hourly:groups}
  const nextCtx=JSON.stringify([37,129,'2026-10-02T08:00:00+09:00','2026-10-02T14:00:00+09:00'])
  const next=forecastState(state,forecastRange('2026-10-02T08:00:00+09:00','2026-10-02T14:00:00+09:00'),nextCtx)
  assert.equal(next.wave_height,null)
  assert.equal(toKnots(next.wind_speed),4)
  assert.deepEqual(next.condition_hourly,[])
  assert.deepEqual(next.condition_intervals,[])
  assert.ok(next._forecast.every(row=>row.wave_height===null))
})
test('source samples are bounded, deduplicated and retain per-sample provenance',()=>{
  const group={fields:['wave_height'],metadata:{context:ctx,fetched_at:'2026-10-02T00:00:00Z'},rows:[{sampled_at:'2026-09-30T00:00:00Z',wave_height:1},{sampled_at:'2026-10-01T00:00:00Z',wave_height:2}],raw_response:{irrelevant:'full-day'}}
  const result=relevantHourly([group,group],forecastRange(start,end),ctx)
  assert.equal(result.length,1)
  assert.equal(result[0].rows[0].wave_height,2)
  assert.equal(result[0].metadata.fetched_at,group.metadata.fetched_at)
  assert.equal(result[0].raw_response,undefined)
  assert.equal(group.rows.length,2)
})
test('a concurrent save and partial-save retry create exactly one session',async()=>{
  let creates=0,updates=0,conditions=0,fail=true
  const save=journalSaver(null,async()=>{creates++;return{id:'one'}},async id=>{updates++;return{id}},async()=>{conditions++;if(fail)throw Error('offline')})
  const first=save({},{}),second=save({},{})
  assert.equal(first,second)
  await assert.rejects(first,/offline/)
  fail=false
  assert.equal((await save({},{})).id,'one')
  assert.equal(creates,1)
  assert.equal(updates,1)
  assert.equal(conditions,2)
})
test('marine display excludes obsolete time/spot samples without mutating stored rows',()=>{
  const session={id:'a',spot_id:'s',started_at:start,ended_at:end,spot:{latitude:37,longitude:129}}
  const rows=['2026-09-30T00:00:00Z','2026-10-01T00:00:00Z'].map(sampled_at=>({session_id:'a',spot_id:'s',requested_latitude:37,requested_longitude:129,sampled_at}))
  assert.equal(relevantMarine(rows,session).length,1)
  assert.equal(rows.length,2)
})
test('unclassified historical sources remain stored but never masquerade as a forecast',()=>{
  const source={rows:[{sampled_at:'2020-01-01T00:00:00Z',wave_height:3}],metadata:{provider:'unknown'}}
  const state=forecastState({condition_hourly:[source]},forecastRange(start,end),ctx)
  assert.deepEqual(state.condition_hourly,[source])
  assert.ok(state._forecast.every(row=>row.wave_height===null))
})
