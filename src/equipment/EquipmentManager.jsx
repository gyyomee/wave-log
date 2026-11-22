import { useRef, useState } from 'react'
import { useEquipment } from './EquipmentContext'
import { equipmentOptions } from './equipmentModel'

function Group({type,title,equipment}) {
  const [name,setName]=useState(''),[editing,setEditing]=useState(null),[editName,setEditName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const pending=useRef(false),rows=equipmentOptions(equipment.items,type)
  async function run(operation) {
    if(pending.current) return
    pending.current=true;setBusy(true);setError('')
    try {await operation()}
    catch(e) {setError(e.code==='23505' ? '같은 이름의 장비가 이미 등록되어 있습니다.' : e.message)}
    finally {pending.current=false;setBusy(false)}
  }
  return <section className="equipment-group"><h3>{title}</h3>
    <form className="equipment-add" onSubmit={e=>{e.preventDefault();run(async()=>{await equipment.register(type==='surfboard' ? name : null,type==='wetsuit' ? name : null);setName('')})}}><label>{title} 이름<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><button disabled={busy || !name.trim()}>추가</button></form>
    {!rows.length ? <p className="empty">등록한 {title}가 없습니다.</p> : <ul className="equipment-list">{rows.map(item=><li key={item.id}>
      {editing===item.id ? <form onSubmit={e=>{e.preventDefault();run(async()=>{await equipment.rename(item.id,editName);setEditing(null)})}}><label>새 장비 이름<input required maxLength={200} value={editName} onChange={e=>setEditName(e.target.value)} disabled={busy}/></label><div className="equipment-actions"><button disabled={busy}>저장</button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>취소</button></div></form> : <><span>{item.name}</span><div className="equipment-actions"><button type="button" disabled={busy} onClick={()=>{setEditing(item.id);setEditName(item.name)}}>이름 변경</button><button type="button" disabled={busy} onClick={()=>{if(window.confirm(item.name+'를 장비 목록에서 제외할까요? 기존 일지는 그대로 유지됩니다.'))run(()=>equipment.archive(item.id))}}>목록에서 제외</button></div></>}
    </li>)}</ul>}
    {error && <p role="alert">{error}</p>}
  </section>
}
export default function EquipmentManager() {
  const equipment=useEquipment()
  return <section><h2>내 장비 관리</h2>{equipment.loading ? <p role="status">장비 불러오는 중...</p> : equipment.error ? <div role="alert"><p>{equipment.error}</p><button onClick={equipment.reload}>다시 불러오기</button></div> : <><Group type="surfboard" title="서핑보드" equipment={equipment}/><Group type="wetsuit" title="서핑 슈트" equipment={equipment}/></>}</section>
}
