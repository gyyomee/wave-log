import { useEffect, useRef, useState } from 'react'
import { getConditions } from '../services/sessionConditions'
import { listMarine } from '../services/marineSamples'
import { fetchConditionSnapshot } from '../services/conditionApi'
import { contextKey, initialIntent, mergePrefill } from './conditionModel'
import { ratings } from './dates'
import { forecastRange, forecastRequest, forecastState } from './forecast'
import { sessionValues } from './conditionPersistence'

export function useConditions(session, spot, start, end) {
  const [state, setState] = useState({ api_values: {}, manual_fields: [], wetsuit: '' })
  const [intent, setIntent] = useState(() => initialIntent(session, Object.keys(ratings)))
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [originalWetsuit,setOriginalWetsuit]=useState(null)
  const [retry, setRetry] = useState(0)
  const [loadRetry, setLoadRetry] = useState(0)
  const marine = useRef([])
  const ctx = contextKey(spot, start, end)
  const ranges = forecastRange(start, end)
  const request = forecastRequest(start,end,spot)
  const rangeKey = ranges.map(r => r.id).join(',')
  useEffect(() => {
    let active = true
    setLoadError(''); setReady(false)
    async function load() {
      try {
        const saved = session ? await getConditions(session.id) : null
        if (!active) return
        if (saved) {
          setState(saved)
          setOriginalWetsuit(saved.wetsuit)
          setIntent({ ...initialIntent(session, Object.keys(ratings)), ...saved.rating_intent })
        }
        if (session) {
          try { marine.current = await listMarine(session.id) } catch { /* Prefill can fetch without stored samples. */ }
        }
        if (active) setReady(true)
      } catch(e) { if (active) setLoadError('기존 환경값을 불러오지 못했습니다: ' + e.message) }
    }
    load()
    return () => { active = false }
  }, [session?.id, loadRetry])
  useEffect(() => {
    if (ready) setState(old => forecastState(old, ranges, ctx))
  }, [rangeKey, ready, ctx])
  useEffect(() => {
    if (!ready || !ctx || !request) { setLoading(false); return }
    let active = true
    setLoading(true); setMessage('')
    const timer = setTimeout(async () => {
      try {
        const response = await fetchConditionSnapshot({ id: session?.id || 'draft', started_at: request.started_at, ended_at: request.ended_at }, spot, { savedMarine: marine.current })
        if (!active) return
        const hourly = response.hourly || []
        setState(old => {
          const next = forecastState({ ...old, condition_hourly: [...(old.condition_hourly || []), ...hourly] }, ranges, ctx)
          return mergePrefill(next, sessionValues(hourly,start,end), ctx)
        })
        setMessage(response.errors.length ? response.errors.join(' / ') : Object.values(response.values).some(v => v.value !== null) ? '자동 환경값을 가져왔습니다.' : '해당 시간의 환경 데이터가 없습니다.')
      } catch(e) { if (active) setMessage('자동 조회 실패: ' + e.message) }
      finally { if (active) setLoading(false) }
    }, 600)
    return () => { active = false; clearTimeout(timer) }
  }, [ctx, ready, retry])
  return { state: forecastState(state,ranges,ctx), setState, ranges, start, end, intent, setIntent, ready, loadError, message, loading, originalWetsuit, ctx, retry: () => setRetry(n => n+1), reload: () => setLoadRetry(n => n+1) }
}
