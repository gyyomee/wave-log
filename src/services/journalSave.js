// Keep the assigned ID even if the second request fails. A retry updates the
// same journal, and concurrent submits share one in-flight operation.
export function journalSaver(id, create, update, saveConditions) {
  let sessionId=id, pending=null
  return (record,conditions,intent)=>{
    if(pending) return pending
    pending=(async()=>{
      const saved=sessionId ? await update(sessionId,record) : await create(record)
      sessionId=saved.id
      try { await saveConditions(saved.id,conditions,intent) }
      catch(error) { throw new Error('서핑 기록은 저장되었지만 환경값 저장에 실패했습니다. 같은 기록으로 다시 저장해 주세요. '+error.message) }
      return saved
    })().finally(()=>{pending=null})
    return pending
  }
}
