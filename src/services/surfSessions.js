import { authenticatedClient, execute, pickFields, result, timestamp, DataAccessError } from './dataAccess.js'

const fields = ['spot_id', 'started_at', 'ended_at', 'board_name', 'board_length_ft', 'overall_rating', 'wave_rating', 'performance_rating', 'crowd_level', 'notes']
const withSpot = '*, spot:surf_spots!surf_sessions_owned_spot_fkey(*)'

function values(input) {
  const record = pickFields(input, fields)
  for (const key of ['started_at', 'ended_at']) {
    if (key in record) record[key] = timestamp(record[key])
  }
  return record
}

export function listSessions({ from, to, includeSpot = true, limit = 100, offset = 0 } = {}) {
  return execute(async () => {
    const start = from === undefined ? null : timestamp(from)
    const end = to === undefined ? null : timestamp(to)
    if (start && end && start >= end) throw new DataAccessError('from must precede to.', 'INVALID_INPUT')
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000 || !Number.isInteger(offset) || offset < 0) {
      throw new DataAccessError('Invalid pagination.', 'INVALID_INPUT')
    }
    const { client, userId } = await authenticatedClient()
    let query = client.from('surf_sessions').select(includeSpot ? withSpot : '*')
      .eq('user_id', userId).order('started_at', { ascending: false }).order('id', { ascending: false })
    if (start) query = query.gte('started_at', start)
    if (end) query = query.lt('started_at', end)
    return result(query.range(offset, offset + limit - 1))
  })
}

export function getSession(id, { includeSpot = true } = {}) {
  return execute(async () => {
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_sessions').select(includeSpot ? withSpot : '*').eq('id', id).eq('user_id', userId).single())
  })
}

export function createSession(input) {
  return execute(async () => {
    const record = values(input)
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_sessions').insert({ ...record, user_id: userId }).select(withSpot).single())
  })
}

export function updateSession(id, input) {
  return execute(async () => {
    const record = values(input)
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_sessions').update(record).eq('id', id).eq('user_id', userId).select(withSpot).single())
  })
}

export function deleteSession(id) {
  return execute(async () => {
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_sessions').delete().eq('id', id).eq('user_id', userId).select('id').single())
  })
}
