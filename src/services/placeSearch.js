import { authenticatedClient, execute } from './dataAccess.js'
export function searchPlaces(query) {
  return execute(async () => {
    if (query.trim().length < 2) return []
    const { client } = await authenticatedClient()
    const { data, error } = await client.functions.invoke('search-places', { body: { query: query.trim().slice(0,80) } })
    if (error || !Array.isArray(data?.places)) throw new Error('장소 검색을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.')
    return data.places
  })
}
