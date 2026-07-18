
DROP POLICY IF EXISTS "public update event decided" ON public.zone_events;
CREATE POLICY "public update event decided" ON public.zone_events
  FOR UPDATE
  USING (source = 'app' AND created_at > now() - interval '1 hour')
  WITH CHECK (source = 'app');
