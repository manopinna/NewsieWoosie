DROP POLICY IF EXISTS "Anyone can read subscriptions" ON public.daily_email_subscriptions;
DROP POLICY IF EXISTS "Anyone can update subscriptions" ON public.daily_email_subscriptions;

REVOKE SELECT, UPDATE ON public.daily_email_subscriptions FROM anon, authenticated;

CREATE POLICY "Service role can read subscriptions"
  ON public.daily_email_subscriptions FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can update subscriptions"
  ON public.daily_email_subscriptions FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);