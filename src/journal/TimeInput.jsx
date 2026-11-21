import { useEffect, useRef, useState, useId } from 'react'
import { createPortal } from 'react-dom'
import { parseTime, formatTime, wheelKey } from './timePicker'

export function Wheel({ label, max, value, onChange }) {
  const ref=useRef(null), dragging=useRef(null)
  useEffect(()=>{ if (ref.current && !dragging.current && Math.abs(ref.current.scrollTop-value*44)>23) ref.current.scrollTop=value*44 },[value])
  return <div className="time-wheel" ref={ref} role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={String(value).padStart(2,'0')}
    onScroll={e=>{const selected=Math.max(0,Math.min(max,Math.round(e.currentTarget.scrollTop/44)));if(selected!==value) onChange(selected)}}
    onKeyDown={e=>{ if (['ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key)) { e.preventDefault(); onChange(wheelKey(value,e.key,max)) } }}
    onPointerDown={e=>{ if(e.pointerType==='mouse') { dragging.current={y:e.clientY,top:e.currentTarget.scrollTop}; e.currentTarget.style.scrollSnapType='none'; e.currentTarget.setPointerCapture(e.pointerId) } }}
    onPointerMove={e=>{ if(dragging.current) e.currentTarget.scrollTop=dragging.current.top+dragging.current.y-e.clientY }}
    onPointerUp={e=>{ const drag=dragging.current;dragging.current=null; e.currentTarget.style.scrollSnapType=''; if(drag) {const index=Math.abs(e.clientY-drag.y)<4 ? Math.round((e.clientY-e.currentTarget.getBoundingClientRect().top-110+e.currentTarget.scrollTop)/44) : Math.round(e.currentTarget.scrollTop/44);onChange(Math.max(0,Math.min(max,index)))} }}
    onPointerCancel={e=>{dragging.current=null;e.currentTarget.style.scrollSnapType=''}}>
    {Array.from({length:max+1},(_,i)=><div className="time-wheel-option" aria-hidden="true" key={i}>{String(i).padStart(2,'0')}</div>)}
  </div>
}
export default function TimeInput({ value='', onChange, name, ...props }) {
  const [open,setOpen]=useState(false), [draft,setDraft]=useState(value)
  const field=useRef(null), dialog=useRef(null), title=useId()
  const parts=parseTime(draft) || [0,0]
  const close=()=>{setOpen(false);field.current?.focus()}
  useEffect(()=>{
    if(!open) return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    dialog.current?.querySelector('[role="spinbutton"]')?.focus()
    return ()=>{document.body.style.overflow=previous}
  },[open])
  return <>
    <input {...props} ref={field} name={name} value={value} type="text" readOnly placeholder="HH:mm" aria-haspopup="dialog" aria-expanded={open}
      onClick={()=>{setDraft(value);setOpen(true)}} onKeyDown={e=>{if(['Enter',' ','ArrowDown'].includes(e.key)){e.preventDefault();setDraft(value);setOpen(true)}}} />
    {open && createPortal(<div className="time-picker-backdrop" onClick={e=>{if(e.target===e.currentTarget) close()}}>
      <section className="time-picker" role="dialog" aria-modal="true" aria-labelledby={title} ref={dialog} onKeyDown={e=>{
        if(e.key==='Escape'){e.preventDefault();close()}
        if(e.key==='Tab'){
          const nodes=[...dialog.current.querySelectorAll('button,input,[tabindex="0"]')].filter(node=>!node.disabled), first=nodes[0], last=nodes[nodes.length-1]
          if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus()}
          else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus()}
        }
      }}>
        <h3 id={title}>시간 선택</h3>
        <div className="time-wheels"><Wheel label="시" max={23} value={parts[0]} onChange={h=>setDraft(old=>formatTime(h,(parseTime(old)||[0,0])[1]))}/><span>:</span><Wheel label="분" max={59} value={parts[1]} onChange={m=>setDraft(old=>formatTime((parseTime(old)||[0,0])[0],m))}/></div>
        <label>직접 입력 (HH:mm)<input aria-label="시간 직접 입력" value={draft} placeholder="00:00" maxLength={5} onChange={e=>setDraft(e.target.value)} /></label>
        <div className="actions"><button type="button" onClick={close}>취소</button><button type="button" disabled={!parseTime(draft)} onClick={()=>{onChange?.({target:{name,value:draft}});close()}}>확인</button></div>
      </section>
    </div>,document.body)}
  </>
}
