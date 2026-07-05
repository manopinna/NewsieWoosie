-- Public summaries table for hosted /listen/:id pages
CREATE TABLE public.podcast_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  text_content text NOT NULL,
  audio_url text,
  duration text,
  sources text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.podcast_summaries ENABLE ROW LEVEL SECURITY;

-- Public can read (so /listen/:id works without auth)
CREATE POLICY "Anyone can read summaries"
  ON public.podcast_summaries
  FOR SELECT
  USING (true);

-- Anyone can insert (no auth in app yet)
CREATE POLICY "Anyone can insert summaries"
  ON public.podcast_summaries
  FOR INSERT
  WITH CHECK (true);

-- Public storage bucket for audio MP3 files
INSERT INTO storage.buckets (id, name, public)
VALUES ('podcast-audio', 'podcast-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access to audio files
CREATE POLICY "Public can read podcast audio"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'podcast-audio');

-- Anyone can upload audio (no auth in app)
CREATE POLICY "Anyone can upload podcast audio"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'podcast-audio');