import { conditionFields } from './conditionModel.js'
import { seoulParts } from './dates.js'

export function intervalLabel(row) {
  const a = seoulParts(row.started_at), b = seoulParts(row.ended_at)
  return a.date + ' ' + a.time + ' – ' + (a.date === b.date ? '' : b.date + ' ') + b.time
}
export function serializeIntervals(rows = []) {
  return rows.map(row => ({ ...row, ...Object.fromEntries(Object.keys(conditionFields).map(key => {
    const value = row[key] == null || row[key] === '' ? null : Number(row[key])
    const spec = conditionFields[key]
    if (value != null && (!Number.isFinite(value) || value < spec.min || value > spec.max)) throw new Error(spec.label + ' 범위를 확인해 주세요.')
    return [key,value]
  })) }))
}
