// Browser-only fixtures. No Supabase reads/writes or weather requests.
import React, { useEffect, useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { PreferencesContext } from '../../src/preferences/PreferencesContext'
import { createPreferenceStore } from '../../src/preferences/preferenceStore'
import MyPage, { PreferencesPage } from '../../src/preferences/MyPage'
import ConditionsEditor from '../../src/journal/ConditionsEditor'
import ConditionsDetail from '../../src/journal/ConditionsDetail'
import Statistics from '../../src/journal/Statistics.jsx'
import { forecastRange, forecastState } from '../../src/journal/forecast'
import { editTimestamp, timestampValues } from '../../src/journal/timestampEdits'
import { fromKnots } from '../../src/lib/windUnits'
import '../../src/styles.css'
import '../../src/journal/journal.css'

const preferences=new Map(),start='2026-11-01T00:00:00Z',end='2026-11-01T06:00:00Z',ctx=JSON.stringify([37,129,start,end]),ranges=forecastRange(start,end)
function Fixture({account}) {
  const [store]=useState(()=>createPreferenceStore({load:async()=>preferences.get(account) || null,save:async unit=>{const row={wind_speed_unit:unit};preferences.set(account,row);return row}}))
  const pref=useSyncExternalStore(store.subscribe,store.getSnapshot)
  const [page,setPage]=useState('account')
  const [state,setState]=useState(()=>{
    const initial=forecastState({context:ctx,condition_hourly:[{fields:['wind_speed'],metadata:{context:ctx,wind_speed_unit:'m/s'},rows:ranges.map(r=>({sampled_at:r.forecast_at,wind_speed:4}))}]},ranges,ctx)
    return editTimestamp(initial,initial._forecast[0],'wind_speed',fromKnots(10),ctx)
  })
  useEffect(()=>{store.load();return store.cancel},[store])
  const session={id:'fixture',spot_id:'fixture',spot:{name:'Fixture spot'},started_at:start,ended_at:end,conditions:state}
  return <PreferencesContext.Provider value={{...pref,change:store.change,retry:store.load}}><div className="journal-shell">
    <h1>Wind unit test: {account}</h1><button onClick={()=>store.load()}>설정 재조회</button><button onClick={()=>setPage('account')}>마이페이지</button><button onClick={()=>setPage('editor')}>편집 테스트</button>
    <main className="journal-content">
      {page==='account' ? <MyPage nickname={account} onStatistics={()=>setPage('stats')} onSettings={()=>setPage('settings')} onLogout={()=>setPage('account')}/> : page==='settings' ? <PreferencesPage/> : page==='stats' ? <Statistics sessions={[session]} spots={[]} onOpen={()=>{}}/> : <><output aria-label="canonical m/s">{timestampValues(state,state._forecast[0]).wind_speed}</output><div className="journal-form"><ConditionsEditor data={{state,setState,ranges,start,end,ctx,retry(){}}}/></div><ConditionsDetail session={session}/></>}
    </main>
  </div></PreferencesContext.Provider>
}
function App() {
  const [account,setAccount]=useState('A')
  return <><label>Test account<select value={account} onChange={e=>setAccount(e.target.value)}><option>A</option><option>B</option></select></label><Fixture key={account} account={account}/></>
}
createRoot(document.getElementById('root')).render(<App/> )
