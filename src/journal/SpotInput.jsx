import { useEffect, useId, useState } from 'react'
import { matchSpots } from './suggestions'
import { searchPlaces } from '../services/placeSearch'

export default function SpotInput({ spots, value, onChange, onSelect, locationValid = false }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [external, setExternal] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let activeRequest = true
    setExternal([]); setError(''); setActive(-1)
    if (!open || value.trim().length < 2) { setLoading(false); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      try { const results = await searchPlaces(value); if (activeRequest) setExternal(results) }
      catch { if (activeRequest) setError('장소 검색을 사용할 수 없습니다. 이름만 저장하거나 다시 검색해 주세요.') }
      finally { if (activeRequest) setLoading(false) }
    }, 500)
    return () => { activeRequest = false; clearTimeout(timer) }
  }, [value, open])
  const matches = [...matchSpots(spots, value), ...external]
  function choose(spot) { onSelect(spot); setOpen(false); setActive(-1) }
  return <div className="spot-autocomplete">
    <label htmlFor={id}>서핑 스팟</label>
    <input id={id} required maxLength={200} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-options'} aria-activedescendant={open && active >= 0 ? id + '-' + active : undefined}
      value={value} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
      onKeyDown={e => {
        if (e.key === 'Escape') setOpen(false)
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault(); setOpen(true)
          setActive(a => Math.max(0, Math.min(matches.length - 1, a + (e.key === 'ArrowDown' ? 1 : -1))))
        }
        if (e.key === 'Enter' && open && active >= 0 && matches[active]) { e.preventDefault(); choose(matches[active]) }
      }} />
    {open && <ul id={id + '-options'} role="listbox" className="spot-options">{matches.map((s,i) => <li key={s.id} id={id + '-' + i} role="option" aria-selected={active === i} onMouseDown={e => e.preventDefault()} onClick={() => choose(s)}>{s.name}<small>{s.external ? '카카오 장소 · ' : '내 스팟 · '}{s.region || '지역 미등록'}{s.country ? ' · ' + s.country : ''}</small></li>)}</ul>}
    {loading && <small role="status">장소 검색 중...</small>}
    {error && <small role="alert">{error}</small>}
    {open && !locationValid && value.trim() && !loading && !matches.length && <small role="status">검색 결과 없음. 이름만 저장할 수 있습니다.</small>}
  </div>
}
