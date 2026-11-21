import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { listSpots } from '../services/surfSpots'
import { listSessions, deleteSession } from '../services/surfSessions'
import SessionForm from './SessionForm'
import MarineConditions from './MarineConditions'
import ConditionsDetail from './ConditionsDetail'
import { boardNames, nameKey, cleanName } from './suggestions'
import { monthDays, ratings, seoulParts, shiftMonth } from './dates'

function Rows({ sessions, open }) {
  return sessions.length ? <ul className="session-list">{sessions.map(s => <li key={s.id}><button onClick={() => open(s)}>
    <span>{seoulParts(s.started_at).date}<small>{seoulParts(s.started_at).time} ~ {seoulParts(s.ended_at).time}</small></span>
    <strong>{s.spot?.name || '스팟'}<small>{cleanName(s.board_name) || '보드 미입력'}</small></strong><span>파도 {s.wave_rating ? s.wave_rating + '/5' : '미평가'} <span aria-hidden="true">→</span></span>
  </button></li>)}</ul> : <p className="empty">아직 서핑 기록이 없습니다.</p>
}

export default function Journal() {
  const { user, signOut } = useAuth()
  const today = seoulParts(new Date()).date
  const [view, setView] = useState(() => { try { return localStorage.getItem('wave-log-view') === 'list' ? 'list' : 'calendar' } catch { return 'calendar' } })
  const [page, setPage] = useState('journal')
  const [month, setMonth] = useState(today.slice(0,7))
  const [date, setDate] = useState(today)
  const [filter, setFilter] = useState('')
  const [boardFilter, setBoardFilter] = useState('')
  const [sort, setSort] = useState('date')
  const [spots, setSpots] = useState([])
  const [sessions, setSessions] = useState([])
  const [selected, setSelected] = useState(null)
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
          const batch = await listSessions({ limit: 100, offset })
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
  function navigate(next) { setPage(next); setSelected(null); setError('') }
  function open(s) { setSelected(s); setPage('detail'); setError('') }
  function saved(s) {
    setSessions(old => [s, ...old.filter(x => x.id !== s.id)].sort((a,b) => Date.parse(b.started_at) - Date.parse(a.started_at)))
    setDate(seoulParts(s.started_at).date); setMonth(seoulParts(s.started_at).date.slice(0,7))
    setSelected(s); setPage('detail'); setError('')
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
    <nav className="journal-nav" aria-label="메인 메뉴">{[['journal','저널'],['add','기록 추가'],['account','내 계정']].map(([key,label]) => <button key={key} disabled={busy} aria-current={page === key ? 'page' : undefined} onClick={() => navigate(key)}>{label}</button>)}</nav>
    <main className="journal-content">
      {loadError && page !== 'account' && <div className="form-message error" role="alert">{loadError}<button onClick={() => setRevision(x => x + 1)}>다시 불러오기</button></div>}
      {error && <div className="form-message error" role="alert">{error}{page === 'journal' && <button onClick={() => setRevision(x => x + 1)}>다시 불러오기</button>}</div>}
      {page === 'account' ? <section><h2>내 계정</h2><p className="nickname">{nickname}</p><button disabled={busy} onClick={logout}>{busy ? '로그아웃 중...' : '로그아웃'}</button></section> :
      page === 'add' || page === 'edit' ? loading ? <p role="status">스팟 불러오는 중...</p> : <SessionForm key={selected?.id || 'new'} session={page === 'edit' ? selected : null} spots={spots} boards={boards} initialDate={date} onSpot={s => setSpots(old => [...old.filter(x => x.id !== s.id),s])} onSaved={saved} onCancel={() => navigate('journal')} /> :
      page === 'detail' && selected ? <section>
        <div className="toolbar"><h2>{selected.spot?.name || '서핑 기록'}</h2><button onClick={() => navigate('journal')}>목록으로</button></div>
        <dl className="details"><dt>시작</dt><dd>{seoulParts(selected.started_at).date} {seoulParts(selected.started_at).time}</dd><dt>종료</dt><dd>{seoulParts(selected.ended_at).date} {seoulParts(selected.ended_at).time}</dd><dt>보드</dt><dd>{selected.board_name || '미입력'}</dd>{Object.entries(ratings).map(([k,label]) => <div className="detail-pair" key={k}><dt>{label}</dt><dd>{selected[k] ? selected[k] + '/5' : '미평가'}</dd></div>)}</dl>
        <p className="notes">{selected.notes || '메모가 없습니다.'}</p><div className="actions"><button disabled={busy} onClick={() => setPage('edit')}>수정</button><button className="danger" disabled={busy} onClick={remove}>{busy ? '삭제 중...' : '삭제'}</button></div>
        <ConditionsDetail key={'conditions-' + selected.id + selected.updated_at} sessionId={selected.id} startedAt={selected.started_at} endedAt={selected.ended_at} spot={selected.spot} />
        <MarineConditions key={selected.id + selected.updated_at} session={selected} onSpot={spot => { setSpots(old => old.map(s => s.id === spot.id ? spot : s)); setSessions(old => old.map(s => s.spot_id === spot.id ? { ...s, spot } : s)) }} />
      </section> :
      <section><div className="toolbar"><h2>서핑 저널</h2><div className="segments" aria-label="보기">{[['calendar','캘린더'],['list','목록']].map(([key,label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div></div>
        <label className="spot-filter">스팟<select value={filter} onChange={e => setFilter(e.target.value)}><option value="">전체 스팟</option>{spots.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        {view === 'list' && <div className="board-filters"><label>서핑보드<select value={boardFilter} onChange={e => setBoardFilter(e.target.value)}><option value="">전체</option>{boards.map(b => <option key={nameKey(b)} value={nameKey(b)}>{b}</option>)}</select></label><label>정렬<select value={sort} onChange={e => setSort(e.target.value)}><option value="date">최신순</option><option value="board">서핑보드순</option></select></label></div>}
        {loading ? <p role="status">기록 불러오는 중...</p> : loadError ? null : view === 'list' ? <Rows sessions={listed} open={open} /> : <>
          <div className="toolbar month-nav"><button title="이전 달" aria-label="이전 달" onClick={() => move(-1)}>←</button><h3>{month.replace('-', '년 ')}월</h3><button title="다음 달" aria-label="다음 달" onClick={() => move(1)}>→</button></div>
          <div className="calendar">{['일','월','화','수','목','금','토'].map(d => <span className="weekday" key={d}>{d}</span>)}{monthDays(month).map((d,i) => {
            const count = d ? visible.filter(s => seoulParts(s.started_at).date === d).length : 0
            return d ? <button key={d} className={count ? 'has-sessions' : ''} aria-pressed={date === d} aria-label={d + ', 기록 ' + count + '개'} aria-current={d === today ? 'date' : undefined} onClick={() => setDate(d)}><span>{Number(d.slice(-2))}</span><small>{count ? count + '회' : ''}</small></button> : <span key={'blank'+i} />
          })}</div>
          {!visible.some(s => seoulParts(s.started_at).date.startsWith(month)) && <p className="empty">이번 달의 첫 서핑을 기록해 보세요.</p>}
          <div className="toolbar"><h3>{date}</h3><button onClick={() => navigate('add')}>기록 추가</button></div><Rows sessions={daily} open={open} />
        </>}
      </section>}
    </main>
  </div>
}
