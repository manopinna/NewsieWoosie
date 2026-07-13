ALTER TABLE public.podcast_summaries
  ADD COLUMN IF NOT EXISTS tts_chars integer,
  ADD COLUMN IF NOT EXISTS script_chars integer;