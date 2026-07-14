DROP POLICY IF EXISTS "public update zone_activity" ON public.zone_activity;
CREATE POLICY "public update zone_activity end" ON public.zone_activity
  FOR UPDATE USING (ended_at IS NULL)
  WITH CHECK (ended_at IS NOT NULL);
