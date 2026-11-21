export const cleanName = value => (value || '').normalize('NFC').trim().replace(/\s+/g, ' ')
export const nameKey = value => cleanName(value).toLocaleLowerCase('ko-KR')
export const ratingValue = value => Number(value) === 0 ? null : Number(value)

export async function savePlace(spots, selectedId, place, create, update) {
  const selected = spots.find(s => s.id === selectedId)
  const same = spots.find(s => nameKey(s.name) === nameKey(place.name) && s.latitude != null && s.longitude != null && Number(s.latitude) === place.latitude && Number(s.longitude) === place.longitude)
  if (!selected && same) return { spot: same, created: false }
  const values = { latitude: place.latitude, longitude: place.longitude, region: place.region, country: place.country }
  if (selected) return { spot: await update(selected.id, values), created: false }
  return { spot: await create({ name: cleanName(place.name), ...values }), created: true }
}

// Accepts user-owned records; future providers can supply the same name/region shape.
export function matchSpots(spots, query) {
  const key = nameKey(query)
  const rank = spot => nameKey(spot.name) === key ? 0 : nameKey(spot.name).startsWith(key) ? 1 : 2
  return spots.filter(s => !key || nameKey(s.name).includes(key) || nameKey(s.region).includes(key))
    .sort((a,b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko'))
}
export function boardNames(sessions) {
  const names = new Map()
  for (const s of sessions) if (nameKey(s.board_name) && !names.has(nameKey(s.board_name))) names.set(nameKey(s.board_name), cleanName(s.board_name))
  return [...names.values()].sort((a,b) => a.localeCompare(b, 'ko'))
}
export function canonicalBoard(value, names) {
  return names.find(n => nameKey(n) === nameKey(value)) || cleanName(value) || null
}

export async function resolveSpot(spots, selectedId, name, create) {
  if (selectedId) {
    const selected = spots.find(s => s.id === selectedId)
    if (selected) return { spot: selected, created: false }
    throw new Error('선택한 스팟을 찾을 수 없습니다. 다시 선택해 주세요.')
  }
  const exact = spots.filter(s => nameKey(s.name) === nameKey(name))
  if (exact.length > 1) throw new Error('같은 이름의 스팟이 여러 개입니다. 지역을 확인하고 목록에서 선택해 주세요.')
  if (exact.length === 1) return { spot: exact[0], created: false }
  if (!cleanName(name)) throw new Error('스팟 이름을 입력해 주세요.')
  return { spot: await create({ name: cleanName(name) }), created: true }
}
