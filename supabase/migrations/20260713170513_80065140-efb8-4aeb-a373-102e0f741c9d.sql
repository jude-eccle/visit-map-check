
CREATE TABLE public.handoffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('complete', 'handoff')),
  note TEXT NOT NULL DEFAULT '',
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX handoffs_zone_id_idx ON public.handoffs(zone_id);
CREATE INDEX handoffs_map_id_idx ON public.handoffs(map_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.handoffs TO anon, authenticated;
GRANT ALL ON public.handoffs TO service_role;
ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read handoffs" ON public.handoffs FOR SELECT USING (true);
CREATE POLICY "public insert handoffs" ON public.handoffs FOR INSERT WITH CHECK (true);
CREATE POLICY "public update handoffs" ON public.handoffs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete handoffs" ON public.handoffs FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.handoffs;
