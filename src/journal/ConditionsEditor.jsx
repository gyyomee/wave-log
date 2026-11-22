import { conditionFields } from './conditionModel'
import { seoulParts } from './dates'
import TideEditor from './TideEditor'
import DirectionPicker from './DirectionPicker'
import { savedFields } from './savedConditions'
import { timestampValues, editTimestamp, canResetCondition, resetTimestamp } from './timestampEdits'
import resetIcon from '../assets/rotate-ccw.svg'
import { windFromInput, windToDisplay, windAudit } from '../lib/windUnits'
import { usePreferences } from '../preferences/PreferencesContext'
import WindUnitControl from '../preferences/WindUnitControl'
export const CompassDirectionInput=DirectionPicker
export default function ConditionsEditor({data}) {
  const {state,setState}=data
  const {unit}=usePreferences()
  const forecasts=state._forecast || []
  return <section className="conditions-editor"><h3>파도 정보</h3>
    <WindUnitControl/>
    {windAudit(state).length>0 && <p role="status">단위 확인이 필요한 과거 풍속이 있습니다. 원본은 유지되며 통계에서 제외됩니다.</p>}
    {data.loading && <p role="status">파도 정보 불러오는 중...</p>}
    {!data.ranges.length && <p>시작·종료 시각을 확인해 주세요.</p>}
    {data.message && /실패|없음|오류|단위|불가|error|failed/i.test(data.message) && <p role="status">일부 정보를 가져오지 못했습니다. 직접 입력할 수 있습니다.</p>}
    {data.ctx && <button type="button" disabled={data.loading} onClick={data.retry}>다시 조회</button>}
    <div className="condition-edit-scroll"><table className="condition-edit-table"><thead><tr><th scope="col">항목</th>{forecasts.map(row=><th scope="col" key={row.id}>{seoulParts(row.forecast_at).date}<br/>{seoulParts(row.forecast_at).time}</th>)}</tr></thead><tbody>
    {savedFields.map(key=>{
      const spec=conditionFields[key],label=key==='swell_direction'?'스웰 방향':spec.label
      return <tr key={key}><th scope="row">{label}{!spec.direction && ' ('+(key==='wind_speed' ? unit : spec.unit)+')'}</th>{forecasts.map(forecast=>{
        const row=timestampValues(state,forecast), name=label+' '+seoulParts(forecast.forecast_at).date+' '+seoulParts(forecast.forecast_at).time
        const change=value=>setState(old=>editTimestamp(old,forecast,key,key==='wind_speed' ? windFromInput(value,unit) : value,data.ctx))
        const displayValue=key==='wind_speed' && row[key]!=null ? Number(windToDisplay(row[key],unit).toFixed(6)) : row[key]
        const canReset=canResetCondition(row,key)
        return <td key={forecast.id}><div className="condition-input-row">{spec.direction ? <DirectionPicker label={name} value={row[key]} onChange={change}/> : <input aria-label={name+(key==='wind_speed' ? ' ('+unit+')' : '')} type="number" step="any" min={spec.min} max={key==='wind_speed' ? windToDisplay(spec.max,unit) : spec.max} placeholder="-" value={displayValue ?? ''} onChange={e=>change(e.target.value===''?null:Number(e.target.value))}/>}
        <button className="condition-reset" type="button" disabled={!canReset} aria-label={name+' API 값으로 초기화'} title={canReset ? 'API 값으로 초기화' : row.api_values?.[key]?.value==null ? '초기화할 API 값 없음' : '변경된 값 없음'} onClick={()=>{if(window.confirm('직접 입력한 값을 현재 예측값으로 교체할까요?'))setState(old=>resetTimestamp(old,forecast,key,data.ctx))}}><img src={resetIcon} width="18" height="18" alt="" aria-hidden="true"/></button></div></td>
      })}</tr>
    })}
    </tbody></table></div>
    <small>예측값은 실제 현장 상태와 다를 수 있습니다. 방향 이름은 오는 쪽, 화살표는 이동하는 쪽입니다.</small>
    <TideEditor state={state} setState={setState} start={data.start}/>
  </section>
}
