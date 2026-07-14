-- Zone activity per-team tracking
CREATE TABLE IF NOT EXISTS public.zone_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS zone_activity_zone_active_idx
  ON public.zone_activity(zone_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS zone_activity_map_idx
  ON public.zone_activity(map_id);
CREATE INDEX IF NOT EXISTS zone_activity_team_idx
  ON public.zone_activity(team_name);

GRANT SELECT, INSERT, UPDATE ON public.zone_activity TO anon, authenticated;
GRANT ALL ON public.zone_activity TO service_role;

ALTER TABLE public.zone_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read zone_activity" ON public.zone_activity;
CREATE POLICY "public read zone_activity" ON public.zone_activity
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "public insert zone_activity" ON public.zone_activity;
CREATE POLICY "public insert zone_activity" ON public.zone_activity
  FOR INSERT WITH CHECK (
    map_id IS NOT NULL
    AND zone_id IS NOT NULL
    AND char_length(btrim(team_name)) BETWEEN 1 AND 100
    AND ended_at IS NULL
  );

DROP POLICY IF EXISTS "public update zone_activity" ON public.zone_activity;
CREATE POLICY "public update zone_activity" ON public.zone_activity
  FOR UPDATE USING (true) WITH CHECK (true);

-- Storage policies for handoff photos (path: handoff-photos/{mapId}/{zoneId}/...)
DROP POLICY IF EXISTS "public insert handoff photos" ON storage.objects;
CREATE POLICY "public insert handoff photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'map-images'
    AND split_part(name, '/', 1) = 'handoff-photos'
    AND EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id::text = split_part(name, '/', 2)
    )
  );
