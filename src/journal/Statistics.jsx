import { useMemo, useState } from 'react'
import { journalStatistics } from './statisticsModel'
import { formatWind } from '../lib/windUnits'
import { usePreferences } from '../preferences/PreferencesContext'

const format=value=>value==null ? '-' : new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(value)
function SummaryTable({title,rows}) {
  return <section className="statistics-section"><h3>{title}</h3><div className="saved-wave-scroll" tabIndex={0} role="region" aria-label={title}><table className="saved-wave-table statistics-table"><thead><tr><th scope="col">{title}</th><th scope="col">기록 수</th><th scope="col">시간</th><th scope="col">평균 만족도</th><th scope="col">평균 파도 평점</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><th scope="row">{row.label}</th><td>{row.count}</td><td>{format(row.hours)}h</td><td>{format(row.overall)}</td><td>{format(row.wave)}</td></tr>)}</tbody></table></div></section>
}
export default function Statistics({sessions,spots,loading,error}) {
  const {unit}=usePreferences()
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[spotId,setSpotId]=useState('')
  const data=useMemo(()=>journalStatistics(sessions,{from,to,spotId}),[sessions,from,to,spotId])
  return <section><h2>서핑 통계</h2>
    <div className="statistics-filters"><label>시작일<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>종료일<input type="date" value={to} min={from || undefined} onChange={e=>setTo(e.target.value)}/></label><label>스팟<select value={spotId} onChange={e=>setSpotId(e.target.value)}><option value="">전체 스팟</option>{spots.map(spot=><option value={spot.id} key={spot.id}>{spot.name}</option>)}</select></label></div>
    {loading ? <p role="status">통계 불러오는 중...</p> : error ? <p role="alert">기록을 모두 불러온 뒤 통계를 확인할 수 있습니다.</p> : from && to && from>to ? <p role="alert">종료일은 시작일 이후여야 합니다.</p> : !data.count ? <p className="empty">선택한 기간에 서핑 기록이 없습니다.</p> : <>
      <dl className="statistics-summary">{[['기록 수',data.count+'회'],['서핑한 날',data.days+'일'],['서핑 시간',format(data.hours)+'h'],['평균 만족도',format(data.overall)],['평균 파도 평점',format(data.wave)],['평균 혼잡도',format(data.crowd)],['평균 풍속',formatWind(data.windMs,unit)],['풍속 집계',data.windCount+'개 기록']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      {data.windExcluded>0 && <p role="status">풍속 단위 확인이 필요한 {data.windExcluded}개 기록은 풍속 평균에서 제외했습니다.</p>}
      <SummaryTable title="월별" rows={data.months}/><SummaryTable title="스팟별" rows={data.spots}/><SummaryTable title="서핑보드별" rows={data.boards}/>
    </>}
  </section>
}
