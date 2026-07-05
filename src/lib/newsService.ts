// Real news service with actual articles from major news sources
import { supabase } from "@/integrations/supabase/client";

interface NewsArticle {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
  url: string;
}

interface NewsResponse {
  articles: NewsArticle[];
}

interface GroupedNewsResponse {
  articlesBySource: { [sourceName: string]: NewsArticle[] };
}

const isNYTSource = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.includes('new york times') || lower.includes('nyt');
};

const isFoxSportsSource = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.includes('fox sports') || lower.includes('foxsports');
};

const isCricinfoSource = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.includes('cricinfo') || lower.includes('espncricinfo');
};

const isFTSource = (name: string): boolean => {
  const lower = name.toLowerCase();
  return lower.includes('financial times') || lower === 'ft';
};

const fetchFromFunction = async (
  fnName: string,
  label: string,
): Promise<NewsArticle[]> => {
  try {
    const { data, error } = await supabase.functions.invoke(fnName);
    if (error) {
      console.warn(`${label} fetch failed, skipping:`, error.message);
      return [];
    }
    if (data?.error) {
      console.warn(`${label} API error, skipping:`, data.error);
      return [];
    }
    return data?.articles || [];
  } catch (e) {
    console.warn(`${label} fetch exception, skipping:`, e);
    return [];
  }
};

const fetchNYTArticles = () => fetchFromFunction('fetch-nyt', 'NYT');
const fetchFoxSportsArticles = () => fetchFromFunction('fetch-foxsports', 'Fox Sports');
const fetchCricinfoArticles = () => fetchFromFunction('fetch-cricinfo', 'ESPNcricinfo');
const fetchFTArticles = () => fetchFromFunction('fetch-ft', 'Financial Times');

export const fetchNews = async (sources: string[] = []): Promise<NewsResponse> => {
  console.log('fetchNews called with sources:', sources);
  
  const nytSources = sources.filter(isNYTSource);
  const foxSportsSources = sources.filter(isFoxSportsSource);
  const cricinfoSources = sources.filter(isCricinfoSource);
  const ftSources = sources.filter(isFTSource);
  const otherSources = sources.filter(s => !isNYTSource(s) && !isFoxSportsSource(s) && !isCricinfoSource(s) && !isFTSource(s));
  
  const promises: Promise<NewsArticle[]>[] = [];
  
  if (nytSources.length > 0) {
    promises.push(fetchNYTArticles());
  }

  if (foxSportsSources.length > 0) {
    promises.push(fetchFoxSportsArticles());
  }

  if (cricinfoSources.length > 0) {
    promises.push(fetchCricinfoArticles());
  }

  if (ftSources.length > 0) {
    promises.push(fetchFTArticles());
  }
  
  
  if (otherSources.length > 0) {
    promises.push(
      supabase.functions.invoke('fetch-news', { body: { sources: otherSources } })
        .then(({ data, error }) => {
          if (error) throw error;
          return data?.articles || [];
        })
    );
  }
  
  if (sources.length === 0) {
    promises.push(
      supabase.functions.invoke('fetch-news', { body: { sources: [] } })
        .then(({ data, error }) => {
          if (error) throw error;
          return data?.articles || [];
        })
    );
  }
  
  const results = await Promise.all(promises);
  const allArticles = results.flat();

  // Deduplicate: if the same story appears across multiple sources, keep only the first instance.
  const normalize = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const STOPWORDS = new Set([
    'this','that','with','from','have','will','been','were','they','their','them','what','when','where',
    'which','about','into','over','after','before','than','then','your','yours','here','there','some',
    'just','more','most','also','says','said','could','would','should','being','amid','still','says',
  ]);
  const tokenSet = (s: string) =>
    new Set(normalize(s).split(' ').filter((w) => w.length >= 3 && !STOPWORDS.has(w)));
  const intersect = (a: Set<string>, b: Set<string>) => {
    let inter = 0;
    a.forEach((w) => { if (b.has(w)) inter++; });
    return inter;
  };
  const jaccard = (a: Set<string>, b: Set<string>, inter: number) => {
    if (a.size === 0 || b.size === 0) return 0;
    return inter / (a.size + b.size - inter);
  };
  // Two articles are considered the same story if either:
  // - Jaccard similarity >= 0.35, OR
  // - They share >= 2 significant tokens AND that's >= 50% of the smaller title's tokens
  //   (catches "SpaceX IPO valued at $X" vs "SpaceX files for IPO" which share key entities)
  const isSameStory = (a: Set<string>, b: Set<string>) => {
    const inter = intersect(a, b);
    if (inter === 0) return false;
    if (jaccard(a, b, inter) >= 0.35) return true;
    const minSize = Math.min(a.size, b.size);
    if (inter >= 2 && minSize > 0 && inter / minSize >= 0.5) return true;
    return false;
  };

  const kept: NewsArticle[] = [];
  const keptTokens: Set<string>[] = [];
  for (const a of allArticles) {
    const tokens = tokenSet(a.title);
    const isDup = keptTokens.some((t) => isSameStory(tokens, t));
    if (!isDup) {
      kept.push(a);
      keptTokens.push(tokens);
    } else {
      console.log('Deduped article:', a.title, '(from', a.source, ')');
    }
  }
  const articles = kept;


  
  console.log('Fetched articles:', articles.length);
  
  if (articles.length === 0) {
    throw new Error('No articles returned from any source. Please check your API keys and try again.');
  }
  
  return { articles };
};

export const generateSummary = async (articles: NewsArticle[], format: 'audio' | 'text' = 'audio'): Promise<string> => {
  if (articles.length === 0) {
    return "No news articles available from your selected sources for summarization.";
  }

  const { data, error } = await supabase.functions.invoke('summarize-articles', {
    body: { articles, format },
  });

  if (error) {
    console.error('AI summarization error:', error);
    throw new Error('Failed to generate AI summary. Please try again.');
  }

  if (data?.error) {
    console.error('AI summarization returned error:', data.error);
    throw new Error(data.error);
  }

  return data?.summary || 'No summary generated.';
};

export const fetchNewsBySource = async (sources: string[] = []): Promise<GroupedNewsResponse> => {
  console.log('fetchNewsBySource called with sources:', sources);
  
  const { articles } = await fetchNews(sources);
  
  const articlesBySource: { [sourceName: string]: NewsArticle[] } = {};
  
  articles.forEach((article: NewsArticle) => {
    if (!articlesBySource[article.source]) {
      articlesBySource[article.source] = [];
    }
    if (articlesBySource[article.source].length < 3) {
      articlesBySource[article.source].push(article);
    }
  });
  
  console.log('Grouped articles by source:', Object.keys(articlesBySource));
  return { articlesBySource };
};

export const estimateDuration = (text: string): string => {
  const words = text.split(' ').length;
  const minutes = Math.ceil(words / 150);
  const seconds = Math.floor((words % 150) / 2.5);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};
