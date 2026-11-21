import test from 'node:test'
import assert from 'node:assert/strict'
import { seoulParts, shiftMonth, monthDays } from '../src/journal/dates.js'

test('journal uses Seoul dates across UTC day/month boundaries', () => {
  assert.deepEqual(seoulParts('2026-10-31T15:30:00Z'), { date: '2026-11-01', time: '00:30' })
})
test('calendar handles leap years and year navigation', () => {
  assert.equal(monthDays('2024-02').filter(Boolean).length, 29)
  assert.equal(monthDays('2026-02').filter(Boolean).length, 28)
  assert.equal(monthDays('2026-11')[0], '2026-11-01')
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
})
