import { authenticatedClient, execute, result } from './dataAccess.js'
import { conditionFields } from '../journal/conditionModel.js'
import { cleanName } from '../journal/suggestions.js'
import { serializeIntervals } from '../journal/intervals.js'
import { serializeTides, tideCycle } from '../journal/tides.js'
import { forecastRange, forecastState } from '../journal/forecast.js'

export function getConditions(id) {
  return execute(async () => {
    const { client } = await authenticatedClient()
    return result(client.from('surf_session_conditions').select('*').eq('session_id', id).maybeSingle())
  })
}
export function listWetsuits() {
  return execute(async () => {
    const { client } = await authenticatedClient()
    return result(client.from('surf_session_conditions').select('wetsuit').not('wetsuit', 'is', null).limit(1000))
  })
}
export function saveConditions(id, state, intent) {
  return execute(async () => {
    let ranges=[]
    try { const context=JSON.parse(state.context); ranges=forecastRange(context[2],context[3]) } catch { /* No location means no automatic source data. */ }
    state=forecastState(state,ranges,state.context || '')
    const { client } = await authenticatedClient()
    const fields = Object.fromEntries(Object.keys(conditionFields).map(k => [k, state[k] === '' || state[k] == null ? null : Number(state[k])]))
    return result(client.from('surf_session_conditions').upsert({
      session_id: id, ...fields, wetsuit: cleanName(state.wetsuit) || null,
      api_values: state.api_values || {}, manual_fields: state.manual_fields || [], manual_origins: state.manual_origins || {},
      rating_intent: intent, context: state.context || '',
      condition_intervals: serializeIntervals(state.condition_intervals),
      condition_hourly: state.condition_hourly || [],
      tide_events: serializeTides(state.tide_events),
      ...tideCycle(state.tide_cycle_label, state.tide_convention || ''),
    }, { onConflict: 'session_id' }).select().single())
  })
}
