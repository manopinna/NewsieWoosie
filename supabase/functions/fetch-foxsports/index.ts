// Edge function: fetch-foxsports
// Pulls top Fox Sports headlines via Google News RSS (no API key required)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

let cachedArticles: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Fox Sports' own feed API (direct from foxsports.com, not a third-party aggregator)
const RSS_URL =
  'https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyGKCfxBagJG9b8pqLyndmvo7UU';

const decodeEntities = (s: string): string =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

const stripHtml = (s: string): string =>
  decodeEntities(s).replace(/<[^>]+>/g, '').trim();

const pickTag = (item: string, tag: string): string => {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? decodeEntities(m[1]).trim() : '';
};

Deno.serve(async (req: Request) => {
  console.log('[fetch-foxsports] invoked', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (cachedArticles && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
      console.log(`[fetch-foxsports] cache hit: ${cachedArticles.length}`);
      return new Response(JSON.stringify({ articles: cachedArticles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PodcastifyBot/1.0)' },
    });

    if (!response.ok) {
      console.error(`[fetch-foxsports] RSS error: ${response.status}`);
      return new Response(
        JSON.stringify({ error: `Fox Sports RSS error: ${response.status}`, articles: [] }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const xml = await response.text();
    const itemMatches = xml.match(/<item[\s\S]*?<\/item>/g) || [];
    console.log(`[fetch-foxsports] parsed ${itemMatches.length} items`);

    const promoKeywords = ['promo code', 'promo', 'kalshi', 'bonus', 'bet $', 'bet now', 'sportsbook', 'gambling', 'odds boost'];
    const isPromo = (text: string) => promoKeywords.some(k => text.toLowerCase().includes(k));

    const articles = itemMatches
      .map((item) => {
        const title = stripHtml(pickTag(item, 'title'));
        const link = stripHtml(pickTag(item, 'link'));
        const pubDate = pickTag(item, 'pubDate');
        const description = stripHtml(pickTag(item, 'description')).slice(0, 300);
        return {
          title,
          description,
          source: 'Fox Sports',
          publishedAt: pubDate || new Date().toISOString(),
          url: link,
        };
      })
      .filter((a) => a.title && a.url && !isPromo(a.title) && !isPromo(a.description))
      .slice(0, 3);

    cachedArticles = articles;
    cacheTimestamp = Date.now();
    console.log(`[fetch-foxsports] returning ${articles.length} fresh articles`);

    return new Response(JSON.stringify({ articles }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[fetch-foxsports] Error:', error);
    if (cachedArticles) {
      return new Response(JSON.stringify({ articles: cachedArticles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ error: 'Failed to fetch Fox Sports', details: error?.message, articles: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
