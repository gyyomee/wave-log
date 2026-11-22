import { authenticatedClient, execute, result, DataAccessError } from './dataAccess.js'
import { windReviewPatch } from '../lib/windReview.js'

export function confirmWindUnit(sessionId,issue,unit) {
  return execute(async()=>{
    const {client}=await authenticatedClient()
    const current=await result(client.from('surf_session_conditions').select('*').eq('session_id',sessionId).single())
    const patch=windReviewPatch(current,issue,unit)
    // Optimistic concurrency: never replace newer edits with an older JSON snapshot.
    const updated=await result(client.from('surf_session_conditions').update(patch).eq('session_id',sessionId).eq('updated_at',current.updated_at).select('*').maybeSingle())
    if(!updated) throw new DataAccessError('다른 화면에서 기록이 변경되었습니다. 다시 불러와 주세요.','CONFLICT')
    return updated
  })
}
