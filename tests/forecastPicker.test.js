import test from 'node:test'
import assert from 'node:assert/strict'
import { forecastRange, forecastRequest, forecastState, currentManualIntervals } from '../src/journal/forecast.js'
import { parseTime, formatTime, wheelKey } from '../src/journal/timePicker.js'
import { seoulParts } from '../src/journal/dates.js'
import { changeCondition } from '../src/journal/conditionModel.js'
const at=(time,date='2026-10-01')=>date+'T'+time+':00+09:00'
test('forecast includes previous/equal start and next/equal end clock boundaries',()=>{
  for(const [a,b,expected] of [
    ['08:00','14:00',['06:00','09:00','12:00','15:00']],
    ['09:00','12:00',['09:00','12:00']],
    ['10:00','13:00',['09:00','12:00','15:00']],
    ['00:00','00:01',['00:00','03:00']],
    ['08:59','09:01',['06:00','09:00','12:00']],
  ]) assert.deepEqual(forecastRange(at(a),at(b)).map(r=>seoulParts(r.forecast_at).time),expected)
  assert.deepEqual(forecastRange(at('12:00'),at('09:00')),[])
  assert.deepEqual(forecastRange('invalid',at('09:00')),[])
})
test('overnight boundaries include actual dates and upper hourly sample in request',()=>{
  const ranges=forecastRange(at('22:00'),at('02:00','2026-10-02'))
  assert.deepEqual(ranges.map(r=>seoulParts(r.forecast_at)),[
    {date:'2026-10-01',time:'21:00'},{date:'2026-10-02',time:'00:00'},{date:'2026-10-02',time:'03:00'},
  ])
  const request=forecastRequest(at('22:00'),at('02:00','2026-10-02'),{latitude:37,longitude:129})
  assert.equal(request.started_at,ranges[0].forecast_at)
  assert.ok(Date.parse(request.ended_at)>Date.parse(ranges.at(-1).forecast_at))
})
test('forecast is transient, exact, and removes obsolete sources without removing manual inputs',()=>{
  const ranges=forecastRange(at('08:00'),at('14:00'))
  const ctx=JSON.stringify([37,129,at('08:00'),at('14:00')])
  const group={fields:['wave_height'],metadata:{context:ctx},rows:[{sampled_at:at('08:00'),wave_height:8},{sampled_at:at('09:00'),wave_height:0},{sampled_at:at('12:00'),wave_height:2}]}
  let state=forecastState({condition_hourly:[group]},ranges,ctx)
  assert.deepEqual(state._forecast.map(r=>r.wave_height ?? null),[null,0,2,null])
  assert.deepEqual(state.condition_intervals,[])
  state=changeCondition(state,'wave_height',4)
  state=forecastState(state,ranges,ctx)
  assert.equal(state.wave_height,4)
  const changed=forecastState(state,forecastRange(at('12:00'),at('15:00')),ctx)
  assert.equal(changed.wave_height,4)
  assert.ok(changed.condition_hourly.every(group=>group.rows.every(row=>Date.parse(row.sampled_at)>=Date.parse(at('12:00')))))
  assert.deepEqual(changed.condition_intervals,[])
  const other=forecastState(state,ranges,JSON.stringify([38,130]))
  assert.equal(other._forecast[2].wave_height,null)
  assert.equal(other.wave_height,4)
})
test('explicit historical manual values are retained independently of automatic forecasts',()=>{
  const state={condition_intervals:[
    {id:'old',started_at:at('06:00'),ended_at:at('07:00'),manual_fields:['wave_height']},
    {id:'current',started_at:at('08:00'),ended_at:at('11:00'),manual_fields:['wave_height']},
  ]}
  assert.deepEqual(currentManualIntervals(state,at('08:00'),at('14:00')).map(r=>r.id),['old','current'])
  assert.equal(state.condition_intervals.length,2)
})
test('time selection supports all exact 24-hour minutes and bounded keyboard controls',()=>{
  for(let h=0;h<24;h++) for(let m=0;m<60;m++) assert.deepEqual(parseTime(formatTime(h,m)),[h,m])
  for(const value of ['24:00','12:60','1:00','12 PM','',null]) assert.equal(parseTime(value),null)
  assert.equal(wheelKey(23,'ArrowDown',23),23)
  assert.equal(wheelKey(0,'ArrowUp',59),0)
  assert.equal(wheelKey(15,'Home',23),0)
  assert.equal(wheelKey(15,'End',59),59)
  assert.equal(wheelKey(15,'PageDown',59),20)
})
