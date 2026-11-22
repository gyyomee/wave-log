import test from 'node:test'
import assert from 'node:assert/strict'
import { createPreferenceStore } from '../src/preferences/preferenceStore.js'
import { windToDisplay, windFromInput, formatWind, fromKnots } from '../src/lib/windUnits.js'

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
test('preferences default to knots without writing and persist explicit choices across reloads',async()=>{
  let row=null,writes=0
  const services={load:async()=>row,save:async unit=>{writes++;return row={wind_speed_unit:unit}}}
  const store=createPreferenceStore(services)
  await store.load();assert.equal(store.getSnapshot().unit,'kts');assert.equal(writes,0)
  await store.change('m/s');assert.equal(writes,1);assert.equal(store.getSnapshot().unit,'m/s')
  const reopened=createPreferenceStore(services);await reopened.load()
  assert.equal(reopened.getSnapshot().unit,'m/s')
  await reopened.change('m/s');await reopened.change('invalid');assert.equal(writes,1)
})
test('failed preference loads never write a default; failed saves restore the previous unit',async()=>{
  let writes=0,fail=true
  const store=createPreferenceStore({load:async()=>{if(fail) throw Error();return {wind_speed_unit:'m/s'}},save:async()=>{writes++;throw Error()}})
  await store.load();await store.change('m/s')
  assert.equal(writes,0);assert.equal(store.getSnapshot().unit,'kts');assert.ok(store.getSnapshot().error)
  fail=false;await store.load();await store.change('kts')
  assert.equal(store.getSnapshot().unit,'m/s');assert.ok(store.getSnapshot().error)
})
test('account stores are isolated and cancelled or superseded loads cannot update them',async()=>{
  const first=deferred(),second=deferred();let calls=0
  const a=createPreferenceStore({load:()=>++calls===1 ? first.promise : second.promise,save:async()=>{}})
  const b=createPreferenceStore({load:async()=>null,save:async()=>{}})
  const pending=a.load();const newer=a.load();second.resolve({wind_speed_unit:'m/s'});await newer
  first.resolve({wind_speed_unit:'kts'});await pending
  assert.equal(a.getSnapshot().unit,'m/s');await b.load();assert.equal(b.getSnapshot().unit,'kts')
  const late=deferred(),c=createPreferenceStore({load:()=>late.promise,save:async()=>{}})
  const request=c.load();c.cancel();late.resolve({wind_speed_unit:'m/s'});await request
  assert.equal(c.getSnapshot().unit,'kts')
})
test('preference saves are serialized and do not lose the successful result',async()=>{
  const pending=deferred();let writes=0
  const store=createPreferenceStore({load:async()=>null,save:()=>{writes++;return pending.promise}})
  await store.load();const saving=store.change('m/s');await store.change('kts');await store.load()
  assert.equal(writes,1);pending.resolve({wind_speed_unit:'m/s'});await saving
  assert.equal(store.getSnapshot().unit,'m/s');assert.equal(store.getSnapshot().saving,false)
})
test('display switching never mutates canonical input or accumulates rounding drift',()=>{
  const record={wind_speed:fromKnots(10)},original=record.wind_speed
  for(let i=0;i<1000;i++) {
    assert.equal(windToDisplay(record.wind_speed,'kts'),10)
    assert.equal(windToDisplay(record.wind_speed,'m/s'),original)
    formatWind(record.wind_speed,'m/s');formatWind(record.wind_speed,'kts')
  }
  assert.equal(record.wind_speed,original)
  assert.equal(windFromInput(10,'kts'),original)
  assert.equal(windFromInput(5.14,'m/s'),5.14)
  assert.equal(windFromInput('','m/s'),null)
  assert.equal(formatWind(null,'m/s'),'-')
  assert.equal(formatWind(original,'m/s'),'5.1 m/s')
})

test('preference service scopes requests to the authenticated account and rejects stale account writes',async t=>{
  let current='a',saved=null
  const client={from(table){assert.equal(table,'user_preferences');return {
    select(){return {eq(key,id){assert.equal(key,'user_id');assert.equal(id,current);return {maybeSingle:async()=>({data:saved,error:null})}}}},
    upsert(payload,options){assert.equal(payload.user_id,current);assert.equal(options.onConflict,'user_id');saved={wind_speed_unit:payload.wind_speed_unit};return {select(){return {single:async()=>({data:saved,error:null})}}}},
  }}}
  class DataAccessError extends Error {}
  t.mock.module('../src/services/dataAccess.js',{namedExports:{DataAccessError,authenticatedClient:async()=>({client,userId:current}),execute:fn=>fn(),result:async query=>(await query).data}})
  const {getPreferences,saveWindPreference}=await import('../src/services/userPreferences.js')
  assert.equal(await getPreferences('a'),null)
  await saveWindPreference('a','m/s');assert.equal((await getPreferences('a')).wind_speed_unit,'m/s')
  current='b';await assert.rejects(()=>saveWindPreference('a','kts'),/계정/)
  await assert.rejects(()=>saveWindPreference('b','mph'),/지원/)
})
