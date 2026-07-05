// Edge function: fetch-nyt
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Cache to avoid 429 rate limits (NYT allows ~5 req/min)
let cachedArticles: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

Deno.serve(async (req: Request) => {
  console.log('[fetch-nyt] invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Return cached data if fresh
    if (cachedArticles && (Date.now() - cacheTimestamp) < CACHE_TTL_MS) {
      console.log(`[fetch-nyt] Returning ${cachedArticles.length} cached articles`)
      return new Response(JSON.stringify({ articles: cachedArticles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('NYT_API_KEY')
    if (!apiKey) {
      console.error('[fetch-nyt] NYT_API_KEY not found')
      return new Response(
        JSON.stringify({ error: 'NYT API key not configured', articles: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const apiUrl = `https://api.nytimes.com/svc/topstories/v2/home.json?api-key=${apiKey}`
    console.log('[fetch-nyt] Fetching top stories...')

    const response = await fetch(apiUrl)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[fetch-nyt] API error: ${response.status} - ${errorText}`)
      return new Response(
        JSON.stringify({ error: `NYT API error: ${response.status}`, articles: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const data = await response.json()
    console.log(`[fetch-nyt] Got ${data.results?.length || 0} results`)

    const articles = (data.results || [])
      .filter((a: any) => a.title && a.url && a.abstract)
      .slice(0, 3)
      .map((article: any) => ({
        title: article.title,
        description: article.abstract,
        source: 'The New York Times',
        publishedAt: article.published_date,
        url: article.url,
      }))

    // Cache the result
    cachedArticles = articles;
    cacheTimestamp = Date.now();
    console.log(`[fetch-nyt] Returning ${articles.length} articles (fresh)`)

    return new Response(JSON.stringify({ articles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[fetch-nyt] Error:', error)
    // Return stale cache if available
    if (cachedArticles) {
      console.log('[fetch-nyt] Returning stale cache due to error')
      return new Response(JSON.stringify({ articles: cachedArticles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(
      JSON.stringify({ error: 'Failed to fetch NYT news', details: error?.message, articles: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
