
CREATE TABLE public.known_newsletter_senders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_name TEXT NOT NULL UNIQUE,
  from_full TEXT,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.known_newsletter_senders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read known senders"
  ON public.known_newsletter_senders FOR SELECT USING (true);

CREATE POLICY "Anyone can insert known senders"
  ON public.known_newsletter_senders FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update known senders"
  ON public.known_newsletter_senders FOR UPDATE USING (true);
