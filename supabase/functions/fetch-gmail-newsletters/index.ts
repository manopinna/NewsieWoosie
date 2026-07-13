// Edge function: fetch-gmail-newsletters
// Uses stored GOOGLE_REFRESH_TOKEN to fetch newsletters from the pmanojna@gmail.com account
// Persists every discovered sender to known_newsletter_senders so buttons appear even when Gmail returns nothing recent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req: Request) => {
  console.log('[fetch-gmail-newsletters] invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
    const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN')

    if (!clientId || !clientSecret || !refreshToken) {
      console.error('[fetch-gmail-newsletters] Missing Google OAuth credentials')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: missing Google credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Exchange refresh token for access token
    console.log('[fetch-gmail-newsletters] Client ID starts with:', clientId.substring(0, 10), '...ends with:', clientId.substring(clientId.length - 30))
    console.log('[fetch-gmail-newsletters] Client Secret length:', clientSecret.length)
    console.log('[fetch-gmail-newsletters] Refresh Token length:', refreshToken.length)
    console.log('[fetch-gmail-newsletters] Exchanging refresh token for access token...')
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
      console.error('[fetch-gmail-newsletters] Token refresh failed:', tokenResponse.status, errText)
      return new Response(
        JSON.stringify({ error: 'Failed to refresh Google access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.access_token
    console.log('[fetch-gmail-newsletters] Access token obtained successfully')

    // Search for newsletter-like emails in Gmail
    const body = await req.json().catch(() => ({}))
    const maxResults = body.maxResults || 200
    // Look back 1 year so all subscribed newsletters appear, even if none arrived recently
    const query = encodeURIComponent(`category:promotions OR category:updates newer_than:365d`)

    const gmailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=${maxResults}`
    console.log('[fetch-gmail-newsletters] Fetching messages...')

    const listResponse = await fetch(gmailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!listResponse.ok) {
      const errText = await listResponse.text()
      console.error('[fetch-gmail-newsletters] Gmail API error:', listResponse.status, errText)
      return new Response(
        JSON.stringify({ error: `Gmail API error: ${listResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const listData = await listResponse.json()
    const messageIds = (listData.messages || []).map((m: any) => m.id)
    console.log(`[fetch-gmail-newsletters] Found ${messageIds.length} newsletter messages`)

    if (messageIds.length === 0) {
      return new Response(
        JSON.stringify({ newsletters: [], message: 'No newsletters found.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Fetch up to 100 messages so we can collect all unique senders the inbox is subscribed to
    const messagesToFetch = messageIds.slice(0, 100)
    const newsletters: any[] = []
    const seenSenders = new Set<string>()
    const excludedSenders = ['google', 'podcastify newsletters', 'podcastifynewsletters', 'seeking alpha', 'must reads', 'dan from tldr', 'dan @ tldr', 'dan at tldr']

    // Sender name remapping for display consistency
    const senderNameMap: Record<string, string> = {
      'Menaka Doshi at Bloomberg': 'Bloomberg India Edition',
      'Bloomberg': 'Bloomberg India Edition',
    }


    for (const msgId of messagesToFetch) {
      try {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        )

        if (!msgResponse.ok) continue
        const msgData = await msgResponse.json()

        const headers = msgData.payload?.headers || []
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject'
        const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown'
        const date = headers.find((h: any) => h.name === 'Date')?.value || ''

        // Extract sender name from "Name <email>" format, normalize curly quotes to straight
        const senderMatch = from.match(/^"?([^"<]+)"?\s*</)
        let senderName = senderMatch ? senderMatch[1].trim() : from.split('@')[0]
        senderName = senderName.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')

        // Apply display name remapping
        if (senderNameMap[senderName]) {
          senderName = senderNameMap[senderName]
        }

        // Skip excluded senders and duplicates
        if (excludedSenders.some(ex => senderName.toLowerCase().includes(ex))) continue
        if (!seenSenders.has(senderName)) {
          seenSenders.add(senderName)
          newsletters.push({
            id: msgId,
            subject,
            from: senderName,
            fromFull: from,
            date,
            snippet: msgData.snippet || '',
          })
        }
      } catch (e) {
        console.error(`[fetch-gmail-newsletters] Error fetching message ${msgId}:`, e)
      }
    }

    // Persist newly discovered senders + merge with previously known senders
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const excludedLower = excludedSenders
    if (newsletters.length > 0) {
      try {
        await supabase.from('known_newsletter_senders').upsert(
          newsletters.map(n => ({
            sender_name: n.from,
            from_full: n.fromFull,
            last_seen_at: new Date().toISOString(),
          })),
          { onConflict: 'sender_name' },
        )
      } catch (e) {
        console.error('[fetch-gmail-newsletters] Failed to persist senders:', e)
      }
    }

    let merged = [...newsletters]
    try {
      const { data: known } = await supabase
        .from('known_newsletter_senders')
        .select('sender_name, from_full, last_seen_at')
        .order('last_seen_at', { ascending: false })

      const haveSet = new Set(merged.map(m => m.from))
      for (const k of known || []) {
        const senderName = senderNameMap[k.sender_name] || k.sender_name
        if (excludedLower.some(ex => senderName.toLowerCase().includes(ex))) continue
        if (haveSet.has(senderName)) continue
        haveSet.add(senderName)
        merged.push({
          id: `known-${senderName}`,
          subject: '',
          from: senderName,
          fromFull: k.from_full || k.sender_name,
          date: k.last_seen_at,
          snippet: '',
        })
      }
    } catch (e) {
      console.error('[fetch-gmail-newsletters] Failed to read known senders:', e)
    }

    console.log(`[fetch-gmail-newsletters] Returning ${merged.length} senders (${newsletters.length} fresh)`)

    return new Response(
      JSON.stringify({ newsletters: merged }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: any) {
    console.error('[fetch-gmail-newsletters] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to fetch newsletters', details: error?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
