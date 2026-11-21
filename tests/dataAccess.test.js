import test from 'node:test'
import assert from 'node:assert/strict'
import { pickFields, timestamp, execute, result, DataAccessError } from '../src/services/dataAccess.js'

test('ownership and server-managed fields cannot be submitted', () => {
  for (const key of ['user_id', 'id', 'created_at', 'updated_at']) {
    assert.throws(() => pickFields({ name: 'Spot', [key]: 'override' }, ['name']), DataAccessError)
  }
  assert.deepEqual(pickFields({ name: 'Spot', region: undefined }, ['name', 'region']), { name: 'Spot' })
  assert.throws(() => pickFields({}, ['name']), DataAccessError)
})

test('Seoul midnight is normalized to the preceding UTC day', () => {
  assert.equal(timestamp('2026-11-01T00:00:00+09:00'), '2026-10-31T15:00:00.000Z')
  for (const value of ['2026-11-01', '2026-11-01T00:00:00', null, 'invalid']) {
    assert.throws(() => timestamp(value), DataAccessError)
  }
})

test('database errors retain their code and cause', async () => {
  const error = { code: '23503', message: 'Foreign key violation' }
  await assert.rejects(execute(() => result(Promise.resolve({ error, data: null }))),
    (caught) => caught instanceof DataAccessError && caught.code === '23503' && caught.cause === error)
  assert.deepEqual(await execute(() => result(Promise.resolve({ data: [{ id: 'one' }], error: null }))), [{ id: 'one' }])
})
