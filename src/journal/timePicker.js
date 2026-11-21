export function parseTime(value) {
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(value || '')) return null
  return value.split(':').map(Number)
}
export function formatTime(hour,minute) {
  return [hour,minute].map(value=>String(value).padStart(2,'0')).join(':')
}
export function wheelKey(value,key,max) {
  if (key==='Home') return 0
  if (key==='End') return max
  const delta={ArrowUp:-1,ArrowDown:1,PageUp:-5,PageDown:5}[key]
  return delta == null ? value : Math.max(0,Math.min(max,value+delta))
}
