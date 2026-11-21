export function seoulParts(value) {
  const shifted = new Date(new Date(value).getTime() + 9 * 3600000).toISOString()
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) }
}
export function monthDays(month) {
  const [year, number] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, number - 1, 1))
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate()
  return [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: count }, (_, i) => month + '-' + String(i + 1).padStart(2, '0'))]
}
export function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + delta, 1)).toISOString().slice(0, 7)
}
export const ratings = { overall_rating: '전체 만족도', wave_rating: '파도', crowd_level: '혼잡도' }
