import { useId } from 'react'
import { usePreferences } from './PreferencesContext'

export default function WindUnitControl() {
  const {unit,ready,loading,saving,error,message,change,retry}=usePreferences(),name=useId()
  return <div className="wind-unit-control">
    <fieldset disabled={!ready || loading || saving}><legend>풍속 표시 단위</legend><div className="unit-options">
      {[['kts','kts (노트)'],['m/s','m/s (초속)']].map(([value,label])=><label key={value}><input type="radio" name={name} value={value} checked={unit===value} onChange={()=>change(value)}/><span>{label}</span></label>)}
    </div></fieldset>
    {(loading || saving || message) && <p role="status">{loading ? '설정 불러오는 중...' : saving ? '저장 중...' : message}</p>}
    {error && <div role="alert"><p>{error}{!ready && ' 현재는 기본 단위 kts로 표시합니다.'}</p><button type="button" disabled={loading || saving} onClick={retry}>설정 다시 불러오기</button></div>}
  </div>
}
