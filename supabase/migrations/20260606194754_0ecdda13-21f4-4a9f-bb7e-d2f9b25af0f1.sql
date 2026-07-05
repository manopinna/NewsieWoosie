ALTER TABLE public.daily_email_subscriptions
  ADD COLUMN IF NOT EXISTS source_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS newsletter_senders text[] NOT NULL DEFAULT '{}';

-- Allow upsert to update the preferences row
DROP POLICY IF EXISTS "Anyone can update subscriptions" ON public.daily_email_subscriptions;
CREATE POLICY "Anyone can update subscriptions"
  ON public.daily_email_subscriptions
  FOR UPDATE
  USING (true)
  WITH CHECK (true);