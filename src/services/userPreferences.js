import { authenticatedClient, execute, result, DataAccessError } from './dataAccess.js'
import { isWindUnit } from '../lib/windUnits.js'

async function clientFor(expectedUserId) {
  const auth=await authenticatedClient()
  if(auth.userId!==expectedUserId) throw new DataAccessError('계정이 변경되었습니다. 다시 로그인해 주세요.','AUTH_CHANGED')
  return auth
}
export function getPreferences(userId) {
  return execute(async()=>{
    const {client}=await clientFor(userId)
    return result(client.from('user_preferences').select('wind_speed_unit').eq('user_id',userId).maybeSingle())
  })
}
export function saveWindPreference(userId,unit) {
  return execute(async()=>{
    if(!isWindUnit(unit)) throw new DataAccessError('지원하지 않는 풍속 단위입니다.','INVALID_INPUT')
    const {client}=await clientFor(userId)
    return result(client.from('user_preferences').upsert({user_id:userId,wind_speed_unit:unit},{onConflict:'user_id'}).select('wind_speed_unit').single())
  })
}
