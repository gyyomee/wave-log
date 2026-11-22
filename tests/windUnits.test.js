import test from 'node:test'
import assert from 'node:assert/strict'
import { apiWind, fromKnots, toKnots, windResolution, normalizeWindRecord, windAudit } from '../src/lib/windUnits.js'
import { forecastRange, forecastState } from '../src/journal/forecast.js'
import { editTimestamp, timestampValues, resetTimestamp } from '../src/journal/timestampEdits.js'
import { mergePrefill } from '../src/journal/conditionModel.js'
import { savedConditionRows } from '../src/journal/savedConditions.js'
import { parseConditions, fetchConditionSnapshot } from '../src/services/conditionApi.js'
import { journalStatistics, sessionWind, filterStatistics } from '../src/journal/statisticsModel.js'
import { sessionValues } from '../src/journal/conditionPersistence.js'

const start='2026-11-01T00:00:00Z',end='2026-11-01T03:00:00Z',ctx=JSON.stringify([37,129,start,end])
const legacy={provider:'open-meteo',source:'weather',model:'era5',source_type:'historical_model',fetched_at:'2026-11-02T00:00:00Z',context:ctx}
const session=(id,conditions)=>({id,spot_id:'spot',spot:{name:'Test spot'},started_at:start,ended_at:end,board_name:' Test Board ',overall_rating:4,wave_rating:null,crowd_level:3,conditions})
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)

test('historical manual numbers stay identical in knots, independently of API original',()=>{
  const raw={wind_speed:10,manual_fields:['wind_speed'],api_values:{wind_speed:{...legacy,value:4}},manual_origins:{wind_speed:{api:{...legacy,value:4}}}}
  const before=JSON.stringify(raw),normal=normalizeWindRecord(raw)
  close(toKnots(windResolution(normal).value),10)
  assert.equal(normal.api_values._wind_speed_storage.original_value,10)
  assert.equal(normal.api_values._wind_speed_storage.original_unit,'kts')
  assert.deepEqual(normal.api_values.wind_speed,raw.api_values.wind_speed)
  assert.deepEqual(normal.manual_origins,raw.manual_origins)
  assert.equal(JSON.stringify(raw),before)
  assert.deepEqual(normalizeWindRecord(normal),normal)
  assert.equal(windResolution({...raw,wind_speed:null}).value,null)
  assert.equal(windResolution({manual_fields:['wind_speed'],api_values:raw.api_values}).value,null)
})
test('historical API units use explicit response or audited legacy code, never numeric similarity',()=>{
  close(apiWind(10,{unit:'kn'}).value,fromKnots(10))
  assert.equal(apiWind(10,{unit:'m/s'}).value,10)
  assert.equal(apiWind(10,legacy).reason,'legacy-ms-request-code')
  for(const meta of [{},{provider:'open-meteo'},{...legacy,unit:'unknown'}]) assert.equal(apiWind(10,meta).unit,'unknown')
  assert.equal(windResolution({wind_speed:10,api_values:{wind_speed:{value:10}}}).unit,'unknown')
  assert.equal(windResolution({wind_speed:11,api_values:{wind_speed:{...legacy,value:10}}}).unit,'unknown')
})
test('ambiguous historical numbers remain untouched and are not overwritten by prefill',()=>{
  const raw={wind_speed:10,api_values:{wind_speed:{value:10}},context:ctx}
  const normal=normalizeWindRecord(raw)
  assert.equal(normal.wind_speed,10)
  assert.equal(windResolution(normal).value,null)
  assert.equal(windAudit(normal)[0].value,10)
  const refreshed=mergePrefill(normal,{wind_speed:{value:5,unit:'m/s'}},ctx)
  assert.equal(refreshed.wind_speed,10)
  assert.deepEqual(refreshed.api_values.wind_speed,raw.api_values.wind_speed)
  assert.equal(windResolution(refreshed).unit,'unknown')
})
test('hourly originals, exact timestamp edits, reset and reload use one canonical unit',()=>{
  const group={fields:['wind_speed'],metadata:{context:ctx},raw_response:{hourly_units:{wind_speed_10m:'m/s'}},rows:[{sampled_at:start,wind_speed:5}]}
  const original=JSON.stringify(group),ranges=forecastRange(start,end)
  let state=forecastState({context:ctx,condition_hourly:[group]},ranges,ctx)
  assert.equal(state._forecast[0].wind_speed,5)
  state=editTimestamp(state,state._forecast[0],'wind_speed',fromKnots(12),ctx)
  close(toKnots(timestampValues(state,state._forecast[0]).wind_speed),12)
  const restored=resetTimestamp(state,state._forecast[0],'wind_speed',ctx)
  assert.equal(timestampValues(restored,restored._forecast[0]).wind_speed,5)
  const loaded=forecastState(JSON.parse(JSON.stringify(state)),ranges,ctx)
  close(toKnots(timestampValues(loaded,loaded._forecast[0]).wind_speed),12)
  close(toKnots(savedConditionRows(session('one',loaded))[0].values.wind_speed),12)
  assert.equal(JSON.stringify(group),original)
  assert.equal(state.condition_hourly[0].metadata.response_unit,'m/s')
})
test('knots API parser preserves originals and refuses non-null wind with missing units',()=>{
  const body={hourly:{time:[Date.parse(start)/1000],wind_speed_10m:[10]},hourly_units:{wind_speed_10m:'kn'}}
  const rows=parseConditions(body,{wind_speed_10m:'wind_speed'})
  close(rows[0].wind_speed,fromKnots(10))
  assert.equal(rows[0].wind_speed_source_value,10)
  assert.equal(rows[0].wind_speed_source_unit,'kn')
  assert.throws(()=>parseConditions({...body,hourly_units:{}},{wind_speed_10m:'wind_speed'}),/단위/)
})
test('forecast and archive requests explicitly ask for knots and verify the response unit',async()=>{
  for(const [date,unit] of [['2026-11-20','kn'],['2025-01-01','kn'],['2026-11-19','m/s'],['2026-11-18',undefined]]) {
    const requests=[],time=Date.parse(date+'T00:00:00Z')/1000
    const result=await fetchConditionSnapshot({started_at:date+'T00:00:00Z',ended_at:date+'T01:00:00Z'},{latitude:37.1,longitude:129.1},{now:Date.parse('2026-11-22T00:00:00Z'),fetcher:async url=>{
      const params=new URL(url).searchParams
      if(params.has('wind_speed_unit')) {
        requests.push(url);assert.equal(params.get('wind_speed_unit'),'kn')
        return {ok:true,json:async()=>({hourly:{time:[time],wind_speed_10m:[10],wind_direction_10m:[90],temperature_2m:[20]},hourly_units:{wind_speed_10m:unit,wind_direction_10m:'°',temperature_2m:'°C'}})}
      }
      return {ok:true,json:async()=>({hourly:{time:[]}})}
    }})
    assert.equal(requests.length,1)
    if(unit==='kn') {
      close(result.values.wind_speed.value,fromKnots(10))
      assert.equal(result.values.wind_speed.unit,'m/s')
      assert.equal(result.values.wind_speed.source_value,10)
      assert.equal(result.hourly.find(g=>g.fields.includes('wind_speed')).metadata.response_unit,'kn')
      assert.equal(new URL(requests[0]).hostname,date==='2025-01-01' ? 'archive-api.open-meteo.com' : 'api.open-meteo.com')
    } else {assert.equal(result.values.wind_speed,undefined);assert.ok(result.errors.some(e=>e.includes('단위')))}
  }
})
test('statistics normalize manual/API wind, exclude ambiguity and missing values, preserve ratings',()=>{
  const sessions=[session('manual',{wind_speed:10,manual_fields:['wind_speed']}),session('api',{wind_speed:10,api_values:{wind_speed:{value:10,unit:'m/s'}}}),session('review',{wind_speed:10}),session('missing',{})]
  const original=JSON.stringify(sessions),stats=journalStatistics(sessions)
  assert.equal(stats.count,4);assert.equal(stats.days,1);assert.equal(stats.hours,12)
  assert.equal(stats.overall,4);assert.equal(stats.wave,null)
  close(stats.windMs,(fromKnots(10)+10)/2)
  assert.equal(stats.windCount,2);assert.equal(stats.windExcluded,1)
  assert.equal(stats.reviews[0].sessionId,'review');assert.equal(stats.reviews[0].value,10)
  assert.equal(stats.boards.length,1)
  assert.equal(JSON.stringify(sessions),original)
  assert.equal(journalStatistics([]).windMs,null)
})
test('statistics use Seoul dates across midnight and one midpoint wind sample per session',()=>{
  const conditions={context:ctx,condition_hourly:[{fields:['wind_speed'],metadata:{context:ctx,wind_speed_unit:'m/s'},rows:[{sampled_at:start,wind_speed:0},{sampled_at:end,wind_speed:10}]}]}
  assert.equal(sessionWind(session('one',conditions)).value,0)
  const overnight={...session('night',{}),started_at:'2026-10-31T15:00:00Z',ended_at:'2026-11-01T17:00:00Z'}
  assert.equal(filterStatistics([overnight],{from:'2026-11-01',to:'2026-11-01'}).length,1)
  assert.equal(filterStatistics([overnight],{spotId:'other'}).length,0)
})

test('selection changes and unrelated edits retain wind tags and original ambiguous values',()=>{
  const nextContext=JSON.stringify([37,129,start,'2026-11-01T06:00:00Z'])
  let state=forecastState({context:ctx,wind_speed:10,manual_fields:['wind_speed']},forecastRange(start,end),ctx)
  state=forecastState(state,forecastRange(start,end),nextContext)
  close(toKnots(windResolution(state).value),10)
  state=forecastState(state,forecastRange(start,end),ctx)
  close(toKnots(windResolution(state).value),10)
  const unknown={id:'legacy',forecast_at:start,started_at:start,ended_at:new Date(Date.parse(start)+1).toISOString(),wind_speed:7,api_values:{wind_speed:{value:7}}}
  state=forecastState({context:ctx,condition_intervals:[unknown]},forecastRange(start,end),ctx)
  state=editTimestamp(state,state._forecast[0],'wave_height',1,ctx)
  assert.equal(windResolution(state.condition_intervals[0]).unit,'unknown')
  assert.equal(state.condition_intervals[0].wind_speed,7)
  const changed=forecastState({context:ctx,wind_speed:7,api_values:{wind_speed:{value:7}}},forecastRange(start,end),nextContext)
  assert.equal(windResolution(changed).unit,'unknown')
  assert.equal(changed.api_values.wind_speed.value,7)
})

test('reused hourly sources normalize representative wind before automatic prefill',()=>{
  const hourly=[{fields:['wind_speed'],metadata:{context:ctx,wind_speed_unit:'kn'},rows:[{sampled_at:start,wind_speed:10}]}]
  const values=sessionValues(hourly,start,end)
  close(values.wind_speed.value,fromKnots(10))
  assert.equal(values.wind_speed.unit,'m/s')
  const filled=mergePrefill({},values,ctx)
  close(toKnots(windResolution(filled).value),10)
  assert.equal(hourly[0].rows[0].wind_speed,10)
})
