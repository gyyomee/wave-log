import { useId } from 'react'

export default function RatingInput({ label, value, onChange, crowd }) {
  const id = useId()
  const unknown = value === '' || value === null
  const score = unknown ? 3 : Number(value)
  return <div className="rating-input">
    <div className="rating-value"><label htmlFor={id}>{label}</label><output htmlFor={id}>{unknown ? '미평가 (기존 값 유지)' : score + ' / 5'}</output></div>
    <input id={id} type="range" min="1" max="5" step="1" value={score} aria-valuetext={unknown ? '미평가, 조작 시 평가 입력' : String(score)} onChange={e => onChange(Number(e.target.value))} onPointerUp={e => onChange(Number(e.currentTarget.value))} />
    <div className="rating-scale"><small>1 · {crowd ? '한산함' : '아쉬움'}</small><small>5 · {crowd ? '매우 혼잡' : '최고'}</small></div>
  </div>
}
