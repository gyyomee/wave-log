import { cleanName } from './suggestions.js'
export const tideLabels = [...Array.from({ length: 14 }, (_,i) => (i+1) + '물'), '조금', '무시']
export const tideConventions = { '': '미지정', '7': '7물때', '8': '8물때', custom: '지역별 기타 기준' }
export function serializeTides(events = []) {
  return events.map(event => {
    if (!['high','low'].includes(event.type)) throw new Error('만조 또는 간조를 선택해 주세요.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) throw new Error('조석 날짜와 24시간 시각을 입력해 주세요.')
    const at = new Date(event.date + 'T' + event.time + ':00+09:00')
    if (!Number.isFinite(at.getTime()) || new Date(at.getTime() + 9 * 3600000).toISOString().slice(0,10) !== event.date) throw new Error('조석 날짜를 확인해 주세요.')
    const height_cm = event.height_cm === '' || event.height_cm == null ? null : Number(event.height_cm)
    if (height_cm != null && (!Number.isFinite(height_cm) || Math.abs(height_cm) > 5000)) throw new Error('조위는 -5000~5000cm 범위로 입력해 주세요.')
    return { ...event, occurred_at: at.toISOString(), height_cm, timezone: 'Asia/Seoul', source: event.source || 'manual', station_name: cleanName(event.station_name) || null }
  })
}
export function tideCycle(label, convention) {
  if (!(convention in tideConventions)) throw new Error('물때 기준을 확인해 주세요.')
  return { tide_cycle_label: cleanName(label) || null, tide_convention: convention || null }
}
