import { useRef, useState } from 'react'
import { createSpot, updateSpot } from '../services/surfSpots'
import { createSession, updateSession } from '../services/surfSessions'
import { ratings, seoulParts } from './dates'
import SpotInput from './SpotInput'
import RatingInput from './RatingInput'
import { cleanName, resolveSpot, savePlace, ratingValue } from './suggestions'
import { initialRatings, validLocation } from './conditionModel'
import { useConditions } from './useConditions'
import ConditionsEditor from './ConditionsEditor'
import { saveConditions } from '../services/sessionConditions'
import TimeInput from './TimeInput'
import { serializeTides } from './tides'
import { serializeIntervals } from './intervals'
import { journalSaver } from '../services/journalSave'
import { useEquipment } from '../equipment/EquipmentContext'
import EquipmentInput from '../equipment/EquipmentInput'
import { journalEquipmentName } from '../equipment/equipmentModel'
import { equipmentName } from '../services/equipment'
import { sessionTimes } from './sessionTimes'

export default function SessionForm({ session, spots, onSpot, onSaved, onCancel, initialDate }) {
  const start = session ? seoulParts(session.started_at) : { date: initialDate, time: '09:00' }
  const end = session ? seoulParts(session.ended_at) : { date: initialDate, time: '10:00' }
  const [form, setForm] = useState({ spot_id: session?.spot_id || '', date: start.date, start: start.time, end: end.time, board_name: session?.board_name || '', notes: session?.notes || '', ...initialRatings(session, Object.keys(ratings)) })
  const [name, setName] = useState(session?.spot?.name || spots.find(s => s.id === session?.spot_id)?.name || '')
  const [busy, setBusy] = useState(false)
  const [place, setPlace] = useState(null)
  const [error, setError] = useState('')
  const saver = useRef(null)
  const saving = useRef(false)
  const equipment=useEquipment()
  if (!saver.current) saver.current=journalSaver(session?.id,createSession,updateSession,saveConditions,equipment.register)
  const selectedSpot = place || spots.find(s => s.id === form.spot_id)
  const times=sessionTimes(form.date,form.start,form.end,session)
  const startedAt = times.started_at
  const endedAt = times.ended_at
  const conditions = useConditions(session, selectedSpot, startedAt, endedAt)
  const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  async function save(e) {
    e.preventDefault()
    if(saving.current) return
    setError('')
    const {started_at,ended_at}=times
    if (times.error) return setError(times.error)
    if (!conditions.ranges.length) return setError('세션은 최대 31일까지 입력할 수 있습니다.')
    if (!cleanName(name)) return setError('스팟 이름을 입력해 주세요.')
    setBusy(true)
    saving.current=true
    try {
      const board=journalEquipmentName(form.board_name,session?.board_name,equipment.items,'surfboard')
      const wetsuit=journalEquipmentName(conditions.state.wetsuit,conditions.originalWetsuit,equipment.items,'wetsuit')
      const registration={board:session && board===session.board_name ? null : board,wetsuit:session && wetsuit===conditions.originalWetsuit ? null : wetsuit}
      for(const name of Object.values(registration)) if(name) equipmentName(name)
      if((registration.board || registration.wetsuit) && (equipment.loading || equipment.error)) throw new Error('장비 목록을 먼저 불러와 주세요.')
      serializeTides(conditions.state.tide_events)
      serializeIntervals(conditions.state.condition_intervals)
      const { spot } = place ? await savePlace(spots, form.spot_id, place, createSpot, updateSpot) : await resolveSpot(spots, form.spot_id, name, createSpot)
      const spot_id = spot.id
      onSpot(spot)
      setPlace(null)
      setForm(f => ({ ...f, spot_id }))
      const record = { spot_id, started_at, ended_at, board_name: board, notes: form.notes.trim() || null, ...Object.fromEntries(Object.keys(ratings).map(k => [k, ratingValue(form[k])])) }
      const saved = await saver.current(record, { ...conditions.state, wetsuit }, conditions.intent,registration)
      onSaved(saved)
    } catch (e) { setError('저장하지 못했습니다: ' + e.message) }
    finally { saving.current=false; setBusy(false) }
  }
  return <section><h2>{session ? '기록 수정' : '새 서핑 기록'}</h2>
    <form className="journal-form" onSubmit={save}>
      <fieldset disabled={busy || !conditions.ready}>
        <SpotInput spots={spots} value={name} locationValid={validLocation(selectedSpot)} onChange={value => { setName(value); setPlace(null); setForm(f => ({ ...f, spot_id: '' })) }} onSelect={spot => {
          if (spot.external) {
            const existing = spots.find(s => s.id === form.spot_id)
            if (existing && !window.confirm(existing.name + '의 위치를 ' + spot.region + '로 변경할까요? 연결된 기록은 유지됩니다.')) return
            setPlace(spot); setName(existing?.name || spot.name)
          } else { setPlace(null); setName(spot.name); setForm(f => ({ ...f, spot_id: spot.id })) }
        }} />
        {place && <small>선택한 위치: {place.name} · {place.region}</small>}
        {validLocation(selectedSpot) ? <small role="status">위치 확인 완료 · 자동 환경 조회 가능</small> : <small>위치 없이 이름만 저장할 수 있습니다. 자동 환경 조회는 유효한 장소 선택 후 사용할 수 있습니다.</small>}
        <p className="session-date">{form.date}</p>
        <div className="form-grid">
          <label>시작 시간<TimeInput name="start" required value={form.start} onChange={change} /></label>
          <label>종료 시간{times.overnight && <span className="overnight">{times.nextDay ? '익일 · ' : '종료 · '}{times.endDate}</span>}<TimeInput name="end" required value={form.end} onChange={change} /></label>
        </div>
        {times.error && <p role="alert">{times.error}</p>}
        <EquipmentInput label="서핑보드" type="surfboard" items={equipment.items} value={form.board_name} onChange={value=>setForm(f=>({...f,board_name:value}))}/>
        <EquipmentInput label="서핑 슈트" type="wetsuit" items={equipment.items} value={conditions.state.wetsuit || ''} onChange={value=>conditions.setState(old=>({...old,wetsuit:value}))}/>
        {equipment.loading && <p role="status">장비 불러오는 중...</p>}
        {equipment.error && <div role="alert">{equipment.error}<button type="button" onClick={equipment.reload}>다시 불러오기</button></div>}
        <div className="form-grid">{Object.entries(ratings).map(([key, label]) => <RatingInput key={key} label={label} value={form[key]} crowd={key === 'crowd_level'} onChange={value => { setForm(f => ({ ...f, [key]: value })); conditions.setIntent(old => ({ ...old, [key]: 'modified' })) }} />)}</div>
        <ConditionsEditor data={conditions} />
        <label>메모<textarea name="notes" rows={5} value={form.notes} onChange={change} /></label>
      </fieldset>
      {!conditions.ready && <p role="status">{conditions.loadError || '기존 환경값 확인 중...'}{conditions.loadError && <button type="button" onClick={conditions.reload}>다시 불러오기</button>}</p>}
      {error && <p role="alert" className="form-message error">{error}</p>}
      <div className="actions"><button disabled={busy} type="button" onClick={onCancel}>취소</button><button className="save" disabled={busy || !conditions.ready || conditions.loading}>{busy ? '저장 중...' : '저장'}</button></div>
    </form>
  </section>
}
