import { useEffect, useState } from 'react'
const pages=new Set(['journal','account','statistics','preferences','equipment','add','edit','detail'])
export function journalRoute(value) {
  if(!pages.has(value?.page) || ['edit','detail'].includes(value.page) && typeof value.sessionId!=='string') return {page:'journal'}
  return {page:value.page,...(value.sessionId ? {sessionId:value.sessionId} : {})}
}
export function useJournalRoute() {
  const [route,setRoute]=useState(()=>typeof window==='undefined' ? {page:'journal'} : journalRoute(window.history.state?.waveLogRoute))
  useEffect(()=>{
    window.history.replaceState({...window.history.state,waveLogRoute:route},'',window.location.href)
    const pop=e=>setRoute(journalRoute(e.state?.waveLogRoute))
    window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop)
  },[])
  function navigate(value,{replace=false}={}) {
    const next=journalRoute(value)
    if(JSON.stringify(next)===JSON.stringify(route)) return
    window.history[replace ? 'replaceState' : 'pushState']({...window.history.state,waveLogRoute:next},'',window.location.href);setRoute(next)
  }
  return [route,navigate]
}
