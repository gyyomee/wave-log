import { tideLabels, tideConventions } from './tides'
import { seoulParts } from './dates'
import TimeInput from './TimeInput'

export default function TideEditor({ state, setState, start }) {
  const events = state.tide_events || []
  const change = (id, key, value) => setState(old => ({ ...old, tide_events: (old.tide_events || []).map(event => event.id === id ? { ...event, [key]: value, source: 'manual', original: event.original || (event.source === 'khoa' ? { ...event } : null) } : event) }))
  function add() {
    const date = Number.isFinite(Date.parse(start)) ? seoulParts(start).date : ''
    setState(old => ({ ...old, tide_events: [...(old.tide_events || []), { id: crypto.randomUUID(), type: 'high', date, time: '', height_cm: null, source: 'manual', station_name: '', station_id: null, original: null }] }))
  }
  return <section className="tide-editor"><h3>물때 · 조석</h3>
    <div className="form-grid">
      <label>물때<input list="tide-labels" maxLength={80} value={state.tide_cycle_label || ''} onChange={e => setState(old => ({ ...old, tide_cycle_label: e.target.value }))} /></label>
      <datalist id="tide-labels">{tideLabels.map(label => <option key={label} value={label} />)}</datalist>
      <label>지역 물때 기준<select value={state.tide_convention || ''} onChange={e => setState(old => ({ ...old, tide_convention: e.target.value }))}>{Object.entries(tideConventions).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {!events.length && <p>입력된 만조·간조 없음</p>}
    {events.map((event,i) => <fieldset className="tide-event" key={event.id}><legend>조석 {i+1} · {event.source === 'khoa' ? 'KHOA 예측' : '직접 입력'}</legend><div className="form-grid">
      <label>종류<select value={event.type} onChange={e => change(event.id,'type',e.target.value)}><option value="high">만조</option><option value="low">간조</option></select></label>
      <label>날짜<input type="date" required value={event.date} onChange={e => change(event.id,'date',e.target.value)} /></label>
      <label>시각<TimeInput required value={event.time} onChange={e => change(event.id,'time',e.target.value)} /></label>
      <label>예측 조위 (cm, 선택)<input type="number" step="any" min="-5000" max="5000" value={event.height_cm ?? ''} onChange={e => change(event.id,'height_cm',e.target.value)} /></label>
      <label>예보 지점명 (선택)<input maxLength={120} value={event.station_name || ''} onChange={e => change(event.id,'station_name',e.target.value)} /></label>
    </div><button type="button" onClick={() => setState(old => ({ ...old, tide_events: old.tide_events.filter(row => row.id !== event.id) }))}>조석 삭제</button></fieldset>)}
    <button type="button" onClick={add}>만조·간조 추가</button>
  </section>
}
