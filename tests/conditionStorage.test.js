import test from 'node:test'
import assert from 'node:assert/strict'

test('condition save preserves legacy values, hourly originals and separate interval/tide payloads (mocked)', async t => {
  let payload
  const client = { from(name) {
    assert.equal(name,'surf_session_conditions')
    return { upsert(data) { payload=data; return { select() { return { single: async()=>({data,error:null}) } } } } }
  } }
  t.mock.module('../src/services/dataAccess.js',{namedExports:{
    authenticatedClient:async()=>({client,user:{id:'test'}}),
    execute:async fn=>fn(),
    result:async promise=>(await promise).data,
  }})
  const { saveConditions } = await import('../src/services/sessionConditions.js')
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
})
