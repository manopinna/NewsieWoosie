// Edge function: fetch-newsletter-content
// Fetches the full content of a specific newsletter email using server-side Google credentials

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Sender-specific overrides: canonical URL to use instead of extracting from email body
const SENDER_URL_OVERRIDES: Record<string, string> = {
  'Bloomberg India Edition': 'https://www.bloomberg.com/account/newsletters/india-edition',
  'TLDR Fintech': 'https://tldr.tech/fintech',
  'TLDR': 'https://tldr.tech/',
  "WSJ What's News": 'https://www.wsj.com/newsletters/whats-news',
}

function cleanHtmlContent(html: string): string {
  let text = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<[^>]*>/g, ' ')
  text = text.replace(/@font-face\s*\{[^}]*\}/g, '')
  text = text.replace(/@media[^{]*\{[^}]*(\{[^}]*\}[^}]*)*\}/g, '')
  text = text.replace(/[.#]?[\w-]+\s*\{[^}]*\}/g, '')
  text = text.replace(/[\w-]+\s*:\s*[^;{}"'\n]+;/g, '')
  text = text.replace(/\*\s*\{[^}]*\}/g, '')
  text = text.replace(/!important/g, '')
  text = text.split('\n').filter(line => {
    const trimmed = line.trim()
    if (!trimmed) return false
    const letters = (trimmed.match(/[a-zA-Z]/g) || []).length
    const specials = (trimmed.match(/[{}:;*#.@]/g) || []).length
    if (specials > letters && specials > 3) return false
    if (trimmed.length < 10 && !/[.!?]$/.test(trimmed)) return false
    return true
  }).join('\n')
  text = text.replace(/\s+/g, ' ').trim()
  // Remove "View this post on the web at ..." lines
  text = text.replace(/View this post on the web at https?:\/\/\S+/gi, '').trim()
  return text
}

function decodeBase64Url(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  try {
    return atob(base64)
  } catch {
    return ''
  }
}

function extractTextFromParts(parts: any[]): string {
  let text = ''
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      text += decodeBase64Url(part.body.data)
    } else if (part.mimeType === 'text/html' && part.body?.data && !text) {
      const html = decodeBase64Url(part.body.data)
      text = cleanHtmlContent(html)
    } else if (part.parts) {
      text += extractTextFromParts(part.parts)
    }
  }
  return text
}

function extractRawHtmlFromParts(parts: any[]): string {
  for (const part of parts) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    } else if (part.parts) {
      const found = extractRawHtmlFromParts(part.parts)
      if (found) return found
    }
  }
  return ''
}

function extractRawTextFromParts(parts: any[]): string {
  for (const part of parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return decodeBase64Url(part.body.data)
    } else if (part.parts) {
      const found = extractRawTextFromParts(part.parts)
      if (found) return found
    }
  }
  return ''
}

function isUnwantedUrl(url: string): boolean {
  const lower = url.toLowerCase()
  const skipPatterns = [
    'unsubscribe', 'preferences', 'list-manage', 'mailto:', 'manage-subscription',
    'email-preferences', 'view-in-browser', '/profile', 'click.', 'tracking',
    'beacon', 'open.', 'pixel', 'utm_', '/about', 'privacy', 'terms',
    'twitter.com/', 'x.com/', 'facebook.com/', 'linkedin.com/', 'instagram.com/',
    'youtube.com/', 't.me/', 'whatsapp', 'mail.google.com',
  ]
  return skipPatterns.some(p => lower.includes(p))
}

function isTldrSender(senderName: string): boolean {
  const lower = senderName.toLowerCase()
  return lower === 'tldr' || lower.includes('tldr tech')
}

function mentionsDan(text: string): boolean {
  return /\bdan\b/i.test(text)
}

function isDanContent(article: any, senderName: string): boolean {
  if (!isTldrSender(senderName)) return false
  const textToCheck = `${article.title || ''} ${article.description || ''} ${article.fullContent || ''}`
  return mentionsDan(textToCheck)
}

// Housekeeping stories: admin updates about the newsletter itself rather than
// the actual news/topics the newsletter covers.
const HOUSEKEEPING_TITLE_PATTERNS = [
  /\bwe[''\u2019]?re\s+(moving|changing|switching|updating|relaunching|rebranding)\b/i,
  /\bnew\s+(platform|email\s*address|home|domain|look|format|design)\b/i,
  /\bunsubscribe\b/i,
  /\b(update|manage)\s+(your\s+)?(preferences|subscription|profile)\b/i,
  /\bemail\s+preferences\b/i,
  /\bwe[''\u2019]?re\s+hiring\b/i,
  /\bjoin\s+(our|the)\s+team\b/i,
  /\b(sponsor|advertise|partner\s+with\s+us)\b/i,
  /\b(feedback|reply\s+to\s+this\s+email)\b/i,
  /\b(forward\s+this|share\s+this|refer\s+a\s+friend)\b/i,
  /\babout\s+(this\s+newsletter|us)\b/i,
  /\bhow\s+to\s+use\b/i,
  /\bwelcome\s+to\b/i,
  /\byou[''\u2019]?re\s+subscribed\b/i,
  /\brate\s+this\s+newsletter\b/i,
  /\bsupport\s+us\b/i,
  /\bbecome\s+a\s+member\b/i,
  /\bimportant\s+(update|announcement)\b/i,
  /\bprivacy\s+policy\b/i,
  /\bterms\s+(of\s+service|and\s+conditions)\b/i,
  /\bwe[''\u2019]?re\s+taking\s+a\s+break\b/i,
  /\bsee\s+you\s+next\s+(year|week|month)\b/i,
  /\bholiday\s+(break|schedule)\b/i,
]

const HOUSEKEEPING_CONTENT_PATTERNS = [
  /\bwe[''\u2019]?re\s+(moving|changing|switching)\s+(to\s+a\s+)?new\s+(platform|email\s*address|provider)\b/i,
  /\bwe[''\u2019]?ve\s+made\s+some\s+changes\b/i,
  /\bwe[''\u2019]?re\s+excited\s+to\s+announce\b/i,
  /\bthis\s+email\s+was\s+sent\s+to\b/i,
  /\byou\s+are\s+receiving\s+this\b/i,
  /\bupdate\s+your\s+(email\s+)?preferences\b/i,
  /\bunsubscribe\s+(here|below|at)\b/i,
  /\bforward\s+this\s+email\s+to\b/i,
  /\bshare\s+this\s+newsletter\b/i,
  /\brefer\s+a\s+friend\b/i,
  /\bnew\s+domain\s+is\b/i,
  /\bwe[''\u2019]?re\s+rebranding\b/i,
]

function isHousekeepingStory(article: any): boolean {
  const title = article.title || ''
  const text = `${article.description || ''} ${article.fullContent || ''}`
  return (
    HOUSEKEEPING_TITLE_PATTERNS.some((p) => p.test(title)) ||
    HOUSEKEEPING_CONTENT_PATTERNS.some((p) => p.test(text))
  )
}

function extractCanonicalUrl(rawHtml: string, rawText: string): string | null {
  // 1. Substack-style: "View this post on the web at <URL>"
  const viewWebMatch = (rawText + ' ' + rawHtml).match(/View this post on the web at\s+(https?:\/\/\S+)/i)
  if (viewWebMatch) {
    return viewWebMatch[1].replace(/[.,)\]]+$/, '')
  }

  // 2. First meaningful href in HTML
  if (rawHtml) {
    const hrefRegex = /href=["']([^"']+)["']/gi
    let m
    while ((m = hrefRegex.exec(rawHtml)) !== null) {
      const url = m[1].trim()
      if (url.startsWith('http') && !isUnwantedUrl(url)) {
        return url
      }
    }
  }

  // 3. First http URL in plain text
  if (rawText) {
    const urlRegex = /https?:\/\/[^\s\]\)>"']+/g
    let m
    while ((m = urlRegex.exec(rawText)) !== null) {
      const url = m[0].replace(/[.,)\]]+$/, '')
      if (!isUnwantedUrl(url)) {
        return url
      }
    }
  }

  return null
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')!
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')!
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')!

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text()
    throw new Error(`Token refresh failed: ${tokenResponse.status} ${errText}`)
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

Deno.serve(async (req: Request) => {
  console.log('[fetch-newsletter-content] invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { sender_name } = body

    if (!sender_name) {
      return new Response(
        JSON.stringify({ error: 'sender_name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Get access token using server-side refresh token
    const accessToken = await getAccessToken()
    console.log('[fetch-newsletter-content] Access token obtained')

    // Fetch recent emails from this sender
    const query = encodeURIComponent(`from:${sender_name} newer_than:7d`)
    const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=3`

    const listResponse = await fetch(gmailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!listResponse.ok) {
      const errText = await listResponse.text()
      console.error('[fetch-newsletter-content] Gmail list error:', listResponse.status, errText)
      return new Response(
        JSON.stringify({ error: `Gmail error: ${listResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const listData = await listResponse.json()
    const messageIds = (listData.messages || []).map((m: any) => m.id)

    if (messageIds.length === 0) {
      return new Response(
        JSON.stringify({ articles: [], message: 'No recent emails from this sender.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const articles: any[] = []

    for (const msgId of messageIds.slice(0, 3)) {
      try {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )

        if (!msgResponse.ok) continue
        const msgData = await msgResponse.json()

        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject'
        const date = headers.find((h: any) => h.name === 'Date')?.value || ''

        let content = ''
        let rawHtml = ''
        let rawText = ''
        if (msgData.payload?.body?.data) {
          const decoded = decodeBase64Url(msgData.payload.body.data)
          if (msgData.payload.mimeType === 'text/html') {
            rawHtml = decoded
            content = cleanHtmlContent(decoded)
          } else {
            rawText = decoded
            content = decoded
          }
        } else if (msgData.payload?.parts) {
          content = extractTextFromParts(msgData.payload.parts)
          rawHtml = extractRawHtmlFromParts(msgData.payload.parts)
          rawText = extractRawTextFromParts(msgData.payload.parts)
        }

        let articleUrl = SENDER_URL_OVERRIDES[sender_name]
          || extractCanonicalUrl(rawHtml, rawText)
          || `https://mail.google.com/mail/u/0/#inbox/${msgId}`
        // Strip ben's bites boilerplate using string search
        content = content.replace(/View this post on the web at https?:\/\/\S+/gi, '').trim()
        // Remove "Hey I'm Ben..." intro (handles all quote variants)
        const benIntroMarker = 'build stuff with agents'
        const tinkeringMarker = 'tinkering with.'
        const benIdx = content.toLowerCase().indexOf(benIntroMarker)
        if (benIdx !== -1) {
          // Find where "Hey" starts before the marker
          const heyIdx = content.lastIndexOf('Hey', benIdx)
          // Find end of the boilerplate (after "tinkering with." and any trailing link)
          let endIdx = content.indexOf(tinkeringMarker, benIdx)
          if (endIdx !== -1) {
            endIdx += tinkeringMarker.length
            // Skip trailing whitespace, bracket links like " [ URL ].", and newlines
            const remainder = content.substring(endIdx)
            const trailingMatch = remainder.match(/^\s*(\[\s*\S+\s*\]\s*\.?\s*)?(\r?\n)?/)
            if (trailingMatch) {
              endIdx += trailingMatch[0].length
            }
            const startCut = heyIdx !== -1 ? heyIdx : benIdx
            content = (content.substring(0, startCut) + content.substring(endIdx)).trim()
          }
        }
        // Strip "If you want to start building..." line
        const buildIdx = content.toLowerCase().indexOf('if you want to start building')
        if (buildIdx !== -1) {
          let endBuild = content.indexOf('].', buildIdx)
          if (endBuild !== -1) {
            content = (content.substring(0, buildIdx) + content.substring(endBuild + 2)).trim()
          } else {
            // Try to find end of sentence
            endBuild = content.indexOf('\n', buildIdx)
            if (endBuild !== -1) {
              content = (content.substring(0, buildIdx) + content.substring(endBuild)).trim()
            }
          }
        }

        const maxLen = 3000
        if (content.length > maxLen) {
          content = content.substring(0, maxLen) + '...'
        }

        // Clean description: strip common email boilerplate to get actual article content
        let cleanDesc = content
        // Remove leading numbers (like "96")
        cleanDesc = cleanDesc.replace(/^\d+\s+/, '')
        // Remove "Plus, ..." lead-ins (handle abbreviations like U.S. by matching until sentence-ending period followed by space+uppercase)
        cleanDesc = cleanDesc.replace(/^Plus,\s+.*?(?:\.\s+(?=[A-Z]))/i, '')
        // Remove everything before the article title if we can find it in the content
        const titleWords = subject.split(/\s+/).slice(0, 4).join('\\s+')
        if (titleWords.length > 8) {
          const titleRegex = new RegExp(titleWords, 'i')
          const titleMatch = cleanDesc.match(titleRegex)
          if (titleMatch && titleMatch.index !== undefined && titleMatch.index > 0) {
            cleanDesc = cleanDesc.substring(titleMatch.index)
          }
        }
        // Remove email boilerplate phrases
        const boilerplatePatterns = [
          /Is this email difficult to read\?\s*View in browser\s*/gi,
          /View in browser\s*/gi,
          /Sponsored by\s*/gi,
          /If you[''\u2019]re not subscribed,\s*sign up here\s*\.?\s*/gi,
          /This is an edition of the What[''\u2019]s News newsletter[^.]*\.\s*/gi,
          /&#\d+;/g,
        ]
        for (const pattern of boilerplatePatterns) {
          cleanDesc = cleanDesc.replace(pattern, '')
        }
        cleanDesc = cleanDesc.replace(/\s+/g, ' ').trim()

        const article = {
          title: subject,
          description: cleanDesc.substring(0, 300),
          source: sender_name,
          publishedAt: date,
          url: articleUrl,
          fullContent: content,
        }

        // Skip TLDR articles that prominently feature Dan
        if (isDanContent(article, sender_name)) {
          console.log(`[fetch-newsletter-content] Skipping Dan-related TLDR article: ${subject}`)
          continue
        }

        // Skip newsletter housekeeping stories (admin updates, platform moves, etc.)
        if (isHousekeepingStory(article)) {
          console.log(`[fetch-newsletter-content] Skipping housekeeping story: ${subject}`)
          continue
        }

        articles.push(article)
      } catch (e) {
        console.error(`[fetch-newsletter-content] Error fetching ${msgId}:`, e)
      }
    }

    console.log(`[fetch-newsletter-content] Returning ${articles.length} articles from ${sender_name}`)

    return new Response(
      JSON.stringify({ articles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('[fetch-newsletter-content] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch newsletter content', details: error?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
