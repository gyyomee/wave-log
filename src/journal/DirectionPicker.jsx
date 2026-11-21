import { useId, useRef, useState, useEffect } from 'react'
import { directions, directionLabel, travelRotation } from './directions'
export function DirectionValue({value}) {
  return <>{directionLabel(value)}{value!=null && value!=='' && <> <span className="direction-arrow" aria-hidden="true" style={{transform:'rotate('+travelRotation(value)+'deg)'}}>↑</span> {value}°</>}</>
}
export default function DirectionPicker({label,value,onChange}) {
  const [open,setOpen]=useState(false),[active,setActive]=useState(0)
  const root=useRef(null),list=useRef(null),trigger=useRef(null),drag=useRef(null),moved=useRef(false),id=useId()
  const options=[{value:null,label:'미입력'},...(value!=null && value!=='' && !directions.some(d=>d.value===Number(value)) ? [{value:Number(value),label:directionLabel(value)}] : []),...directions]
  useEffect(()=>{if(open){list.current?.focus();document.getElementById(id+'-'+active)?.scrollIntoView({block:'nearest'})}},[open,active,id])
  useEffect(()=>{const close=e=>{if(!root.current?.contains(e.target))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[])
  function choose(index){onChange(options[index].value);setOpen(false);trigger.current?.focus()}
  return <div className="direction-picker" ref={root}>
    <button type="button" ref={trigger} aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} onClick={()=>{setActive(Math.max(0,options.findIndex(d=>d.value==value)));setOpen(!open)}}><DirectionValue value={value}/></button>
    {open && <div id={id} ref={list} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={id+'-'+active} className="direction-options"
      onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus()}else if(e.key==='Tab')setOpen(false);else if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(active)}else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();setActive(i=>e.key==='Home'?0:e.key==='End'?options.length-1:Math.max(0,Math.min(options.length-1,i+(e.key==='ArrowDown'?1:-1))))}}}
      onPointerDown={e=>{moved.current=false;if(e.pointerType==='mouse')drag.current={y:e.clientY,top:e.currentTarget.scrollTop}}}
      onPointerMove={e=>{if(drag.current && e.buttons){const delta=e.clientY-drag.current.y;if(Math.abs(delta)>5)moved.current=true;e.currentTarget.scrollTop=drag.current.top-delta}}}
      onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}} onPointerLeave={()=>{drag.current=null}}>
      {options.map((option,index)=><div key={String(option.value)} id={id+'-'+index} role="option" aria-selected={index===active} onClick={()=>{if(!moved.current)choose(index)}}><DirectionValue value={option.value}/></div>)}
    </div>}
  </div>
}
