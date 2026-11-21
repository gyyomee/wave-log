import { useId } from 'react'
import { compass, compassPoints, conditionFields, changeCondition, restoreCondition } from './conditionModel'
import { seoulParts } from './dates'
import { intervalLabel } from './intervals'
import TideEditor from './TideEditor'
import { currentManualIntervals } from './forecast'
import { ConditionValues } from './ConditionsDetail'

export function CompassDirectionInput({ label, value, onChange }) {
  const id = useId()
  return <label htmlFor={id}>{label}<select id={id} value={value == null || value === '' ? '' : String(value)} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}>
    <option value="">알 수 없음</option>
    {value != null && value !== '' && !compassPoints.some((_,i) => i * 22.5 === Number(value)) && <option value={value}>{compass(value)} / {value}°</option>}
    {compassPoints.map((p,i) => <option key={p} value={i * 22.5}>{p} / {i * 22.5}°</option>)}
  </select></label>
}
export function ConditionFields({ state, setState, ctx, fields = Object.keys(conditionFields) }) {
  return <div className="form-grid">{Object.entries(conditionFields).filter(([key])=>fields.includes(key)).map(([key,spec]) => {
      const value = state[key], api = state.api_values?.[key], manual = state.manual_fields?.includes(key)
      const change = v => setState(old => changeCondition({ ...old, context: ctx }, key, v))
      return <div key={key} className="condition-field">
        {spec.direction ? <CompassDirectionInput label={spec.label + ' (불어오는 방향)'} value={value} onChange={change} /> :
          <label>{spec.label} ({spec.unit})<input type="number" step="any" min={spec.min} max={spec.max} value={value ?? ''} onChange={e => change(e.target.value === '' ? null : e.target.value)} /></label>}
        <small>{manual ? '직접 수정' : api?.value != null ? 'Open-Meteo 모델' : '미입력'}
          {api?.sampled_at && ' · ' + seoulParts(api.sampled_at).date + ' ' + seoulParts(api.sampled_at).time}
          {(manual ? state.manual_origins?.[key]?.context && state.manual_origins[key].context !== ctx : api?.context && api.context !== ctx) && ' · 변경 전 위치/시간 값'}
        </small>
        {manual && <button type="button" onClick={() => { if (window.confirm('직접 입력한 값을 API 값으로 교체할까요?')) setState(old => restoreCondition(old,key)) }}>API 값으로 복원</button>}
      </div>
    })}</div>
}
export default function ConditionsEditor({ data }) {
  const { state, setState } = data
  const manual = currentManualIntervals(state,data.start,data.end)
  const editInterval = id => update => setState(old => ({ ...old, condition_intervals: old.condition_intervals.map(row => row.id === id ? update(row) : row) }))
  return <section className="conditions-editor"><h3>시간대별 서핑 환경</h3>
    {data.loading && <p role="status">환경 데이터 불러오는 중...</p>}
    {data.message && <p role="status">{data.message}</p>}
    {!data.ctx && <p>자동 환경값 없음 · 직접 입력 가능</p>}
    {!data.ranges.length && <p>시작·종료 시간을 확인해 주세요. 최대 31일까지 지원합니다.</p>}
    {data.ctx && <button type="button" disabled={data.loading} onClick={data.retry}>환경값 다시 조회</button>}
    {data.ranges.map(range => {
      const row = state._forecast?.find(r => r.id === range.id)
      return row && <details className="condition-interval" key={row.id}><summary>{seoulParts(range.forecast_at).date} {seoulParts(range.forecast_at).time}</summary><ConditionValues state={row} /></details>
    })}
    <h3>기록한 서핑 환경</h3>
    <ConditionFields state={state} setState={setState} ctx={data.ctx} />
    {manual.map(row => <details key={row.id}><summary>보존된 개별 입력 · {intervalLabel(row)}</summary><ConditionFields state={row} setState={editInterval(row.id)} ctx={row.context} fields={row.manual_fields?.length ? row.manual_fields : Object.keys(conditionFields).filter(key=>row[key]!=null)} /></details>)}
    <TideEditor state={state} setState={setState} start={data.start} />
    <small>Open-Meteo 모델 추정값 · 현장 관측값이 아닙니다.</small>
  </section>
}
