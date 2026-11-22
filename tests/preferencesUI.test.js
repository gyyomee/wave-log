import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'
import { forecastRange, forecastState } from '../src/journal/forecast.js'
import { editTimestamp, resetTimestamp, timestampValues } from '../src/journal/timestampEdits.js'
import { fromKnots, windFromInput } from '../src/lib/windUnits.js'

test('My Page exposes the existing statistics/settings/logout and units stay consistent in all views',async()=>{
  const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
  try {
    const {PreferencesContext}=await server.ssrLoadModule('/src/preferences/PreferencesContext.jsx')
    const {default:MyPage,PreferencesPage}=await server.ssrLoadModule('/src/preferences/MyPage.jsx')
    const {default:Editor}=await server.ssrLoadModule('/src/journal/ConditionsEditor.jsx')
    const {default:Detail}=await server.ssrLoadModule('/src/journal/ConditionsDetail.jsx')
    const {default:Statistics}=await server.ssrLoadModule('/src/journal/Statistics.jsx')
    const render=(unit,component,props)=>renderToStaticMarkup(React.createElement(PreferencesContext.Provider,{value:{unit,ready:true,change(){}}},React.createElement(component,props)))
    const mypage=render('kts',MyPage,{nickname:'Test surfer'})
    for(const label of ['마이페이지','Test surfer','내 서핑 통계','환경설정','로그아웃']) assert.ok(mypage.includes(label))
    const start='2026-11-01T00:00:00Z',end='2026-11-01T03:00:00Z',context=JSON.stringify([37,129,start,end]),ranges=forecastRange(start,end)
    let state=forecastState({context,condition_hourly:[{fields:['wind_speed'],metadata:{context,wind_speed_unit:'m/s'},rows:[{sampled_at:start,wind_speed:4}]}]},ranges,context)
    state=editTimestamp(state,state._forecast[0],'wind_speed',windFromInput(10,'kts'),context)
    const initial=JSON.stringify(state)
    const session={id:'s',spot_id:'p',started_at:start,ended_at:end,conditions:state}
    for(const unit of ['kts','m/s','kts','m/s']) {
      const settings=render(unit,PreferencesPage)
      assert.match(settings,new RegExp('checked="" value="'+unit+'"'))
      const editor=render(unit,Editor,{data:{state,setState(){},ranges,start,end,ctx:context}})
      assert.ok(editor.includes('풍속 ('+unit+')'))
      assert.ok(editor.includes('value="'+(unit==='kts' ? '10' : '5.144444')+'"'))
      assert.ok(render(unit,Detail,{session}).includes(unit==='kts' ? '10 kts' : '5.1 m/s'))
      const stats=render(unit,Statistics,{sessions:[session],spots:[],onOpen(){}})
      assert.ok(stats.includes(unit==='kts' ? '10 kts' : '5.1 m/s'))
      assert.match(stats,/1개 기록/)
    }
    assert.equal(JSON.stringify(state),initial,'display only must not modify unsaved overrides')
    const reset=resetTimestamp(state,state._forecast[0],'wind_speed',context)
    assert.equal(timestampValues(reset,reset._forecast[0]).wind_speed,4)
    const edited=editTimestamp(state,state._forecast[0],'wind_speed',windFromInput(6,'m/s'),context)
    const reopened=forecastState(JSON.parse(JSON.stringify(edited)),ranges,context)
    assert.equal(timestampValues(reopened,reopened._forecast[0]).wind_speed,6)
    assert.equal(timestampValues(state,state._forecast[0]).wind_speed,fromKnots(10))
    const css=readFileSync(new URL('../src/journal/journal.css',import.meta.url),'utf8')
    assert.match(css,/\.unit-options[^}]+flex-wrap: wrap/)
    assert.match(css,/\.condition-edit-scroll[^}]+overflow: auto/)
  } finally {await server.close()}
})
