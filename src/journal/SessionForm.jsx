import { useRef, useState } from 'react'
import { createSpot, updateSpot } from '../services/surfSpots'
import { createSession, updateSession } from '../services/surfSessions'
import { ratings, seoulParts } from './dates'
import SpotInput from './SpotInput'
import RatingInput from './RatingInput'
import { cleanName, canonicalBoard, resolveSpot, savePlace, ratingValue } from './suggestions'
import { initialRatings, validLocation } from './conditionModel'
import { useConditions } from './useConditions'
import ConditionsEditor from './ConditionsEditor'
import { saveConditions } from '../services/sessionConditions'
import TimeInput from './TimeInput'
import { serializeTides } from './tides'
import { serializeIntervals } from './intervals'
import { journalSaver } from '../services/journalSave'

export default function SessionForm({ session, spots, boards = [], onSpot, onSaved, onCancel, initialDate }) {
  const start = session ? seoulParts(session.started_at) : { date: initialDate, time: '09:00' }
  const end = session ? seoulParts(session.ended_at) : { date: initialDate, time: '10:00' }
  const [form, setForm] = useState({ spot_id: session?.spot_id || '', date: start.date, start: start.time, endDate: end.date, end: end.time, board_name: session?.board_name || '', notes: session?.notes || '', ...initialRatings(session, Object.keys(ratings)) })
  const [name, setName] = useState(session?.spot?.name || spots.find(s => s.id === session?.spot_id)?.name || '')
  const [busy, setBusy] = useState(false)
  const [place, setPlace] = useState(null)
  const [error, setError] = useState('')
  const saver = useRef(null)
  const saving = useRef(false)
  if (!saver.current) saver.current=journalSaver(session?.id,createSession,updateSession,saveConditions)
  const selectedSpot = place || spots.find(s => s.id === form.spot_id)
  const startedAt = form.date + 'T' + form.start + ':00+09:00'
  const endedAt = form.endDate + 'T' + form.end + ':00+09:00'
  const conditions = useConditions(session, selectedSpot, startedAt, endedAt)
  const change = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  async function save(e) {
    e.preventDefault()
    if(saving.current) return
    setError('')
    const started_at = form.date + 'T' + form.start + ':00+09:00'
    const ended_at = form.endDate + 'T' + form.end + ':00+09:00'
    if (!(Date.parse(ended_at) > Date.parse(started_at))) return setError('종료 시각은 시작 시각 이후여야 합니다.')
    if (!conditions.ranges.length) return setError('세션은 최대 31일까지 입력할 수 있습니다.')
    if (!cleanName(name)) return setError('스팟 이름을 입력해 주세요.')
    setBusy(true)
    saving.current=true
    try {
      serializeTides(conditions.state.tide_events)
      serializeIntervals(conditions.state.condition_intervals)
      const { spot } = place ? await savePlace(spots, form.spot_id, place, createSpot, updateSpot) : await resolveSpot(spots, form.spot_id, name, createSpot)
      const spot_id = spot.id
      onSpot(spot)
      setPlace(null)
      setForm(f => ({ ...f, spot_id }))
      const record = { spot_id, started_at, ended_at, board_name: canonicalBoard(form.board_name, boards), notes: form.notes.trim() || null, ...Object.fromEntries(Object.keys(ratings).map(k => [k, ratingValue(form[k])])) }
      const saved = await saver.current(record, { ...conditions.state, wetsuit: canonicalBoard(conditions.state.wetsuit, conditions.suits) }, conditions.intent)
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
        <div className="form-grid">
          <label>시작일<input type="date" name="date" required value={form.date} onChange={change} /></label>
          <label>시작 시간<TimeInput name="start" required value={form.start} onChange={change} /></label>
          <label>종료일<input type="date" name="endDate" required value={form.endDate} onChange={change} /></label>
          <label>종료 시간<TimeInput name="end" required value={form.end} onChange={change} /></label>
        </div>
        <label>서핑보드<input name="board_name" list="board-suggestions" value={form.board_name} onChange={change} /></label>
        <datalist id="board-suggestions">{boards.map(board => <option key={board} value={board} />)}</datalist>
        <label>서핑 슈트<input list="wetsuit-suggestions" value={conditions.state.wetsuit || ''} onChange={e => conditions.setState(old => ({ ...old, wetsuit: e.target.value }))} /></label>
        <datalist id="wetsuit-suggestions">{conditions.suits.map(s => <option key={s} value={s} />)}</datalist>
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
