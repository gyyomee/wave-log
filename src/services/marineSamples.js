import { authenticatedClient, execute, result } from './dataAccess.js'
import { fetchMarine } from './marineApi.js'
import { relevantMarine } from './relevantMarine.js'
import { forecastRequest } from '../journal/forecast.js'

export function listMarine(sessionId) {
  return execute(async () => {
    const { client } = await authenticatedClient()
    return result(client.from('surf_session_marine_samples').select('*').eq('session_id', sessionId).order('sampled_at'))
  })
}
const pending = new Map()
export function retrieveMarine(session, spot, refresh = false) {
  const key = session.id
  if (pending.has(key)) return pending.get(key)
  const task = execute(async () => {
    const { client } = await authenticatedClient()
    const existing = relevantMarine(await listMarine(session.id),session,spot)
    if (existing.length && !refresh) return existing
    const request=forecastRequest(session.started_at,session.ended_at,spot)
    const samples = request ? await fetchMarine({...session,started_at:request.started_at,ended_at:request.ended_at}, spot) : []
    // A failed/empty refresh must never remove an existing snapshot.
    if (!samples.length) {
      if (refresh && existing.length) throw new Error('파도 데이터 없음: 기존 스냅샷을 유지했습니다.')
      return existing
    }
    if (refresh) {
      await result(client.rpc('replace_session_marine', { target_session: session.id, samples }))
    } else {
      await result(client.from('surf_session_marine_samples').upsert(samples, { onConflict: 'session_id,sampled_at', ignoreDuplicates: true }))
    }
    return relevantMarine(await listMarine(session.id),session,spot)
  }).finally(() => pending.delete(key))
  pending.set(key, task)
  return task
}
