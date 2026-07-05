// Edge function: elevenlabs-tts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Rachel - calm, warm female voice (ElevenLabs default)
const RACHEL_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

Deno.serve(async (req: Request) => {
  console.log('[elevenlabs-tts] invoked', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, voiceId } = await req.json()
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY')

    if (!ELEVENLABS_API_KEY) {
      console.error('[elevenlabs-tts] API key not found')
      return new Response(JSON.stringify({ error: 'ElevenLabs API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Convert pause markers into natural speech pauses using punctuation
    // Em-dashes and ellipses give ElevenLabs a more natural prosodic break than literal dots
    const cleanedText = text
      .replace(/\[beat\]/gi, ' — ')
      .replace(/\[short pause\]/gi, ', ')
      .replace(/\[pause\]/gi, ' — ')

    const selectedVoiceId = voiceId || RACHEL_VOICE_ID
    console.log(`[elevenlabs-tts] Generating for ${cleanedText.length} chars, voice ${selectedVoiceId}`)

    // ElevenLabs caps a single request at ~5000 chars. Split long scripts into
    // chunks at sentence boundaries and concatenate the resulting MP3 segments
    // (MP3 frames concatenate cleanly, so this plays as one continuous file).
    const MAX_CHUNK = 4500
    const chunkText = (input: string): string[] => {
      if (input.length <= MAX_CHUNK) return [input]
      const sentences = input.match(/[^.!?\n]+[.!?]+(\s+|$)|[^.!?\n]+$/g) || [input]
      const chunks: string[] = []
      let current = ''
      for (const s of sentences) {
        if ((current + s).length > MAX_CHUNK) {
          if (current) chunks.push(current)
          if (s.length > MAX_CHUNK) {
            // Hard-split a single huge "sentence"
            for (let i = 0; i < s.length; i += MAX_CHUNK) {
              chunks.push(s.slice(i, i + MAX_CHUNK))
            }
            current = ''
          } else {
            current = s
          }
        } else {
          current += s
        }
      }
      if (current) chunks.push(current)
      return chunks
    }

    const chunks = chunkText(cleanedText)
    console.log(`[elevenlabs-tts] Split into ${chunks.length} chunk(s)`)

    // Strip ID3v2 + Xing/Info VBR header frame so concatenated MP3 chunks
    // report correct total duration in browsers (Xing header from chunk 1 only
    // describes chunk 1's frame count, which makes <audio>.duration too short).
    const stripMp3Headers = (buf: Uint8Array): Uint8Array => {
      let offset = 0
      // ID3v2 tag (synchsafe size)
      if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
        const size =
          ((buf[6] & 0x7f) << 21) |
          ((buf[7] & 0x7f) << 14) |
          ((buf[8] & 0x7f) << 7) |
          (buf[9] & 0x7f)
        offset = 10 + size
      }
      // Find first MPEG audio frame sync (0xFFE_)
      while (
        offset < buf.length - 1 &&
        !(buf[offset] === 0xff && (buf[offset + 1] & 0xe0) === 0xe0)
      ) {
        offset++
      }
      // Detect Xing/Info tag inside the first frame and skip it
      const windowEnd = Math.min(offset + 200, buf.length - 4)
      let hasXing = false
      for (let i = offset; i < windowEnd; i++) {
        const a = buf[i], b = buf[i + 1], c = buf[i + 2], d = buf[i + 3]
        if (
          (a === 0x58 && b === 0x69 && c === 0x6e && d === 0x67) || // "Xing"
          (a === 0x49 && b === 0x6e && c === 0x66 && d === 0x6f)    // "Info"
        ) {
          hasXing = true
          break
        }
      }
      if (hasXing) {
        let next = offset + 4
        while (
          next < buf.length - 1 &&
          !(buf[next] === 0xff && (buf[next + 1] & 0xe0) === 0xe0)
        ) {
          next++
        }
        offset = next
      }
      return offset > 0 ? buf.slice(offset) : buf
    }

    const buffers: Uint8Array[] = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const previous_text = i > 0 ? chunks[i - 1].slice(-300) : undefined
      const next_text = i < chunks.length - 1 ? chunks[i + 1].slice(0, 300) : undefined

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: chunk,
            model_id: 'eleven_turbo_v2_5',
            previous_text,
            next_text,
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.85,
              style: 0.35,
              use_speaker_boost: true,
              speed: 1.1,
            },
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[elevenlabs-tts] Chunk ${i + 1}/${chunks.length} error:`, response.status, errorText)
        return new Response(JSON.stringify({ error: `ElevenLabs API error: ${response.status}` }), {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const raw = new Uint8Array(await response.arrayBuffer())
      const buf = stripMp3Headers(raw)
      buffers.push(buf)
      console.log(`[elevenlabs-tts] Chunk ${i + 1}/${chunks.length}: ${raw.byteLength} -> ${buf.byteLength} bytes`)
    }

    const totalLen = buffers.reduce((n, b) => n + b.byteLength, 0)
    const merged = new Uint8Array(totalLen)
    let offset = 0
    for (const b of buffers) {
      merged.set(b, offset)
      offset += b.byteLength
    }
    console.log(`[elevenlabs-tts] Merged ${buffers.length} chunk(s) into ${totalLen} bytes`)

    return new Response(merged, {
      headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg' },
    })
  } catch (error: any) {
    console.error('[elevenlabs-tts] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate audio', details: error?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
