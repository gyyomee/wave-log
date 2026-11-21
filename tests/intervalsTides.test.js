import test from 'node:test'
import assert from 'node:assert/strict'
import { tideCycle, tideLabels, serializeTides } from '../src/journal/tides.js'

test('tide labels remain optional and independent of regional convention', () => {
  assert.equal(tideLabels.length,16)
  assert.deepEqual(tideCycle('',''),{tide_cycle_label:null,tide_convention:null})
  assert.equal(tideCycle('  조금  ','7').tide_cycle_label,'조금')
  assert.equal(tideCycle('지역 기준 이름','8').tide_convention,'8')
  assert.throws(()=>tideCycle('1물','unknown'))
})
test('multiple adjacent-day tide events keep null and zero heights distinct', () => {
  const events=Array.from({length:6},(_,i)=>({id:String(i),type:i%2?'low':'high',date:i<3?'2026-10-01':'2026-10-02',time:'02:30',height_cm:i===0?0:''}))
  const saved=serializeTides(events)
  assert.equal(saved.length,6)
  assert.equal(saved[0].height_cm,0)
  assert.equal(saved[1].height_cm,null)
  assert.equal(saved[3].occurred_at,'2026-10-01T17:30:00.000Z')
  assert.equal(serializeTides([{...events[0],time:'23:59'}])[0].time,'23:59')
  assert.throws(()=>serializeTides([{...events[0],time:'24:00'}]))
  assert.throws(()=>serializeTides([{...events[0],date:'2026-02-30'}]))
  assert.deepEqual(serializeTides(),[])
})
