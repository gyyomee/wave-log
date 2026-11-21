export class DataAccessError extends Error {
  constructor(message, code = 'DATA_ERROR', cause) {
    super(message, { cause })
    this.name = 'DataAccessError'
    this.code = code
  }
}

export function pickFields(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new DataAccessError('Expected a record object.', 'INVALID_INPUT')
  }
  const result = {}
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.includes(key)) throw new DataAccessError('Unsupported field: ' + key, 'INVALID_INPUT')
    if (value !== undefined) result[key] = value
  }
  if (!Object.keys(result).length) throw new DataAccessError('No fields supplied.', 'INVALID_INPUT')
  return result
}

export function timestamp(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new DataAccessError('Use an ISO timestamp with Z or an explicit UTC offset.', 'INVALID_INPUT')
  }
  return new Date(value).toISOString()
}

export async function execute(operation) {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof DataAccessError) throw error
    throw new DataAccessError(error.message || 'Data request failed.', error.code || 'DATA_ERROR', error)
  }
}

export async function authenticatedClient() {
  // Lazy loading also lets pure validation tests run without browser configuration.
  const { supabase } = await import('../lib/supabase.js')
  if (!supabase) throw new DataAccessError('Supabase is not configured.', 'NOT_CONFIGURED')
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new DataAccessError('Sign in before accessing records.', 'UNAUTHENTICATED')
  return { client: supabase, userId: data.user.id }
}

export async function result(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}
