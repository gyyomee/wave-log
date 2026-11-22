import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { initialRatings, initialIntent } from '../src/journal/conditionModel.js'
import { ratingValue } from '../src/journal/suggestions.js'
import { journalSaver } from '../src/services/journalSave.js'

test('top navigation keeps calendar/My Page and preserves creation and nested statistics access',()=>{
  const source=readFileSync(new URL('../src/journal/Journal.jsx',import.meta.url),'utf8')
  const nav=source.match(/<nav[\s\S]*?<\/nav>/)[0]
  assert.match(nav,/\['journal','캘린더'\],\['account','마이페이지'\]/)
  assert.doesNotMatch(nav,/\['statistics','통계'\]/)
  assert.match(source,/onStatistics={\(\)=>navigate\('statistics'\)}/)
  assert.match(source,/onSettings={\(\)=>navigate\('preferences'\)}/)
  assert.doesNotMatch(nav,/기록 추가|\['add'/)
  assert.match(source,/onClick={\(\) => navigate\('add'\)}>기록 추가/)
})
test('displayed default and existing ratings save with no confirmation requirement (mocked)',async()=>{
  const keys=['overall_rating','wave_rating','crowd_level']
  for(const session of [null,{id:'existing',overall_rating:5,wave_rating:null,crowd_level:1}]) {
    const ratings=initialRatings(session,keys), intent=initialIntent(session,keys)
    const record=Object.fromEntries(keys.map(key=>[key,ratingValue(ratings[key])]))
    const expected=session ? {overall_rating:5,wave_rating:null,crowd_level:1} : {overall_rating:3,wave_rating:3,crowd_level:3}
    let writes=0
    const persist=async data=>{writes++;assert.deepEqual(data,expected);return{id:session?.id || 'new'}}
    const save=journalSaver(session?.id,persist,async(id,data)=>persist(data),async(id,conditions,savedIntent)=>assert.deepEqual(savedIntent,intent))
    await save(record,{},intent)
    assert.equal(writes,1)
  }
  const form=readFileSync(new URL('../src/journal/SessionForm.jsx',import.meta.url),'utf8')
  assert.doesNotMatch(form,/onConfirm|confirmed|3점 확인/)
  assert.match(form,/ratingValue\(form\[k\]\)/)
})
test('reset controls have accessible names, tooltips and disabled states beside their inputs',async()=>{
  const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
  try {
    const {default:Editor}=await server.ssrLoadModule('/src/journal/ConditionsEditor.jsx')
    const {forecastRange,forecastState}=await server.ssrLoadModule('/src/journal/forecast.js')
    const {editTimestamp}=await server.ssrLoadModule('/src/journal/timestampEdits.js')
    const start='2026-11-01T09:00:00+09:00',end='2026-11-01T10:00:00+09:00',ctx=JSON.stringify([37,129,start,end])
    const ranges=forecastRange(start,end)
    let state=forecastState({condition_hourly:[{fields:['wave_height'],metadata:{context:ctx},rows:[{sampled_at:ranges[0].forecast_at,wave_height:0}]}]},ranges,ctx)
    state=editTimestamp(state,state._forecast[0],'wave_height',2,ctx)
    const html=renderToStaticMarkup(React.createElement(Editor,{data:{state,setState(){},ranges,ctx,start,retry(){}}}))
    const table=html.split('<table')[1].split('</table>')[0]
    assert.equal((table.match(/class="condition-input-row"/g)||[]).length,7)
    assert.equal((table.match(/class="condition-reset"/g)||[]).length,7)
    assert.equal((table.match(/disabled=""/g)||[]).length,6)
    assert.match(table,/aria-label="파고 2026-11-01 09:00 API 값으로 초기화" title="API 값으로 초기화"/)
    assert.match(table,/title="초기화할 API 값 없음"/)
    assert.doesNotMatch(table,/되돌리기/)
    assert.match(table,/<input[^>]*\/><button class="condition-reset"/)
    assert.match(table,/<img[^>]*alt="" aria-hidden="true"/)
  } finally {await server.close()}
})
