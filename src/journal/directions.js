import { compassPoints } from './conditionModel.js'
const names=['북','북북동','북동','동북동','동','동남동','남동','남남동','남','남남서','남서','서남서','서','서북서','북서','북북서']
export const directions=compassPoints.map((abbr,index)=>({value:index*22.5,label:names[index]+'('+abbr+')'}))
export function directionLabel(value) { return value==null || value==='' ? '미입력' : directions[Math.round((Number(value)%360)/22.5)%16].label }
export function travelRotation(value) { return (Number(value)+180)%360 }
