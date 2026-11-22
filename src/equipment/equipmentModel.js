import { nameKey, cleanName } from '../journal/suggestions.js'
export function equipmentOptions(items,type,query='') {
  const key=nameKey(query)
  return items.filter(item=>item.is_active && item.equipment_type===type && (!key || nameKey(item.name).includes(key)))
    .sort((a,b)=>Number(nameKey(b.name)===key)-Number(nameKey(a.name)===key) || a.name.localeCompare(b.name,'ko'))
}
export function journalEquipmentName(value,original,items,type) {
  if(original!=null && value===original) return original
  return equipmentOptions(items,type).find(item=>nameKey(item.name)===nameKey(value))?.name || cleanName(value) || null
}
