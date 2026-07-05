// Edge function: fetch-news
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const getNewsApiSourceId = (sourceName: string): string[] => {
  const lower = sourceName.toLowerCase()
  if (lower.includes('cnn')) return ['cnn']
  if (lower.includes('bbc')) return ['bbc-news']
  if (lower.includes('new york times') || lower.includes('nyt')) return ['the-new-york-times']
  if (lower.includes('guardian')) return ['the-guardian-uk']
  if (lower.includes('reuters')) return ['reuters']
  if (lower.includes('techcrunch')) return ['techcrunch']
  if (lower.includes('npr')) return ['national-public-radio']
  if (lower.includes('wall street journal') || lower.includes('wsj')) return ['the-wall-street-journal']
  if (lower.includes('bloomberg')) return ['bloomberg']
  return ['reuters']
}

Deno.serve(async (req: Request) => {
  console.log('[fetch-news] invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const sources: string[] = body.sources || []
    console.log('[fetch-news] sources:', JSON.stringify(sources))

    const apiKey = Deno.env.get('NEWS_API_KEY')
    if (!apiKey) {
      console.error('[fetch-news] NEWS_API_KEY not found')
      return new Response(
        JSON.stringify({ error: 'API key not configured', articles: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    let allArticles: any[] = []

    if (sources.length > 0) {
      const sourceIds = new Set<string>()
      const sourceNameMap: Record<string, string> = {}

      for (const source of sources) {
        const ids = getNewsApiSourceId(source)
        for (const id of ids) {
          sourceIds.add(id)
          sourceNameMap[id] = source
        }
      }

      console.log('[fetch-news] Mapped sources:', Array.from(sourceIds).join(', '))

      const fetchPromises = Array.from(sourceIds).map(async (sourceId) => {
        const apiUrl = `https://newsapi.org/v2/top-headlines?sources=${sourceId}&pageSize=3`
        try {
          const response = await fetch(apiUrl, { headers: { 'X-API-Key': apiKey } })
          if (!response.ok) {
            console.error(`[fetch-news] ${sourceId} failed: ${response.status}`)
            return []
          }
          const data = await response.json()
          console.log(`[fetch-news] ${sourceId}: ${data.articles?.length || 0} articles`)
          return (data.articles || []).map((article: any) => ({
            title: article.title,
            description: article.description || '',
            source: sourceNameMap[sourceId] || article.source?.name,
            publishedAt: article.publishedAt,
            url: article.url,
          }))
        } catch (err: any) {
          console.error(`[fetch-news] Error fetching ${sourceId}:`, err)
          return []
        }
      })

      const results = await Promise.all(fetchPromises)
      allArticles = results.flat()
    } else {
      console.log('[fetch-news] No sources, getting US headlines')
      const apiUrl = 'https://newsapi.org/v2/top-headlines?country=us&pageSize=20'
      const response = await fetch(apiUrl, { headers: { 'X-API-Key': apiKey } })
      if (response.ok) {
        const data = await response.json()
        allArticles = (data.articles || [])
          .filter((a: any) => a.title && a.url)
          .map((article: any) => ({
            title: article.title,
            description: article.description || '',
            source: article.source?.name,
            publishedAt: article.publishedAt,
            url: article.url,
          }))
      }
    }

    const articles = allArticles.filter((a: any) => a.title && a.url)
    console.log(`[fetch-news] Returning ${articles.length} articles`)

    return new Response(JSON.stringify({ articles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[fetch-news] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch news', details: error?.message, articles: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
