// Isolated browser fixtures; all equipment and journals live only in memory.
import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EquipmentContext } from '../../src/equipment/EquipmentContext'
import EquipmentInput from '../../src/equipment/EquipmentInput'
import EquipmentManager from '../../src/equipment/EquipmentManager'
import { cleanName, nameKey } from '../../src/journal/suggestions'
import { journalSaver } from '../../src/services/journalSave'
import TimeInput from '../../src/journal/TimeInput'
import { sessionTimes } from '../../src/journal/sessionTimes'
import '../../src/styles.css'
import '../../src/journal/journal.css'

function App() {
  const [items,setItems]=useState([...Array.from({length:20},(_,i)=>({id:'b'+i,equipment_type:'surfboard',name:'Demo '+String(i+1).padStart(2,'0'),is_active:true})),{id:'s1',equipment_type:'wetsuit',name:'4/3mm test',is_active:true}])
  const rows=useRef(items),[board,setBoard]=useState(''),[suit,setSuit]=useState(''),[message,setMessage]=useState(''),[fail,setFail]=useState(false)
  const [start,setStart]=useState('22:00'),[end,setEnd]=useState('01:00'),times=sessionTimes('2026-11-22',start,end)
  const saver=useRef(null),failure=useRef(false);failure.current=fail
  function publish(next) {rows.current=next;setItems(next)}
  async function register(boardName,suitName) {
    const added=[];let next=[...rows.current]
    for(const [type,value] of [['surfboard',boardName],['wetsuit',suitName]]) {
      if(!cleanName(value)) continue
      const old=next.find(item=>item.equipment_type===type && nameKey(item.name)===nameKey(value))
      const row=old ? {...old,is_active:true} : {id:crypto.randomUUID(),equipment_type:type,name:cleanName(value),is_active:true}
      next=[...next.filter(item=>item.id!==row.id),row];added.push(row)
    }
    publish(next);return added
  }
  async function rename(id,name) {publish(rows.current.map(item=>item.id===id ? {...item,name:cleanName(name)} : item))}
  async function archive(id) {publish(rows.current.map(item=>item.id===id ? {...item,is_active:false} : item))}
  if(!saver.current) saver.current=journalSaver(null,async()=>({id:'fixture'}),async id=>({id}),async()=>{if(failure.current)throw Error('fixture failure')},register)
  return <EquipmentContext.Provider value={{items,loading:false,error:'',register,rename,archive}}><div className="journal-shell"><h1>Equipment test</h1><div className="journal-form"><div className="form-grid"><label>시작 시간<TimeInput value={start} onChange={e=>setStart(e.target.value)}/></label><label>종료 시간<TimeInput value={end} onChange={e=>setEnd(e.target.value)}/></label></div><p>{times.error || (times.overnight ? '익일 '+times.endDate : times.date)}</p>
    <EquipmentInput label="서핑보드" type="surfboard" items={items} value={board} onChange={setBoard}/><EquipmentInput label="서핑 슈트" type="wetsuit" items={items} value={suit} onChange={setSuit}/>
    <label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>환경값 저장 실패 모의</label><button onClick={async()=>{try {await saver.current({board_name:board},{wetsuit:suit},{},{board,wetsuit:suit});setMessage('저장 완료')}catch(e){setMessage(e.message)}}}>일지 저장 모의</button><p role="status">{message}</p><output aria-label="장비 개수">{items.length}</output></div><EquipmentManager/></div></EquipmentContext.Provider>
}
createRoot(document.getElementById('root')).render(<App/> )
