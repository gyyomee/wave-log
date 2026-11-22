import test from 'node:test'
import assert from 'node:assert/strict'
import { windReviewPatch } from '../src/lib/windReview.js'
import { windAudit, windInventory, windResolution, normalizeWindRecord, fromKnots } from '../src/lib/windUnits.js'
import { forecastRange, forecastState } from '../src/journal/forecast.js'
import { journalStatistics } from '../src/journal/statisticsModel.js'

const start='2026-11-01T00:00:00Z',end='2026-11-01T03:00:00Z',context=JSON.stringify([37,129,start,end])
test('manual unit review changes only metadata, preserving scalar, interval and original hourly numbers',()=>{
  const original={wind_speed:10,api_values:{wind_speed:{value:10}},context,condition_intervals:[{id:'legacy',started_at:start,ended_at:end,wind_speed:7,api_values:{}}],condition_hourly:[{fields:['wind_speed'],metadata:{context},rows:[{sampled_at:start,wind_speed:6}]}]}
  let record=structuredClone(original)
  for(const issue of windAudit(record)) record={...record,...windReviewPatch(record,issue,'kts')}
  assert.equal(record.wind_speed,10);assert.equal(record.condition_intervals[0].wind_speed,7);assert.equal(record.condition_hourly[0].rows[0].wind_speed,6)
  assert.deepEqual(record.api_values.wind_speed,original.api_values.wind_speed)
  assert.equal(windAudit(record).length,0)
  assert.equal(windResolution(record).value,fromKnots(10))
  const normalized=normalizeWindRecord(record)
  assert.deepEqual(normalizeWindRecord(normalized),normalized)
  const forecast=forecastState(record,forecastRange(start,end),context)
  assert.equal(forecast._forecast[0].wind_speed,fromKnots(6))
  assert.deepEqual(forecast.condition_hourly[0].rows,record.condition_hourly[0].rows)
  assert.equal(windInventory(record).filter(e=>e.category==='reviewed').length,3)
  assert.throws(()=>windReviewPatch(record,windAudit(original)[0],'m/s'),/変更|변경/)
})
test('unknown tags can be reviewed and stale review metadata cannot reinterpret a changed raw number',()=>{
  const record=normalizeWindRecord({wind_speed:10})
  const issue=windAudit(record)[0],patch=windReviewPatch(record,issue,'m/s')
  assert.equal(windResolution({...record,...patch}).value,10)
  assert.equal(windResolution({...record,...patch,wind_speed:11}).unit,'unknown')
  assert.throws(()=>windReviewPatch(record,{...issue,value:11},'kts'),/변경/)
  assert.throws(()=>windReviewPatch(record,issue,'mph'),/단위/)
})
test('audit separates explicit API units, code-derived units, manual flags and unresolved values',()=>{
  const legacy={provider:'open-meteo',source:'weather',model:'era5',source_type:'historical_model',fetched_at:end,context}
  const records=[{wind_speed:10,manual_fields:['wind_speed']},{wind_speed:2,api_values:{wind_speed:{value:2,unit:'m/s'}}},{wind_speed:3,api_values:{wind_speed:{value:3,...legacy}}},{wind_speed:4}]
  const sessions=records.map((conditions,i)=>({id:String(i),spot_id:'s',started_at:start,ended_at:end,conditions}))
  assert.deepEqual(journalStatistics(sessions).inventory,{manual:1,apiVerified:1,apiInferred:1,unknown:1,reviewed:0,tagged:0})
})
test('review service uses row version checks and writes only metadata (mocked)',async t=>{
  const current={session_id:'s',updated_at:'2026-11-01T00:00:00Z',wind_speed:10,api_values:{}}
  let updated,conflict=false
  const client={from(){return {
    select(){return {eq(){return {single:async()=>({data:current,error:null})}}}},
    update(patch){assert.deepEqual(Object.keys(patch),['api_values']);updated=patch;return {eq(key,value){assert.equal(key,'session_id');assert.equal(value,'s');return {eq(key,value){assert.equal(key,'updated_at');assert.equal(value,current.updated_at);return {select(){return {maybeSingle:async()=>({data:conflict ? null : {...current,...patch},error:null})}}}}}}}},
  }}}
  class DataAccessError extends Error {}
  t.mock.module('../src/services/dataAccess.js',{namedExports:{DataAccessError,authenticatedClient:async()=>({client}),execute:fn=>fn(),result:async query=>(await query).data}})
  const {confirmWindUnit}=await import('../src/services/windReview.js')
  const issue=windAudit(current)[0]
  const result=await confirmWindUnit('s',issue,'kts')
  assert.equal(result.wind_speed,10);assert.equal(updated.api_values._wind_speed_review.unit,'kts')
  conflict=true;await assert.rejects(()=>confirmWindUnit('s',issue,'m/s'),/다른 화면/)
})
