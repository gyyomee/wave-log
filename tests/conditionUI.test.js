import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer } from 'vite'

test('rating and compass controls render without activation checkboxes or precision loss', async () => {
  const server = await createServer({ server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' })
  try {
    const { default: Rating } = await server.ssrLoadModule('/src/journal/RatingInput.jsx')
    const { CompassDirectionInput } = await server.ssrLoadModule('/src/journal/ConditionsEditor.jsx')
    const rating = renderToStaticMarkup(React.createElement(Rating, { label: '파도', value: 3, intent: 'default', onChange() {}, onConfirm() {} }))
    assert.match(rating, /min="1"/)
    assert.match(rating, /max="5"/)
    assert.match(rating, /value="3"/)
    assert.doesNotMatch(rating, /type="checkbox"/)
    const legacy = renderToStaticMarkup(React.createElement(Rating, { label: '파도', value: '', onChange() {} }))
    assert.match(legacy, /기존 값 유지/)
    const direction = renderToStaticMarkup(React.createElement(CompassDirectionInput, { label: '방향', value: 44.7, onChange() {} }))
    assert.match(direction, /value="44.7" selected/)
    assert.match(direction, /NE \/ 44.7°/)
    const { default: Editor } = await server.ssrLoadModule('/src/journal/ConditionsEditor.jsx')
    const { forecastRange, forecastState } = await server.ssrLoadModule('/src/journal/forecast.js')
    const ranges = forecastRange('2026-10-01T08:00:00+09:00','2026-10-01T14:00:00+09:00')
    const state = forecastState({},ranges,'')
    state.tide_events = [{ id:'test', type:'high', date:'2026-10-02', time:'01:00', source:'manual', height_cm:null }]
    const markup = renderToStaticMarkup(React.createElement(Editor,{ data:{ state,setState(){},ranges,ctx:'',suits:[],start:'2026-10-01T08:00:00+09:00' } }))
    assert.match(markup,/2026-10-01 06:00/)
    assert.match(markup,/2026-10-01 15:00/)
    assert.doesNotMatch(markup,/이전 시간 구간 기록/)
    assert.match(markup,/물때/)
    assert.match(markup,/7물때/)
    assert.match(markup,/8물때/)
    assert.match(markup,/value="01:00"/)
    assert.doesNotMatch(markup,/type="time"/)
    assert.equal((markup.match(/서핑 슈트/g)||[]).length,0)
    const { default: Form } = await server.ssrLoadModule('/src/journal/SessionForm.jsx')
    const formMarkup=renderToStaticMarkup(React.createElement(Form,{spots:[],boards:[],initialDate:'2026-10-01'}))
    const labels=[...formMarkup.matchAll(/<label[^>]*>([^<]+)/g)].map(match=>match[1])
    assert.equal(labels[labels.indexOf('서핑보드')+1],'서핑 슈트')
    assert.equal((formMarkup.match(/서핑 슈트/g)||[]).length,1)
    const { Wheel } = await server.ssrLoadModule('/src/journal/TimeInput.jsx')
    const hourWheel=renderToStaticMarkup(React.createElement(Wheel,{label:'시',max:23,value:23,onChange(){}}))
    const minuteWheel=renderToStaticMarkup(React.createElement(Wheel,{label:'분',max:59,value:59,onChange(){}}))
    assert.match(hourWheel,/role="spinbutton"/)
    assert.match(hourWheel,/aria-valuemax="23"/)
    assert.match(minuteWheel,/aria-valuemax="59"/)
    assert.doesNotMatch(hourWheel+minuteWheel,/AM|PM|type="range"/)
  } finally { await server.close() }
})
