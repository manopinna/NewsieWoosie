// Edge function: fetch-cricinfo
// Pulls latest cricket headlines via the official ESPN site API (content sourced from ESPNcricinfo).
// No key required. Aggregates across a few major cricket leagues for variety.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let cachedArticles: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ESPN cricket league IDs: 8039=ICC events/World Cup, 8048=IPL, 1107972=International
const LEAGUE_IDS = ['8039', '8048', '1107972'];
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/cricket';

const fetchLeague = async (id: string) => {
  try {
    const res = await fetch(`${BASE}/${id}/news?limit=10`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PodcastifyBot/1.0)' },
    });
    if (!res.ok) {
      console.warn(`[fetch-cricinfo] league ${id} HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.articles) ? data.articles : [];
  } catch (e) {
    console.warn(`[fetch-cricinfo] league ${id} fetch err`, e);
    return [];
  }
};

Deno.serve(async (req: Request) => {
  console.log('[fetch-cricinfo] invoked', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (cachedArticles && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      console.log(`[fetch-cricinfo] cache hit: ${cachedArticles.length}`);
      return new Response(JSON.stringify({ articles: cachedArticles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const all = (await Promise.all(LEAGUE_IDS.map(fetchLeague))).flat();
    console.log(`[fetch-cricinfo] raw items: ${all.length}`);

    // Dedupe by headline
    const seen = new Set<string>();
    const articles = all
      .map((a: any) => {
        const title = (a.headline || '').toString().trim();
        const description = (a.description || '').toString().slice(0, 300);
        const link = a.links?.web?.href || a.links?.api?.news?.href || '';
        return {
          title,
          description,
          source: 'ESPNcricinfo',
          publishedAt: a.published || new Date().toISOString(),
          url: link || 'https://www.espncricinfo.com/',
        };
      })
      .filter((a) => {
        if (!a.title) return false;
        const key = a.title.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 3);

    cachedArticles = articles;
    cacheTimestamp = Date.now();
    console.log(`[fetch-cricinfo] returning ${articles.length} fresh articles`);

    return new Response(JSON.stringify({ articles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[fetch-cricinfo] Error:', error);
    if (cachedArticles) {
      return new Response(JSON.stringify({ articles: cachedArticles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ error: 'Failed to fetch ESPNcricinfo', details: error?.message, articles: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
