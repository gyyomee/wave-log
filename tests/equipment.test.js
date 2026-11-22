import test from 'node:test'
import assert from 'node:assert/strict'
import { equipmentOptions, journalEquipmentName } from '../src/equipment/equipmentModel.js'
import { journalSaver } from '../src/services/journalSave.js'
import { sessionTimes } from '../src/journal/sessionTimes.js'
import { journalRoute } from '../src/journal/useJournalRoute.js'

test('calendar day stays fixed, overnight rolls across month/year, and zero duration is rejected',()=>{
  for(const [date,endDate] of [['2026-11-22','2026-11-23'],['2026-12-31','2027-01-01'],['2028-02-29','2028-03-01']]) {
    const times=sessionTimes(date,'22:00','01:00')
    assert.equal(times.started_at,date+'T22:00:00+09:00');assert.equal(times.ended_at,endDate+'T01:00:00+09:00');assert.equal(times.nextDay,true)
  }
  assert.equal(sessionTimes('2026-11-22','09:00','10:00').overnight,false)
  assert.ok(sessionTimes('2026-11-22','10:00','10:00').error)
  assert.ok(sessionTimes('2026-02-31','09:00','10:00').error)
  assert.ok(sessionTimes('2026-11-22','25:00','10:00').error)
})
test('editing preserves the original date, exact seconds and multi-day historical timestamps',()=>{
  const original={started_at:'2026-11-22T13:00:42.123Z',ended_at:'2026-11-22T16:00:10.456Z'}
  const unchanged=sessionTimes('2030-01-01','22:00','01:00',original)
  assert.equal(unchanged.started_at,original.started_at);assert.equal(unchanged.ended_at,original.ended_at)
  const edited=sessionTimes('2030-01-01','22:00','02:00',original)
  assert.equal(edited.started_at,original.started_at);assert.equal(edited.ended_at,'2026-11-23T02:00:00+09:00')
  const long={started_at:'2026-11-22T00:00:00Z',ended_at:'2026-11-24T00:00:00Z'}
  assert.equal(sessionTimes('2030-01-01','09:00','09:00',long).ended_at,long.ended_at)
  assert.equal(sessionTimes('2030-01-01','10:00','11:00',long).endDate,'2026-11-24')
})
test('active equipment is visible before typing, searchable, and old journal snapshots are unchanged',()=>{
  const items=[{id:'b',equipment_type:'surfboard',name:'Walden Magic',is_active:true},{id:'a',equipment_type:'surfboard',name:'Old board',is_active:false},{id:'s',equipment_type:'wetsuit',name:'4/3mm',is_active:true}]
  assert.equal(equipmentOptions(items,'surfboard').length,1)
  assert.equal(equipmentOptions(items,'surfboard',' MAGIC ').length,1)
  assert.equal(equipmentOptions(items,'wetsuit')[0].name,'4/3mm')
  assert.equal(journalEquipmentName('  Old board  ','  Old board  ',items,'surfboard'),'  Old board  ')
  assert.equal(journalEquipmentName('walden   magic',null,items,'surfboard'),'Walden Magic')
  assert.equal(journalEquipmentName(' New   Board ',null,items,'surfboard'),'New Board')
})
test('failed journals or condition saves do not register equipment; registration failure retries the same journal',async()=>{
  const calls=[];let failJournal=true,failConditions=false,failEquipment=false
  const save=journalSaver(null,async()=>{calls.push('create');if(failJournal) throw Error('journal');return{id:'s'}},async id=>{calls.push('update');return{id}},async()=>{calls.push('conditions');if(failConditions) throw Error('conditions')},async(board,suit)=>{calls.push('equipment');assert.equal(board,'Test');assert.equal(suit,'4/3mm');if(failEquipment) throw Error('equipment')})
  const args=[{board_name:'Test'},{wetsuit:'4/3mm'},{},{board:'Test',wetsuit:'4/3mm'}]
  await assert.rejects(()=>save(...args));assert.deepEqual(calls,['create'])
  failJournal=false;failConditions=true;calls.length=0;await assert.rejects(()=>save(...args));assert.deepEqual(calls,['create','conditions'])
  failConditions=false;failEquipment=true;calls.length=0;await assert.rejects(()=>save(...args),/장비 등록/);assert.deepEqual(calls,['update','conditions','equipment'])
  failEquipment=false;calls.length=0;const a=save(...args),b=save(...args);assert.equal(a,b);await a;assert.deepEqual(calls,['update','conditions','equipment'])
})
test('unchanged historical gear is not reactivated or registered by unrelated edits',async()=>{
  let registered=false
  const save=journalSaver('old',null,async id=>({id}),async()=>{},async()=>{registered=true})
  await save({board_name:'Archived board'},{wetsuit:'Archived suit'},{},{board:null,wetsuit:null})
  assert.equal(registered,false)
})
test('browser route state supports My Page subpages and details without extra return buttons',()=>{
  assert.deepEqual(journalRoute({page:'equipment'}),{page:'equipment'})
  assert.deepEqual(journalRoute({page:'detail',sessionId:'s'}),{page:'detail',sessionId:'s'})
  assert.deepEqual(journalRoute({page:'detail'}),{page:'journal'})
  assert.deepEqual(journalRoute({page:'unknown'}),{page:'journal'})
})
test('equipment services paginate, normalize names, archive and enforce the signed-in owner (mocked)',async t=>{
  let current='a',rpcArgs,patch
  const filters=[]
  const client={rpc:async(name,args)=>{assert.equal(name,'register_my_equipment');rpcArgs=args;return {data:[{id:'board'}],error:null}},from(table){assert.equal(table,'user_equipment');const q={select:()=>q,eq:(key,value)=>{filters.push([key,value]);return q},order:()=>q,range:async()=>({data:[{id:'b',is_active:true}],error:null}),update:input=>{patch=input;return q},single:async()=>({data:{id:'b',...patch},error:null})};return q}}
  class DataAccessError extends Error {}
  t.mock.module('../src/services/dataAccess.js',{namedExports:{DataAccessError,authenticatedClient:async()=>({client,userId:current}),execute:fn=>fn(),result:async query=>(await query).data}})
  const {listEquipment,registerEquipment,renameEquipment,archiveEquipment}=await import('../src/services/equipment.js')
  assert.equal((await listEquipment('a')).length,1)
  await registerEquipment('a',' Walden   Magic ',' 4/3mm ');assert.deepEqual(rpcArgs,{p_board:'Walden Magic',p_wetsuit:'4/3mm'})
  await renameEquipment('a','b',' New  name ');assert.deepEqual(patch,{name:'New name'})
  await archiveEquipment('a','b');assert.deepEqual(patch,{is_active:false})
  assert.ok(filters.some(([key,value])=>key==='user_id' && value==='a'))
  current='b';await assert.rejects(()=>registerEquipment('a','x',null),/계정/)
  await assert.rejects(()=>renameEquipment('b','b',' '),/1~200/)
})
