CREATE TABLE public.daily_email_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_email_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe"
ON public.daily_email_subscriptions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read subscriptions"
ON public.daily_email_subscriptions
FOR SELECT
USING (true);

CREATE INDEX idx_daily_email_subs_active ON public.daily_email_subscriptions(active) WHERE active = true;