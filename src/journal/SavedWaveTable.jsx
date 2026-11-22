import { conditionFields } from './conditionModel'
import { directionLabel, travelRotation } from './directions'
import { savedFields, formatSaved } from './savedConditions'
import { formatWind } from '../lib/windUnits'
import { usePreferences } from '../preferences/PreferencesContext'

export function SavedValue({ field, value }) {
  const {unit}=usePreferences()
  const spec=conditionFields[field]
  if(value==null) return '-'
  if(field==='wind_speed') return formatWind(value,unit)
  if(!spec.direction) return formatSaved(value,spec.unit)
  return <span className="saved-direction"><span className="direction-arrow" aria-hidden="true" style={{transform:'rotate('+travelRotation(value)+'deg)'}}>↑</span><span>{directionLabel(value)} {value}°</span></span>
}
const label=key=>key==='swell_direction' ? '스웰 방향' : conditionFields[key].label
export default function SavedWaveTable({ rows }) {
  const timed=rows.length>1
  return <section className="saved-wave"><h3>파도 정보</h3>
    {!timed && rows[0].label!=='전체' && <p className="saved-time">{rows[0].label}</p>}
    <div className="saved-wave-scroll" tabIndex={0} role="region" aria-label="저장된 파도 정보">
      {timed ? <table className="saved-wave-table timed"><caption className="sr-only">시간별 파도 정보</caption><thead><tr><th scope="col">시간</th>{savedFields.map(key=><th scope="col" key={key}>{label(key)}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row">{row.label}</th>{savedFields.map(key=><td key={key}><SavedValue field={key} value={row.values[key]} /></td>)}</tr>)}</tbody></table> :
        <table className="saved-wave-table"><caption className="sr-only">파도 정보</caption><tbody>{savedFields.map(key=><tr key={key}><th scope="row">{label(key)}</th><td><SavedValue field={key} value={rows[0].values[key]} /></td></tr>)}</tbody></table>}
    </div>
    {rows.some(row=>row.estimates.length>0) && <p className="condition-note">예측값이 포함되어 있으며 실제 현장 상태와 다를 수 있습니다.</p>}
    <p className="condition-note">방향 이름은 오는 쪽, 화살표는 이동하는 쪽입니다.</p>
  </section>
}
