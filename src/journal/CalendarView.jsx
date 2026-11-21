import { monthDays, seoulParts } from './dates'
import { calendarConditions, formatSaved } from './savedConditions'

export function WaveSummary({ session }) {
  const row=calendarConditions(session)
  return <span className="wave-summary"><span>파고 {formatSaved(row.values.wave_height,'m')}</span><span>주기 {formatSaved(row.values.wave_period,'s')}</span>{row.multiple && <small>{row.label} 외</small>}</span>
}
export default function CalendarView({ month, sessions, date, today, onDateChange }) {
  const days=new Map()
  for(const session of sessions) {
    const key=seoulParts(session.started_at).date
    if(!days.has(key)) days.set(key,[])
    days.get(key).push(session)
  }
  return <div className="calendar-scroll" tabIndex={0} role="region" aria-label="월별 서핑 기록"><div className="calendar">
    {['일','월','화','수','목','금','토'].map(day=><span className="weekday" key={day}>{day}</span>)}
    {monthDays(month).map((day,i)=>{
      if(!day) return <span key={'blank'+i} />
      const entries=(days.get(day) || []).slice().sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at))
      return <button key={day} className={entries.length ? 'has-sessions' : ''} aria-pressed={date===day} aria-label={day+', 기록 '+entries.length+'개'} aria-current={day===today ? 'date' : undefined} onClick={()=>onDateChange(day)}>
        <span className="calendar-day">{Number(day.slice(-2))}</span>
        <span className={'calendar-dot'+(entries.length?' registered':'')} aria-hidden="true" />
      </button>
    })}
  </div></div>
}
