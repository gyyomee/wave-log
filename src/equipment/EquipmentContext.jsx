import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { listEquipment, registerEquipment, renameEquipment, archiveEquipment } from '../services/equipment.js'

export const EquipmentContext=createContext({items:[],loading:false,error:'',reload(){},register:async()=>[],rename:async()=>{},archive:async()=>{}})
export const useEquipment=()=>useContext(EquipmentContext)
export function EquipmentProvider({userId,children}) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const generation=useRef(0),alive=useRef(true)
  async function reload() {
    const ticket=++generation.current;setLoading(true);setError('')
    try { const rows=await listEquipment(userId);if(alive.current && ticket===generation.current) setItems(rows) }
    catch {if(alive.current && ticket===generation.current) setError('장비 목록을 불러오지 못했습니다. 다시 시도해 주세요.')}
    finally {if(alive.current && ticket===generation.current) setLoading(false)}
  }
  useEffect(()=>{alive.current=true;reload();return()=>{alive.current=false;generation.current++}},[userId])
  function merge(rows) {
    if(!alive.current) return
    generation.current++;setLoading(false)
    setItems(old=>[...old.filter(item=>!rows.some(row=>row.id===item.id)),...rows])
  }
  async function register(board,wetsuit) {const rows=await registerEquipment(userId,board,wetsuit);merge(rows);return rows}
  async function rename(id,name) {const row=await renameEquipment(userId,id,name);merge([row]);return row}
  async function archive(id) {const row=await archiveEquipment(userId,id);merge([row]);return row}
  return <EquipmentContext.Provider value={{items,loading,error,reload,register,rename,archive}}>{children}</EquipmentContext.Provider>
}
