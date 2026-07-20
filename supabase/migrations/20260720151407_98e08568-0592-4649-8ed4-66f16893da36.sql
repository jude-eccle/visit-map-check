CREATE POLICY "public delete zone_activity" ON public.zone_activity FOR DELETE USING (map_id IS NOT NULL AND zone_id IS NOT NULL);
GRANT DELETE ON public.zone_activity TO anon, authenticated;