import { useEffect, useState } from 'react'
import { getConditions } from '../services/sessionConditions'
import { conditionFields, compass, contextKey } from './conditionModel'
import { seoulParts } from './dates'
import { intervalLabel } from './intervals'
import { forecastRange, forecastState, currentManualIntervals } from './forecast'
import { tideConventions } from './tides'

export function ConditionValues({ state, fields = Object.keys(conditionFields) }) {
  function display(value, spec) { return value == null ? '미입력' : (spec.direction ? compass(value) + ' / ' : '') + value + ' ' + spec.unit }
  return <dl className="details">{Object.entries(conditionFields).filter(([key])=>fields.includes(key)).map(([key,spec]) => {
    const api = state.api_values?.[key], manual = state.manual_fields?.includes(key)
    return <div className="detail-pair" key={key}><dt>{spec.label}</dt><dd>{display(state[key],spec)} · {manual ? '직접 수정' : api?.value != null ? 'Open-Meteo 모델' : '미입력'}
      {manual && <small> · 원본 API {display(api?.value,spec)}</small>}
      {api?.sampled_at && <small> · {seoulParts(api.sampled_at).date} {seoulParts(api.sampled_at).time} · {api.model} / {api.source_type}</small>}
    </dd></div>
  })}</dl>
}
export default function ConditionsDetail({ sessionId, startedAt, endedAt, spot }) {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getConditions(sessionId).then(data => { if (active) setState(data) }).catch(e => { if (active) setError('환경값 조회 실패: ' + e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [sessionId])
  if (loading) return <p role="status">환경값 확인 중...</p>
  if (error) return <p role="alert">{error}</p>
  if (!state) return <p>저장된 추가 환경값이 없습니다.</p>
  const ranges = forecastRange(startedAt,endedAt)
  const displayState = forecastState(state,ranges,contextKey(spot,startedAt,endedAt))
  const current = displayState._forecast
  const manual = currentManualIntervals(state,startedAt,endedAt)
  return <section><h3>기록한 서핑 환경</h3>
    {current.map(row => <section key={row.id}><h4>{seoulParts(row.forecast_at).date} {seoulParts(row.forecast_at).time}</h4><ConditionValues state={row} /></section>)}
    <h4>세션 환경값</h4><ConditionValues state={displayState} />
    {manual.map(row => <details key={row.id}><summary>보존된 개별 입력 · {intervalLabel(row)}</summary><ConditionValues state={row} fields={row.manual_fields?.length ? row.manual_fields : Object.keys(conditionFields).filter(key=>row[key]!=null)} /></details>)}
    <dl className="details">
    <dt>서핑 슈트</dt><dd>{state.wetsuit || '미입력'}</dd>
    <dt>물때</dt><dd>{state.tide_cycle_label || '미입력'} · {tideConventions[state.tide_convention || '']}</dd>
  </dl>
    <h4>만조 · 간조</h4>
    {!state.tide_events?.length && <p>입력된 조석 없음</p>}
    <ul>{[...(state.tide_events || [])].sort((a,b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)).map(event => <li key={event.id}>{event.type === 'high' ? '만조' : '간조'} · {event.date} {event.time} · {event.height_cm == null ? '조위 미입력' : event.height_cm + ' cm'} · {event.source === 'khoa' ? 'KHOA 예측' : '직접 입력'}{event.station_name && ' · ' + event.station_name}</li>)}</ul>
    <p><a href="https://open-meteo.com/">Open-Meteo</a> · 기상 ERA5/ECMWF, 해양 Météo-France/Copernicus · 모델 추정값, 방향은 불어오는 방향 기준</p></section>
}
