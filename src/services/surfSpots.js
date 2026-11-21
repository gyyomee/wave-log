import { authenticatedClient, execute, pickFields, result } from './dataAccess.js'

const fields = ['name', 'region', 'country', 'latitude', 'longitude']

export function listSpots() {
  return execute(async () => {
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_spots').select('*').eq('user_id', userId).order('name').order('id'))
  })
}

export function createSpot(input) {
  return execute(async () => {
    const values = pickFields(input, fields)
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_spots').insert({ ...values, user_id: userId }).select().single())
  })
}

export function updateSpot(id, input) {
  return execute(async () => {
    const values = pickFields(input, fields)
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_spots').update(values).eq('id', id).eq('user_id', userId).select().single())
  })
}

export function deleteSpot(id) {
  return execute(async () => {
    const { client, userId } = await authenticatedClient()
    return result(client.from('surf_spots').delete().eq('id', id).eq('user_id', userId).select('id').single())
  })
}
