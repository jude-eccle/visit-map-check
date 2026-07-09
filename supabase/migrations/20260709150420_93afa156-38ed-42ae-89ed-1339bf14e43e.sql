
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name text NOT NULL,
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);

CREATE INDEX assignments_team_pending_idx ON public.assignments (team_name, acknowledged, assigned_at DESC);
CREATE INDEX assignments_map_idx ON public.assignments (map_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO anon, authenticated;
GRANT ALL ON public.assignments TO service_role;

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read assignments" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "public insert assignments" ON public.assignments FOR INSERT WITH CHECK (map_id IS NOT NULL AND char_length(btrim(team_name)) >= 1);
CREATE POLICY "public update assignments" ON public.assignments FOR UPDATE USING (map_id IS NOT NULL) WITH CHECK (map_id IS NOT NULL);
CREATE POLICY "public delete assignments" ON public.assignments FOR DELETE USING (map_id IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
