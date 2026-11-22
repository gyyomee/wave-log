import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'
import { forecastRange, forecastState } from '../src/journal/forecast.js'

test('statistics renders loading, errors, empty data, knots and unit review separately',async()=>{
  const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false,ws:false},appType:'custom'})
  try {
    const {default:Statistics}=await server.ssrLoadModule('/src/journal/Statistics.jsx')
    const render=props=>renderToStaticMarkup(React.createElement(Statistics,{sessions:[],spots:[],onOpen(){},...props}))
    assert.match(render({loading:true}),/통계 불러오는 중/)
    assert.match(render({error:true}),/기록을 모두 불러온 뒤/)
    assert.match(render({}),/서핑 기록이 없습니다/)
    const base={started_at:'2026-10-01T00:00:00Z',ended_at:'2026-10-01T03:00:00Z',spot_id:'spot',spot:{name:'Test'}}
    const html=render({sessions:[{...base,id:'manual',conditions:{wind_speed:10,manual_fields:['wind_speed']}},{...base,id:'unknown',conditions:{wind_speed:7}}]})
    assert.match(html,/10 kts/)
    assert.match(html,/풍속 단위 확인이 필요한 1개 기록/)
    assert.doesNotMatch(html,/풍속 기록 점검|원래 숫자|검토 목록 다운로드|단위 확정/)
    assert.ok(!html.split('class="statistics-summary"')[1].split('</dl>')[0].includes('m/s'))
    const {default:Editor}=await server.ssrLoadModule('/src/journal/ConditionsEditor.jsx')
    const start=base.started_at,end=base.ended_at,ctx=JSON.stringify([37,129,start,end]),ranges=forecastRange(start,end)
    const state=forecastState({context:ctx,wind_speed:10,manual_fields:['wind_speed']},ranges,ctx)
    const editor=renderToStaticMarkup(React.createElement(Editor,{data:{state,setState(){},ranges,start,end,ctx,message:'weather: 풍속 API 응답 단위가 요청한 knots와 다릅니다.'}}))
    assert.match(editor,/풍속 \(kts\)/)
    assert.match(editor,/aria-label="풍속 [^"]+"[^>]+value="10"/)
    assert.match(editor,/일부 정보를 가져오지 못했습니다/)
    assert.ok(!editor.split('<table')[1].split('</table>')[0].includes('m/s'))
  } finally { await server.close() }
})
