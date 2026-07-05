// Edge function: summarize-articles
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req: Request) => {
  console.log('[summarize-articles] invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { articles, format = 'audio' } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

    if (!articles || articles.length === 0) {
      return new Response(JSON.stringify({ summary: 'No articles to summarize.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const articleList = articles
      .map(
        (a: any, i: number) =>
          `Article ${i + 1}: "${a.title}" (${a.source})\nDescription: ${a.description}\nURL: ${a.url}`,
      )
      .join('\n\n')

    // Build today's date in the required format: "Month Day(ordinal)" e.g. "April 26th"
    const now = new Date()
    const monthName = now.toLocaleString('en-US', { month: 'long', timeZone: 'America/New_York' })
    const dayNum = parseInt(now.toLocaleString('en-US', { day: 'numeric', timeZone: 'America/New_York' }), 10)
    const ordinal = (n: number) => {
      const s = ['th', 'st', 'nd', 'rd']
      const v = n % 100
      return n + (s[(v - 20) % 10] || s[v] || s[0])
    }
    const formattedDate = `${monthName} ${ordinal(dayNum)}`

    const audioPrompt = `You are a sharp, witty news podcast host. Transform news articles into a conversational, audio-ready script that sounds like you're explaining the news to a smart friend over coffee.

COVERAGE (CRITICAL):
- Cover EVERY article provided in the input. Do not skip or merge stories.
- There is NO length cap — let the script run as long as needed to cover all sources and articles.
- Keep each story tight: 2-4 short sentences plus a one-line takeaway. Trim filler, but never drop coverage.
- If a single headline contains multiple distinct stories (common with NPR — separators like " ; ", " | ", " — ", " and ", " & ", " / "), treat each story as its own segment with its own explanation and its own takeaway. Never combine them into one shared takeaway.

VOICE & TONE:
- Smart, casual, and slightly witty
- Warm, composed, analytical — like a NYC media insider
- Light humor is encouraged but keep it subtle and professional
- Use contractions freely (it's, they're, wouldn't, etc.)
- Short, punchy sentences. No jargon or overly formal phrasing.

STRUCTURE:
- ALWAYS start with this EXACT opening line, word-for-word, no variations: "Hi, hope you're having a great day! Here's your daily news round up for ${formattedDate}."
- After the opening line, insert [beat] then transition smoothly into the first story
- Move quickly between stories
- For each story:
  • Give a simple, clear explanation of what happened
  • Follow with a sharp, insightful takeaway — but do NOT label it "The takeaway" or "Key takeaway" every time
  • Instead, weave the insight naturally using phrases like:
    - "Here's the thing —"
    - "So what does this actually mean?"
    - "Why does this matter?"
    - "Here's where things get interesting."
    - "The bigger picture here is..."
    - "Translation:"
    - "Bottom line:"
  • Vary these across stories. Never repeat the same framing twice.

TRANSITIONS:
- Use natural transitions between stories. Examples:
  - "Meanwhile…"
  - "Back in the U.S.…"
  - "On the business side…"
  - "Switching gears…"
  - "Now this one's interesting —"
  - "Over in [place]…"
  - "And speaking of [topic]…"

AUDIO FORMATTING:
- Insert [beat] between stories for a brief pause (keep it short — we want quick pacing)
- Use [short pause] sparingly, only before a key punchline
- Keep pacing brisk and energetic — this should feel snappy at 1x and still listenable at 1.5x speed
- End with a brief, casual sign-off like "That's your rundown. Stay sharp." or "And that's the news. Have a good one." (vary this)

CRITICAL RULES:
- Always include specific names of companies, people, and places
- Make complex topics feel simple and digestible
- Add light commentary or framing without being opinionated
- Each story segment should feel slightly different in structure — avoid formulaic repetition
- No bullet points, no emoji, no markdown formatting — this is a spoken script
- Group stories by source but transition naturally (don't announce "From The Wall Street Journal..." robotically — instead say something like "The Journal is reporting that..." or "Over at the WSJ...")
- Do NOT include any intro like "Here are your articles" or meta-commentary about the format`

    const textPrompt = `You are a concise news analyst. Summarize news articles in a clean, structured format for reading.

FORMAT — For each source, output exactly this structure:

📰 [Source Name]

For each article under that source:
• [Headline]
URL: [the exact article URL provided in the input]
Context: [1-2 sentence explanation of what happened, including specific names, companies, places]
Takeaway: [1 sentence insight on why this matters]

RULES:
- Group articles by source
- Use the exact format above with • for headlines, "Context:" and "Takeaway:" labels
- Keep it factual and concise
- Include specific names, numbers, and details
- Each article should have exactly one URL line, one Context line and one Takeaway line
- The URL must be copied verbatim from the input — do not invent, shorten, or modify URLs
- CRITICAL: Many sources (especially NPR) combine multiple unrelated stories into a single headline using separators like " ; ", " | ", " — ", " and ", " & ", or " / " (e.g. "Trump signs trade deal; California wildfires worsen"). Whenever a headline contains two or more distinct stories, you MUST split it into separate bullet entries — one bullet per story. Each split bullet gets its own • headline (rewrite it to reflect just that single story), the SAME URL copied verbatim from the input, its own Context line, and its own Takeaway line. Never combine multiple stories into one shared takeaway under any circumstance.
- Do NOT include any intro or conclusion text
- Do NOT use markdown formatting like ** or ## — just plain text with the structure above
- Separate source groups with a blank line`

    const systemPrompt = format === 'text' ? textPrompt : audioPrompt
    const userMessage = format === 'text'
      ? `Here are today's top articles:\n\n${articleList}\n\nSummarize these in the structured headline/context/takeaway format.`
      : `Here are today's top articles:\n\n${articleList}\n\nTransform these into a conversational podcast-style news script ready for audio recording.`

    console.log('[summarize-articles] Calling AI gateway, format:', format)

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        max_tokens: 16000,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[summarize-articles] AI gateway error:', response.status, errText)
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again shortly.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`AI gateway error: ${response.status}`)
    }

    const data = await response.json()
    const summary = data.choices?.[0]?.message?.content || 'Failed to generate script.'
    console.log('[summarize-articles] Summary generated, format:', format, 'length:', summary.length)

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    console.error('[summarize-articles] Error:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
