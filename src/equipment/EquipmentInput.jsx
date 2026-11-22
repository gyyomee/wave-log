import { useEffect, useId, useRef, useState } from 'react'
import { equipmentOptions } from './equipmentModel'

export default function EquipmentInput({label,type,items,value,onChange,disabled=false}) {
  const id=useId(),root=useRef(null),input=useRef(null),touchingOptions=useRef(false),[open,setOpen]=useState(false),[filter,setFilter]=useState(''),[active,setActive]=useState(-1),[above,setAbove]=useState(false)
  const options=equipmentOptions(items,type,filter)
  function show() {setFilter('');setActive(-1);setOpen(true)}
  useEffect(()=>{
    if(!open) return
    const position=()=>{const r=root.current.getBoundingClientRect(),v=window.visualViewport;setAbove(r.bottom>(v ? v.height+v.offsetTop : window.innerHeight)-180 && r.top>180)}
    position();window.visualViewport?.addEventListener('resize',position);window.addEventListener('resize',position)
    return()=>{window.visualViewport?.removeEventListener('resize',position);window.removeEventListener('resize',position)}
  },[open])
  useEffect(()=>{
    function outside(e) {if(!root.current?.contains(e.target)) setOpen(false)}
    document.addEventListener('pointerdown',outside)
    return()=>document.removeEventListener('pointerdown',outside)
  },[])
  function choose(item) {onChange(item.name);input.current?.focus();setOpen(false);setActive(-1)}
  function keyDown(e) {
    if(e.key==='Escape') {setOpen(false);return}
    if(e.key==='Tab') {setOpen(false);return}
    if(e.key==='ArrowDown' || e.key==='ArrowUp') {
      e.preventDefault();if(!open){show();return}
      const next=e.key==='ArrowDown' ? Math.min(active+1,options.length-1) : Math.max(active-1,0)
      setActive(next);root.current?.querySelector('[data-index="'+next+'"]')?.scrollIntoView({block:'nearest'});return
    }
    if(e.key==='Enter' && open && options[active]) {e.preventDefault();choose(options[active])}
  }
  return <div ref={root} className="equipment-input" onBlur={e=>{if(!touchingOptions.current && !e.currentTarget.contains(e.relatedTarget)) setOpen(false)}}>
    <label htmlFor={id}>{label}</label><div className="equipment-input-row"><input id={id} ref={input} role="combobox" aria-expanded={open} aria-controls={id+'-options'} aria-autocomplete="list" aria-activedescendant={open && options[active] ? id+'-'+options[active].id : undefined} autoComplete="off" maxLength={200} disabled={disabled} value={value || ''} onFocus={show} onKeyDown={keyDown} onChange={e=>{onChange(e.target.value);setFilter(e.target.value);setOpen(true);setActive(-1)}}/><button type="button" aria-label={label+' 목록 열기'} aria-expanded={open} aria-controls={id+'-options'} disabled={disabled} onClick={()=>{if(open){setOpen(false)}else{input.current?.focus();show()}}}>⌄</button></div>
    {open && <div className={'equipment-popover'+(above ? ' above' : '')}><ul id={id+'-options'} role="listbox" aria-label={label+' 선택'} onPointerDown={()=>{touchingOptions.current=true}} onPointerUp={()=>{touchingOptions.current=false}} onPointerCancel={()=>{touchingOptions.current=false}}>{options.map((item,i)=><li id={id+'-'+item.id} key={item.id} role="option" data-index={i} aria-selected={active===i} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item)}>{item.name}</li>)}</ul>{!options.length && <p>등록된 장비가 없습니다. 새 이름을 입력할 수 있습니다.</p>}</div>}
  </div>
}
