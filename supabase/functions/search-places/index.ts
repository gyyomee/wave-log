const buckets = new Map<string, { time: number; count: number }>()
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') || ''
  const allowed = (Deno.env.get('PLACE_SEARCH_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim())
  const headers = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : '', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  const reply = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers })
  if (!origin || !allowed.includes(origin)) return reply(403, 'Origin not allowed')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'POST') return reply(405, 'POST required')
  const authorization = req.headers.get('authorization') || ''
  if (!authorization.startsWith('Bearer ')) return reply(401, 'Sign in required')
  try {
    const auth = await fetch(Deno.env.get('SUPABASE_URL') + '/auth/v1/user', {
      headers: { Authorization: authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
      signal: AbortSignal.timeout(5000),
    })
    if (!auth.ok) return reply(401, 'Invalid session')
    const user = await auth.json()
    if (!user.id) return reply(401, 'Invalid session')
    const now = Date.now()
    for (const [id, b] of buckets) if (now - b.time > 60000) buckets.delete(id)
    const bucket = buckets.get(user.id) || { time: now, count: 0 }
    if (++bucket.count > 30) return reply(429, 'Too many searches')
    buckets.set(user.id, bucket)
    const raw = await req.text()
    if (raw.length > 1024) return reply(413, 'Request too large')
    const body = JSON.parse(raw)
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    if (query.length < 2 || query.length > 80) return reply(400, 'Query must contain 2-80 characters')
    const key = Deno.env.get('KAKAO_LOCAL_REST_API_KEY')
    if (!key) return reply(503, 'Search is not configured')
    const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
    url.searchParams.set('query', query)
    url.searchParams.set('size', '8')
    const upstream = await fetch(url, { headers: { Authorization: 'KakaoAK ' + key }, signal: AbortSignal.timeout(8000) })
    if (!upstream.ok) return reply(502, 'Place provider unavailable')
    const data = await upstream.json()
    const places = (data.documents || []).filter((p: any) => p.x && p.y && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && Math.abs(Number(p.y)) <= 90 && Math.abs(Number(p.x)) <= 180).slice(0,8).map((p: any) => ({
      id: 'kakao:' + p.id, external: true, name: p.place_name,
      region: p.road_address_name || p.address_name, country: 'KR',
      latitude: Number(p.y), longitude: Number(p.x),
    }))
    return new Response(JSON.stringify({ places }), { headers })
  } catch { return reply(502, 'Search request failed') }
})
