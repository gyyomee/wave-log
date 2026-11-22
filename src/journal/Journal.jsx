import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { listSpots } from '../services/surfSpots'
import { listSessions, deleteSession } from '../services/surfSessions'
import SessionForm from './SessionForm'
import CalendarView, { WaveSummary } from './CalendarView'
import { getConditions } from '../services/sessionConditions'
import ConditionsDetail from './ConditionsDetail'
import { boardNames, nameKey, cleanName } from './suggestions'
import { ratings, seoulParts, shiftMonth } from './dates'
import Statistics from './Statistics.jsx'
import MyPage, { PreferencesPage } from '../preferences/MyPage'
import EquipmentManager from '../equipment/EquipmentManager'
import { useJournalRoute } from './useJournalRoute'

function Rows({ sessions, open, showConditions = false }) {
  return sessions.length ? <ul className="session-list">{sessions.map(s => <li key={s.id}><button onClick={() => open(s)}>
    <span>{seoulParts(s.started_at).date}<small>{seoulParts(s.started_at).time} ~ {seoulParts(s.ended_at).time}</small></span>
    <strong>{s.spot?.name || '스팟'}<small>{cleanName(s.board_name) || '보드 미입력'}</small></strong><span>{showConditions ? <WaveSummary session={s} /> : <>파도 {s.wave_rating ? s.wave_rating + '/5' : '미평가'}</>} <span aria-hidden="true">→</span></span>
  </button></li>)}</ul> : <p className="empty">아직 서핑 기록이 없습니다.</p>
}

export default function Journal() {
  const { user, signOut } = useAuth()
  const today = seoulParts(new Date()).date
  const [view, setView] = useState(() => { try { return localStorage.getItem('wave-log-view') === 'list' ? 'list' : 'calendar' } catch { return 'calendar' } })
  const [route,setRoute]=useJournalRoute()
  const page=route.page
  const setPage=page=>setRoute({page,sessionId:route.sessionId})
  const [month, setMonth] = useState(today.slice(0,7))
  const [date, setDate] = useState(today)
  const [filter, setFilter] = useState('')
  const [boardFilter, setBoardFilter] = useState('')
  const [sort, setSort] = useState('date')
  const [spots, setSpots] = useState([])
  const [sessions, setSessions] = useState([])
  const selected=sessions.find(s=>s.id===route.sessionId) || null
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => { try { localStorage.setItem('wave-log-view', view) } catch { /* Storage may be blocked. */ } }, [view])
  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    async function load() {
      try {
        const foundSpots = await listSpots()
        const all = []
        for (let offset = 0; ; offset += 100) {
          const batch = await listSessions({ limit: 100, offset, includeConditions: true })
          if (!active) return
          all.push(...batch)
          if (batch.length < 100) break
        }
        if (active) { setSpots(foundSpots); setSessions(all) }
      } catch(e) { if (active) setLoadError('기록을 불러오지 못했습니다: ' + e.message) }
      finally { if (active) setLoading(false) }
    }
    load()
    return () => { active = false }
  }, [revision])
  const nickname = [user.user_metadata?.nickname, user.user_metadata?.preferred_username, user.user_metadata?.name, user.user_metadata?.full_name].find(n => typeof n === 'string' && n.trim()) || '서퍼'
  function navigate(next) { setRoute({page:next}); setError('') }
  function open(s) { setRoute({page:'detail',sessionId:s.id}); setError('') }
  async function saved(s) {
    try { s = { ...s, conditions: await getConditions(s.id) } }
    catch { s = { ...s, conditions: null, conditionsError: true }; setRevision(x=>x+1) }
    setSessions(old => [s, ...old.filter(x => x.id !== s.id)].sort((a,b) => Date.parse(b.started_at) - Date.parse(a.started_at)))
    setDate(seoulParts(s.started_at).date); setMonth(seoulParts(s.started_at).date.slice(0,7))
    setRoute({page:'detail',sessionId:s.id},{replace:true}); setError('')
  }
  async function remove() {
    if (!window.confirm('이 서핑 기록을 삭제할까요? 삭제한 기록은 복구할 수 없습니다.')) return
    setBusy(true); setError('')
    try { await deleteSession(selected.id); setSessions(old => old.filter(s => s.id !== selected.id)); navigate('journal') }
    catch(e) { setError('삭제하지 못했습니다: ' + e.message) }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true); setError('')
    try { await signOut() } catch { setError('로그아웃하지 못했습니다. 다시 시도해 주세요.') } finally { setBusy(false) }
  }
  const visible = sessions.filter(s => !filter || s.spot_id === filter)
  const boards = boardNames(sessions)
  const listed = visible.filter(s => !boardFilter || nameKey(s.board_name) === boardFilter).slice().sort((a,b) => (sort === 'board' ? nameKey(a.board_name).localeCompare(nameKey(b.board_name), 'ko') : 0) || Date.parse(b.started_at) - Date.parse(a.started_at))
  const daily = visible.filter(s => seoulParts(s.started_at).date === date)
  function move(delta) { const next = shiftMonth(month, delta); setMonth(next); setDate(next + '-01') }
  return <div className="journal-shell">
    <header className="journal-header"><h1>Wave Log</h1><span>나의 파도를 기록하다</span></header>
    <nav className="journal-nav" aria-label="메인 메뉴">{[['journal','캘린더'],['account','마이페이지']].map(([key,label]) => <button key={key} disabled={busy} aria-current={(page === key || key==='account' && ['statistics','preferences','equipment'].includes(page)) ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav>
    <main className="journal-content">
      {loadError && !['account','preferences','equipment'].includes(page) && <div className="form-message error" role="alert">{loadError}<button onClick={() => setRevision(x => x + 1)}>다시 불러오기</button></div>}
      {error && <div className="form-message error" role="alert">{error}{page === 'journal' && <button onClick={() => setRevision(x => x + 1)}>다시 불러오기</button>}</div>}
      {page === 'account' ? <MyPage nickname={nickname} busy={busy} onStatistics={()=>navigate('statistics')} onEquipment={()=>navigate('equipment')} onSettings={()=>navigate('preferences')} onLogout={logout}/> :
      page === 'preferences' ? <PreferencesPage/> :
      page === 'equipment' ? <EquipmentManager/> :
      page === 'statistics' ? <Statistics sessions={sessions} spots={spots} loading={loading} error={loadError}/> :
      page === 'add' || page === 'edit' ? loading ? <p role="status">스팟 불러오는 중...</p> : <SessionForm key={selected?.id || 'new'} session={page === 'edit' ? selected : null} spots={spots} boards={boards} initialDate={date} onSpot={s => setSpots(old => [...old.filter(x => x.id !== s.id),s])} onSaved={saved} onCancel={() => navigate('journal')} /> :
      page === 'detail' && selected ? <section>
        <div className="toolbar"><h2>{selected.spot?.name || '서핑 기록'}</h2><div className="actions journal-detail-actions"><button disabled={busy} onClick={() => setPage('edit')}>수정</button><button className="danger" disabled={busy} onClick={remove}>{busy ? '삭제 중...' : '삭제'}</button></div></div>
        <dl className="details"><dt>시작</dt><dd>{seoulParts(selected.started_at).date} {seoulParts(selected.started_at).time}</dd><dt>종료</dt><dd>{seoulParts(selected.ended_at).date} {seoulParts(selected.ended_at).time}</dd><dt>보드</dt><dd>{selected.board_name || '미입력'}</dd>{Object.entries(ratings).map(([k,label]) => <div className="detail-pair" key={k}><dt>{label}</dt><dd>{selected[k] ? selected[k] + '/5' : '미평가'}</dd></div>)}</dl>
        <p className="notes">{selected.notes || '메모가 없습니다.'}</p>
        <ConditionsDetail session={selected} />
      </section> :
      <section><div className="toolbar"><h2>서핑 저널</h2><div className="segments" aria-label="보기">{[['calendar','캘린더'],['list','목록']].map(([key,label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div></div>
        <label className="spot-filter">스팟<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">전체 스팟</option>{spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {view === 'list' && <div className="board-filters"><label>서핑보드<select value={boardFilter} onChange={e => setBoardFilter(e.target.value)}><option value="">전체</option>{boards.map(b => <option key={nameKey(b)} value={nameKey(b)}>{b}</option>)}</select></label><label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="date">최신순</option><option value="board">서핑보드순</option></select></label></div>}
        {loading ? <p role="status">기록 불러오는 중...</p> : loadError ? null : view === 'list' ? <Rows sessions={listed} open={open} /> : <>
          <div className="toolbar month-nav"><button title="이전 달" aria-label="이전 달" onClick={() => move(-1)}>←</button><h3>{month.replace('-', '년 ')}월</h3><button title="다음 달" aria-label="다음 달" onClick={() => move(1)}>→</button></div>
          <CalendarView month={month} sessions={visible} date={date} today={today} onDateChange={setDate} />
          {!visible.some(s => seoulParts(s.started_at).date.startsWith(month)) && <p className="empty">이번 달의 첫 서핑을 기록해 보세요.</p>}
          <div className="toolbar"><h3>{date}</h3><button onClick={() => navigate('add')}>기록 추가</button></div><Rows sessions={daily} open={open} showConditions />
        </>}
      </section>}
    </main>
  </div>
}
