
CREATE TABLE public.team_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 50),
  order_idx integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_names TO anon, authenticated;
GRANT ALL ON public.team_names TO service_role;

ALTER TABLE public.team_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_names public read" ON public.team_names FOR SELECT USING (true);
CREATE POLICY "team_names public insert" ON public.team_names FOR INSERT WITH CHECK (char_length(name) BETWEEN 1 AND 50);
CREATE POLICY "team_names public update" ON public.team_names FOR UPDATE USING (true) WITH CHECK (char_length(name) BETWEEN 1 AND 50);
CREATE POLICY "team_names public delete" ON public.team_names FOR DELETE USING (true);

CREATE TRIGGER touch_team_names_updated
  BEFORE UPDATE ON public.team_names
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_names;

INSERT INTO public.team_names (name, order_idx)
SELECT (i::text || '조'), i FROM generate_series(1, 16) AS i
ON CONFLICT (name) DO NOTHING;
