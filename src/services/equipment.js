import { authenticatedClient, execute, result, DataAccessError } from './dataAccess.js'
import { cleanName } from '../journal/suggestions.js'
export function equipmentName(value) {
  const name=cleanName(value)
  if(!name || name.length>200) throw new DataAccessError('장비 이름은 1~200자로 입력해 주세요.','INVALID_INPUT')
  return name
}
async function owned(expectedUserId) {
  const auth=await authenticatedClient()
  if(auth.userId!==expectedUserId) throw new DataAccessError('계정이 변경되었습니다. 다시 로그인해 주세요.','AUTH_CHANGED')
  return auth
}
export function listEquipment(userId) {
  return execute(async()=>{
    const {client}=await owned(userId),rows=[]
    for(let offset=0;;offset+=100) {
      const batch=await result(client.from('user_equipment').select('*').eq('user_id',userId).order('name').order('id').range(offset,offset+99))
      rows.push(...batch);if(batch.length<100) return rows
    }
  })
}
export function registerEquipment(userId,board,wetsuit) {
  return execute(async()=>{
    const p_board=cleanName(board) ? equipmentName(board) : null,p_wetsuit=cleanName(wetsuit) ? equipmentName(wetsuit) : null
    if(!p_board && !p_wetsuit) return []
    const {client}=await owned(userId)
    return result(client.rpc('register_my_equipment',{p_board,p_wetsuit}))
  })
}
export function renameEquipment(userId,id,name) {
  return execute(async()=>{
    const value=equipmentName(name),{client}=await owned(userId)
    return result(client.from('user_equipment').update({name:value}).eq('user_id',userId).eq('id',id).select('*').single())
  })
}
export function archiveEquipment(userId,id) {
  return execute(async()=>{
    const {client}=await owned(userId)
    return result(client.from('user_equipment').update({is_active:false}).eq('user_id',userId).eq('id',id).select('*').single())
  })
}
