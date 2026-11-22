import test from 'node:test'
import assert from 'node:assert/strict'
import { forecastRange, forecastState } from '../src/journal/forecast.js'
import { editTimestamp, timestampValues } from '../src/journal/timestampEdits.js'
import { savedConditionRows } from '../src/journal/savedConditions.js'
import { fromKnots, toKnots, windResolution } from '../src/lib/windUnits.js'
import { sessionWind } from '../src/journal/statisticsModel.js'

test('condition save preserves legacy values, hourly originals and separate interval/tide payloads (mocked)', async t => {
  let payload
  const client = { from(name) {
    assert.equal(name,'surf_session_conditions')
    return {
      upsert(data,options) { assert.equal(options.onConflict,'session_id'); payload=JSON.parse(JSON.stringify(data)); return { select() { return { single: async()=>({data:payload,error:null}) } } } },
      select() { return {eq() { return {maybeSingle:async()=>({data:JSON.parse(JSON.stringify(payload)),error:null})} } } },
    }
  } }
  t.mock.module('../src/services/dataAccess.js',{namedExports:{
    authenticatedClient:async()=>({client,user:{id:'test'}}),
    execute:async fn=>fn(),
    result:async promise=>(await promise).data,
  }})
  const { saveConditions, getConditions } = await import('../src/services/sessionConditions.js')
  const ctx=JSON.stringify([37,129,'2026-10-01T08:00:00+09:00','2026-10-01T14:00:00+09:00'])
  const state = { context:ctx, wave_height:1.7, manual_fields:['wave_height'],api_values:{wave_height:{value:1}}, wetsuit:'4/3mm',condition_intervals:[{id:'manual',started_at:'2026-10-01T00:00:00Z',ended_at:'2026-10-01T01:00:00Z',api_values:{}}] }
  state.condition_intervals[0].wave_height='2.1'
  state.condition_intervals[0].manual_fields=['wave_height']
  state.condition_hourly=[{fields:['wave_height'],metadata:{context:ctx},rows:[{sampled_at:'2026-10-01T00:00:00Z',wave_height:1}]}]
  state.tide_cycle_label='조금'
  state.tide_convention='7'
  state.tide_events=[{id:'tide',type:'low',date:'2026-10-02',time:'00:10',height_cm:''}]
  await saveConditions('session',state,{wave_rating:'confirmed'})
  assert.equal(payload.wave_height,1.7)
  assert.deepEqual(payload.api_values,state.api_values)
  assert.deepEqual(payload.condition_hourly,state.condition_hourly)
  assert.equal(payload.condition_intervals[0].wave_height,2.1)
  assert.equal(payload.condition_intervals.length,1)
  assert.equal(payload._forecast,undefined)
  assert.equal(payload.tide_events[0].height_cm,null)
  assert.equal(payload.tide_events[0].occurred_at,'2026-10-01T15:10:00.000Z')
  assert.equal(payload.tide_convention,'7')
  assert.equal(payload.condition_intervals[0].wetsuit,undefined)
  const start='2026-10-01T08:00:00+09:00',end='2026-10-01T14:00:00+09:00'
  const ranges=forecastRange(start,end)
  let edited=forecastState(state,ranges,ctx)
  edited=editTimestamp(edited,edited._forecast[1],'wave_height',2.6,ctx)
  edited=editTimestamp(edited,edited._forecast[2],'wave_height',null,ctx)
  edited=editTimestamp(edited,edited._forecast[1],'wind_direction',44.7,ctx)
  await saveConditions('session',edited,{wave_rating:'confirmed'})
  const loaded=await getConditions('session')
  const reopened=forecastState(loaded,ranges,ctx)
  assert.equal(timestampValues(reopened,reopened._forecast[1]).wave_height,2.6)
  assert.equal(timestampValues(reopened,reopened._forecast[2]).wave_height,null)
  assert.equal(timestampValues(reopened,reopened._forecast[1]).wind_direction,44.7)
  assert.equal(loaded.condition_intervals.length,3)
  assert.equal(loaded.condition_intervals[0].wave_height,2.1)
  assert.equal(loaded.wave_height,1.7)
  assert.equal(loaded.condition_intervals[1].manual_origins.wave_height.api.value,1)
  const rows=savedConditionRows({started_at:start,ended_at:end,conditions:loaded})
  assert.equal(rows[1].values.wave_height,2.6)
  assert.equal(rows[2].values.wave_height,null)
  assert.equal(rows[1].values.wind_direction,44.7)
  assert.equal(payload._forecast,undefined)
  for (const [name,wind,expected] of [
    ['manual',{wind_speed:10,manual_fields:['wind_speed'],manual_origins:{wind_speed:{api:{value:4,unit:'m/s'}}}},fromKnots(10)],
    ['api',{wind_speed:10,api_values:{wind_speed:{value:10,unit:'m/s'}}},10],
    ['unknown',{wind_speed:10},null],
  ]) {
    const original=JSON.parse(JSON.stringify(wind))
    await saveConditions(name,{...wind,context:ctx},{})
    const once=await getConditions(name)
    await saveConditions(name,once,{})
    const twice=await getConditions(name)
    assert.deepEqual(wind,original,'save must not mutate historical input')
    assert.equal(windResolution(twice).value,expected)
    assert.equal(twice.wind_speed,expected ?? 10,'unknown original must survive')
    assert.deepEqual(twice.api_values,once.api_values,'no repeated conversion')
    assert.deepEqual(twice.manual_origins,wind.manual_origins || {})
    assert.equal(sessionWind({started_at:start,ended_at:end,conditions:twice}).value,expected)
    if(name==='manual') assert.equal(toKnots(twice.wind_speed),10)
  }
})
