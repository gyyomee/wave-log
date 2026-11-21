import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

test('saved detail has one clean conditions table and calendar distinguishes same-day sessions',async()=>{
  const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
  try {
    const {default: Detail}=await server.ssrLoadModule('/src/journal/ConditionsDetail.jsx')
    const {default: Calendar}=await server.ssrLoadModule('/src/journal/CalendarView.jsx')
    const session={id:'first',started_at:'2026-11-01T00:00:00Z',ended_at:'2026-11-01T02:00:00Z',spot:{name:'만리포해수욕장'},wave_rating:5,conditions:{wave_height:0.8,wave_period:9,swell_height:2,swell_period:8,swell_direction:90,wind_direction:180,wind_speed:2,water_temperature:16,air_temperature:17,wetsuit:'4/3mm',tide_cycle_label:'조금',manual_fields:['wave_height'],api_values:{wave_height:{value:2,model:'internal-model',source_type:'archived_forecast'},wind_speed:{value:2}},tide_events:[{id:'t',type:'high',date:'2026-11-01',time:'10:30',height_cm:120,station_name:'시험 지점'}]}}
    const html=renderToStaticMarkup(React.createElement(Detail,{session}))
    assert.equal((html.match(/<h3>파도 정보<\/h3>/g)||[]).length,1)
    for(const text of ['세션 환경값','보존된 개별 입력','internal-model','archived_forecast','너울 높이','너울 주기','직접 수정','원본 API']) assert.ok(!html.includes(text),text)
    for(const text of ['0.8m','9s','스웰 방향','rotate(270deg)','rotate(0deg)','4/3mm','조금','10:30','120cm']) assert.ok(html.includes(text),text)
    assert.ok(html.includes('예측값이 포함'))
    const second={...session,id:'second',started_at:'2026-11-01T03:00:00Z',conditions:{wave_height:null,wave_period:7}}
    const calendar=renderToStaticMarkup(React.createElement(Calendar,{month:'2026-11',sessions:[session,second],date:'2026-11-01',today:'2026-11-01',onDateChange(){}}))
    for(const text of ['만리포해수욕장','09:00','12:00','파고','주기','2회']) assert.ok(!calendar.includes(text),text)
    assert.equal((calendar.match(/calendar-dot registered/g)||[]).length,1)
    assert.match(calendar,/2026-11-01, 기록 2개/)
    assert.match(calendar,/aria-pressed="true"/)
    const journal=readFileSync(new URL('../src/journal/Journal.jsx',import.meta.url),'utf8')
    assert.ok(journal.indexOf('<CalendarView')<journal.indexOf('<Rows sessions={daily}'))
    assert.match(journal,/onDateChange={setDate}/)
    assert.match(journal,/수정<\/button>.*삭제.*목록으로<\/button>/)
    assert.match(journal,/window.confirm/)
    assert.ok(!calendar.includes('5/5'))
    assert.ok(!readFileSync(new URL('../src/journal/Journal.jsx',import.meta.url),'utf8').includes('<MarineConditions'))
  } finally { await server.close() }
})
