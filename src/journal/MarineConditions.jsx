import { useEffect, useState } from 'react'
import { coordinates } from '../services/marineApi'
import { listMarine, retrieveMarine } from '../services/marineSamples'
import { updateSpot } from '../services/surfSpots'
import { seoulParts } from './dates'
import SpotInput from './SpotInput'
import { relevantMarine } from '../services/relevantMarine'

export default function MarineConditions({ session, onSpot }) {
  const [spot, setSpot] = useState(session.spot)
  const [query, setQuery] = useState(session.spot?.name || '')
  const [samples, setSamples] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  useEffect(() => {
    let active = true
    setBusy(true)
    async function load() {
      try {
        const saved = relevantMarine(await listMarine(session.id),session,spot)
        if (!active) return
        if (saved.length) { setSamples(saved); return }
        try { coordinates(spot) } catch { setStatus('파도 정보를 가져오려면 스팟 좌표가 필요합니다.'); return }
        const rows = await retrieveMarine(session, spot)
        if (active) { setSamples(rows); setStatus(rows.length ? '' : '파도 데이터 없음') }
      } catch(e) { if (active) setError('파도 정보 조회 실패: ' + e.message) }
      finally { if (active) setBusy(false) }
    }
    load()
    return () => { active = false }
  }, [session.id,session.started_at,session.ended_at,session.spot_id])
  async function retrieve(refresh) {
    if (refresh && samples.length && !window.confirm('저장된 파도 스냅샷을 최신 조회 결과로 교체할까요?')) return
    setBusy(true); setError('')
    try {
      coordinates(spot)
      const rows = await retrieveMarine(session, spot, refresh)
      setSamples(rows); setStatus(rows.length ? '' : '파도 데이터 없음')
    } catch(e) { setError('파도 정보 조회 실패: ' + e.message) }
    finally { setBusy(false) }
  }
  async function saveCoordinates(place) {
    if (!place.external || busy) return
    if (!window.confirm(place.name + ' · ' + place.region + '을 이 스팟의 위치로 저장할까요? 기존 파도 스냅샷은 유지됩니다.')) return
    setError(''); setBusy(true)
    try {
      const point = coordinates(place)
      const updated = await updateSpot(session.spot_id, { ...point, region: place.region, country: place.country })
      setSpot(updated); onSpot(updated); setStatus('좌표가 저장되었습니다.')
      if (!samples.length) {
        const rows = await retrieveMarine(session, updated)
        setSamples(rows); setStatus(rows.length ? '' : '파도 데이터 없음')
      }
    } catch(e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const visibleSamples = relevantMarine(samples,session,spot)
  const value = (v,unit) => v == null ? '—' : v + unit
  return <section className="marine-section"><h3>파도 정보</h3>
    {busy && <p role="status">파도 정보 불러오는 중...</p>}
    {status && <p role="status">{status}</p>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    {!!visibleSamples.length && <>
      <p>파고 {value(visibleSamples[0].wave_height, 'm')} · 주기 {value(visibleSamples[0].wave_period, 's')} · 방향 {value(visibleSamples[0].wave_direction, '°')}</p>
      <p>모델 예측값 · 현장 관측값이 아닙니다.</p>
      <div className="marine-table"><table><thead><tr>{['시간','파고 m','주기 s','방향 °','너울 m','너울 s','너울 °','출처'].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{visibleSamples.map(s => <tr key={s.sampled_at}><td>{seoulParts(s.sampled_at).date} {seoulParts(s.sampled_at).time}</td><td>{value(s.wave_height,'')}</td><td>{value(s.wave_period,'')}</td><td>{value(s.wave_direction,'')}</td><td>{value(s.swell_height,'')}</td><td>{value(s.swell_period,'')}</td><td>{value(s.swell_direction,'')}</td><td>{s.data_source_type === 'forecast' ? '예보' : s.data_source_type === 'archived_forecast' ? '과거 예보' : '재분석 모델'}</td></tr>)}</tbody></table></div>
    </>}
    <button type="button" disabled={busy} onClick={() => retrieve(true)}>파도 정보 다시 가져오기</button>
    <details><summary>스팟 위치 검색·연결</summary><fieldset disabled={busy}><SpotInput spots={[]} value={query} onChange={setQuery} onSelect={saveCoordinates} /></fieldset></details>
    <p><a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer">Open-Meteo</a> · Météo-France MFWAM / Copernicus Marine · <a href="https://doi.org/10.48670/moi-00017" target="_blank" rel="noreferrer">데이터 출처</a></p>
  </section>
}
