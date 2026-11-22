import { tideConventions } from './tides'
import { conditionRecord, savedConditionRows } from './savedConditions'
import SavedWaveTable from './SavedWaveTable'
import { windAudit } from '../lib/windUnits'

export default function ConditionsDetail({ session }) {
  const state=conditionRecord(session.conditions)
  const rows=savedConditionRows(session,state)
  const events=[...(state.tide_events || [])].sort((a,b)=>(Date.parse(a.occurred_at)||0)-(Date.parse(b.occurred_at)||0))
  return <>
    {session.conditionsError && <p role="alert">저장된 환경 정보를 불러오지 못했습니다. 목록을 새로 불러와 주세요.</p>}
    <SavedWaveTable rows={rows} />
    {windAudit(state).length>0 && <p role="status">단위 확인이 필요한 풍속은 표시와 풍속 평균에서 제외됩니다.</p>}
    <dl className="details saved-extras"><dt>서핑 슈트</dt><dd>{state.wetsuit || '-'}</dd>
      <dt>물때</dt><dd>{state.tide_cycle_label || '-'}{state.tide_convention && ' · '+(tideConventions[state.tide_convention] || state.tide_convention)}</dd>
    </dl>
    {!!events.length && <section><h3>만조 · 간조</h3><div className="saved-wave-scroll" tabIndex={0} role="region" aria-label="조석 정보"><table className="saved-wave-table"><thead><tr><th scope="col">종류</th><th scope="col">날짜 · 시간</th><th scope="col">조위</th><th scope="col">지점</th></tr></thead><tbody>
      {events.map((event,i)=><tr key={event.id || i}><th scope="row">{event.type==='high' ? '만조' : '간조'}</th><td>{event.date || '-'} {event.time || '-'}</td><td>{event.height_cm==null ? '-' : event.height_cm+'cm'}{event.source==='khoa' && ' (예측)'}</td><td>{event.station_name || '-'}</td></tr>)}
    </tbody></table></div></section>}
  </>
}
