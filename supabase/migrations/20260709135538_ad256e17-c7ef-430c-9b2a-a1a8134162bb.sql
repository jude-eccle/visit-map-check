
-- Drop old pins table
DROP TABLE IF EXISTS public.pins CASCADE;

-- Zones
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '구역',
  x1_pct double precision NOT NULL,
  y1_pct double precision NOT NULL,
  x2_pct double precision NOT NULL,
  y2_pct double precision NOT NULL,
  status text NOT NULL DEFAULT 'unvisited' CHECK (status IN ('unvisited','in_progress','done')),
  order_idx integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zones TO anon, authenticated;
GRANT ALL ON public.zones TO service_role;
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read zones" ON public.zones FOR SELECT USING (true);
CREATE POLICY "public insert zones" ON public.zones FOR INSERT WITH CHECK (
  map_id IS NOT NULL
  AND x1_pct BETWEEN 0 AND 100 AND x2_pct BETWEEN 0 AND 100
  AND y1_pct BETWEEN 0 AND 100 AND y2_pct BETWEEN 0 AND 100
);
CREATE POLICY "public update zones" ON public.zones FOR UPDATE USING (map_id IS NOT NULL) WITH CHECK (
  x1_pct BETWEEN 0 AND 100 AND x2_pct BETWEEN 0 AND 100
  AND y1_pct BETWEEN 0 AND 100 AND y2_pct BETWEEN 0 AND 100
);
CREATE POLICY "public delete zones" ON public.zones FOR DELETE USING (map_id IS NOT NULL);

-- Zone events (each counter click)
CREATE TABLE public.zone_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('done','gift','away','other')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_events TO anon, authenticated;
GRANT ALL ON public.zone_events TO service_role;
ALTER TABLE public.zone_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read events" ON public.zone_events FOR SELECT USING (true);
CREATE POLICY "public insert events" ON public.zone_events FOR INSERT WITH CHECK (
  zone_id IS NOT NULL AND map_id IS NOT NULL
  AND char_length(btrim(team_name)) BETWEEN 1 AND 100
);
CREATE POLICY "public delete events" ON public.zone_events FOR DELETE USING (zone_id IS NOT NULL);

-- Zone completions (leader notifications)
CREATE TABLE public.zone_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  counters jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zone_completions TO anon, authenticated;
GRANT ALL ON public.zone_completions TO service_role;
ALTER TABLE public.zone_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read completions" ON public.zone_completions FOR SELECT USING (true);
CREATE POLICY "public insert completions" ON public.zone_completions FOR INSERT WITH CHECK (
  zone_id IS NOT NULL AND map_id IS NOT NULL
);
CREATE POLICY "public update completions" ON public.zone_completions FOR UPDATE USING (map_id IS NOT NULL) WITH CHECK (map_id IS NOT NULL);
CREATE POLICY "public delete completions" ON public.zone_completions FOR DELETE USING (map_id IS NOT NULL);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.zones;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_completions;

-- Auto-update updated_at on zones
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER zones_touch BEFORE UPDATE ON public.zones
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
