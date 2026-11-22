// Keep the assigned ID even if the second request fails. A retry updates the
// same journal, and concurrent submits share one in-flight operation.
export function journalSaver(id, create, update, saveConditions, registerEquipment) {
  let sessionId=id, pending=null
  return (record,conditions,intent,equipment)=>{
    if(pending) return pending
    pending=(async()=>{
      const saved=sessionId ? await update(sessionId,record) : await create(record)
      sessionId=saved.id
      try { await saveConditions(saved.id,conditions,intent) }
      catch(error) { throw new Error('서핑 기록은 저장되었지만 환경값 저장에 실패했습니다. 같은 기록으로 다시 저장해 주세요. '+error.message) }
      if(registerEquipment && (equipment?.board || equipment?.wetsuit)) {
        try {await registerEquipment(equipment.board,equipment.wetsuit)}
        catch(error) {throw new Error('일지는 저장되었지만 장비 등록에 실패했습니다. 다시 저장하면 같은 일지에서 등록을 재시도합니다. '+error.message)}
      }
      return saved
    })().finally(()=>{pending=null})
    return pending
  }
}
