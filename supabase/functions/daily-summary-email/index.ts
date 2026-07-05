// Edge function: daily-summary-email
// - subscribe action: upserts an email + the user's latest preferences
//   (selected source IDs + Gmail newsletter senders) so the next daily run
//   reflects their latest selections.
// - default (cron) action: groups active subscribers by their preference
//   signature, generates one summary per group, and sends one email per
//   recipient per day (idempotency key: daily-summary-<date>-<recipient>).
import { createClient } from 'npm:@supabase/supabase-js@2'

const FALLBACK_RECIPIENT = 'manopinna12@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const KNOWN_SOURCE_IDS = new Set(['nyt', 'foxsports', 'cricinfo', 'ft'])

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out = new Set<string>()
  for (const v of value) {
    if (typeof v === 'string') {
      const t = v.trim()
      if (t) out.add(t)
    }
  }
  return Array.from(out).sort()
}

function estimateDuration(text: string): string {
  const words = text.split(' ').length
  const minutes = Math.ceil(words / 150)
  const seconds = Math.floor((words % 150) / 2.5)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  // Publishable (anon JWT) key for inter-function HTTP calls.
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdGpyZHNrYXRpZnZvbnl6dmZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1Nzc4ODAsImV4cCI6MjA4NjE1Mzg4MH0.Trroe8WUj3zfkky2K0wKIOGdhxv54oFAYe6KDRFH3aI'
  const supabase = createClient(supabaseUrl, serviceKey)

  const invokeHeaders = {
    'Content-Type': 'application/json',
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  }

  try {
    const requestBody = req.method === 'POST'
      ? await req.json().catch(() => ({}))
      : {}

    // ---- Subscribe / update preferences --------------------------------
    if (requestBody?.action === 'subscribe') {
      const email = normalizeEmail(requestBody.email)
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Invalid email' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const sourceIds = normalizeStringArray(requestBody.sourceIds)
        .filter((id) => KNOWN_SOURCE_IDS.has(id))
      const newsletterSenders = normalizeStringArray(requestBody.newsletterSenders)

      // Upsert on email — one row per address, latest preferences win.
      const { error } = await supabase
        .from('daily_email_subscriptions')
        .upsert(
          {
            email,
            active: true,
            source_ids: sourceIds,
            newsletter_senders: newsletterSenders,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'email' }
        )

      if (error) throw new Error(`subscribe failed: ${error.message}`)

      return new Response(
        JSON.stringify({ success: true, email, sourceIds, newsletterSenders }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ---- Daily run ------------------------------------------------------
    console.log('[daily-summary-email] starting daily run')

    const { data: subs, error: subsErr } = await supabase
      .from('daily_email_subscriptions')
      .select('email, source_ids, newsletter_senders')
      .eq('active', true)
    if (subsErr) throw new Error(`fetch subscribers failed: ${subsErr.message}`)

    // Always include the fallback recipient as a safety net (with default prefs).
    type Sub = { email: string; sourceIds: string[]; newsletterSenders: string[] }
    const subsByEmail = new Map<string, Sub>()
    for (const s of subs || []) {
      const email = normalizeEmail((s as any).email)
      if (!email) continue
      subsByEmail.set(email, {
        email,
        sourceIds: normalizeStringArray((s as any).source_ids).filter((id) => KNOWN_SOURCE_IDS.has(id)),
        newsletterSenders: normalizeStringArray((s as any).newsletter_senders),
      })
    }
    if (!subsByEmail.has(FALLBACK_RECIPIENT)) {
      subsByEmail.set(FALLBACK_RECIPIENT, { email: FALLBACK_RECIPIENT, sourceIds: ['nyt'], newsletterSenders: [] })
    }

    // Group subscribers by preference signature so we summarize once per group.
    type Group = { sourceIds: string[]; newsletterSenders: string[]; recipients: string[] }
    const groups = new Map<string, Group>()
    for (const sub of subsByEmail.values()) {
      const sig = JSON.stringify([sub.sourceIds, sub.newsletterSenders])
      const g = groups.get(sig) || { sourceIds: sub.sourceIds, newsletterSenders: sub.newsletterSenders, recipients: [] }
      g.recipients.push(sub.email)
      groups.set(sig, g)
    }
    console.log(`[daily-summary-email] ${subsByEmail.size} subscribers in ${groups.size} groups`)

    const dateKey = new Date().toISOString().slice(0, 10)
    const siteOrigin = Deno.env.get('PUBLIC_SITE_URL') || 'https://podcastify.lovable.app'

    // Source fetch helpers
    const fetchFromFn = async (fn: string) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'POST', headers: invokeHeaders, body: '{}',
        })
        if (!res.ok) return []
        const data = await res.json()
        return data?.articles || []
      } catch (e) {
        console.warn(`fetch ${fn} failed`, e)
        return []
      }
    }
    const fetchNewsletter = async (sender: string) => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/fetch-newsletter-content`, {
          method: 'POST', headers: invokeHeaders, body: JSON.stringify({ sender_name: sender }),
        })
        if (!res.ok) return []
        const data = await res.json()
        return data?.articles || []
      } catch (e) {
        console.warn('newsletter fetch failed', sender, e)
        return []
      }
    }

    let totalSent = 0
    const groupResults: any[] = []

    for (const group of groups.values()) {
      try {
        // 1. Fetch articles for this group's sources
        const sourceFetches: Promise<any[]>[] = []
        const sourceLabels: string[] = []
        for (const id of group.sourceIds) {
          if (id === 'nyt') { sourceFetches.push(fetchFromFn('fetch-nyt')); sourceLabels.push('New York Times') }
          else if (id === 'foxsports') { sourceFetches.push(fetchFromFn('fetch-foxsports')); sourceLabels.push('Fox Sports') }
          else if (id === 'cricinfo') { sourceFetches.push(fetchFromFn('fetch-cricinfo')); sourceLabels.push('ESPNcricinfo') }
          else if (id === 'ft') { sourceFetches.push(fetchFromFn('fetch-ft')); sourceLabels.push('Financial Times') }
        }
        const newsletterFetches = group.newsletterSenders.map((s) => fetchNewsletter(s))
        const [sourceArticleArrays, newsletterArticleArrays] = await Promise.all([
          Promise.all(sourceFetches),
          Promise.all(newsletterFetches),
        ])
        const allArticles = [...sourceArticleArrays.flat(), ...newsletterArticleArrays.flat()]
        if (allArticles.length === 0) {
          console.warn('[daily-summary-email] no articles for group', group.recipients)
          groupResults.push({ recipients: group.recipients, ok: false, reason: 'no articles' })
          continue
        }

        // 2. Generate audio + text summaries in parallel
        const summarize = async (format: 'audio' | 'text') => {
          const res = await fetch(`${supabaseUrl}/functions/v1/summarize-articles`, {
            method: 'POST', headers: invokeHeaders,
            body: JSON.stringify({ articles: allArticles, format }),
          })
          if (!res.ok) throw new Error(`summarize ${format} failed: ${res.status}`)
          const data = await res.json()
          return data?.summary || ''
        }
        const [audioContent, textContent] = await Promise.all([summarize('audio'), summarize('text')])
        const duration = estimateDuration(audioContent)

        // 3. TTS + upload
        let audioUrl: string | null = null
        try {
          const ttsRes = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-tts`, {
            method: 'POST', headers: invokeHeaders, body: JSON.stringify({ text: audioContent }),
          })
          if (ttsRes.ok) {
            const audioBlob = new Uint8Array(await ttsRes.arrayBuffer())
            if (audioBlob.byteLength > 0) {
              const fileName = `${crypto.randomUUID()}.mp3`
              const { error: uploadErr } = await supabase.storage
                .from('podcast-audio')
                .upload(fileName, audioBlob, { contentType: 'audio/mpeg', upsert: false })
              if (!uploadErr) {
                const { data: pub } = supabase.storage.from('podcast-audio').getPublicUrl(fileName)
                audioUrl = pub.publicUrl
              } else {
                console.error('audio upload failed', uploadErr)
              }
            }
          } else {
            console.error('TTS failed', ttsRes.status)
          }
        } catch (e) {
          console.error('TTS error', e)
        }

        // 4. Persist summary
        const summaryId = crypto.randomUUID()
        const title = `Daily Brief - ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}`
        const sources = [...sourceLabels, ...group.newsletterSenders]
        const { error: insertErr } = await supabase.from('podcast_summaries').insert({
          id: summaryId, title, text_content: textContent, audio_url: audioUrl, duration, sources,
        })
        if (insertErr) throw new Error(`persist failed: ${insertErr.message}`)
        const listenUrl = `${siteOrigin}/listen/${summaryId}`

        // 5. Send to each recipient (idempotency key keeps it to one per day per address)
        const sendResults = await Promise.all(
          group.recipients.map(async (recipient) => {
            try {
              const res = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
                method: 'POST', headers: invokeHeaders,
                body: JSON.stringify({
                  templateName: 'podcast-summary',
                  recipientEmail: recipient,
                  idempotencyKey: `daily-summary-${dateKey}-${recipient}`,
                  templateData: { title, textContent, listenUrl, duration },
                }),
              })
              if (!res.ok) {
                const errText = await res.text()
                console.error(`email send failed for ${recipient}: ${res.status} ${errText}`)
                return false
              }
              return true
            } catch (e) {
              console.error(`email send exception for ${recipient}`, e)
              return false
            }
          })
        )
        const sentCount = sendResults.filter(Boolean).length
        totalSent += sentCount
        groupResults.push({ recipients: group.recipients, summaryId, sentCount, ok: true })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error('[daily-summary-email] group failed', group.recipients, msg)
        groupResults.push({ recipients: group.recipients, ok: false, reason: msg })
      }
    }

    console.log('[daily-summary-email] done', { totalSent, groups: groupResults.length })
    return new Response(
      JSON.stringify({ success: true, totalSent, groups: groupResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[daily-summary-email] error', msg)
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
