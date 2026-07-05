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

        articles.push({
          title: subject,
          description: cleanDesc.substring(0, 300),
          source: sender_name,
          publishedAt: date,
          url: articleUrl,
          fullContent: content,
        })
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
