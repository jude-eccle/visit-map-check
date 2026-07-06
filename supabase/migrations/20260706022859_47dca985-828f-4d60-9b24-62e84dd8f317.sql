
-- Enums
CREATE TYPE public.pin_status AS ENUM ('done', 'gift', 'refuse', 'away', 'skip');

-- Maps
CREATE TABLE public.maps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[0-9]{4}$'),
  name TEXT NOT NULL,
  image_path TEXT,
  total_houses INTEGER NOT NULL DEFAULT 30 CHECK (total_houses >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maps TO anon, authenticated;
GRANT ALL ON public.maps TO service_role;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read maps" ON public.maps FOR SELECT USING (true);
CREATE POLICY "public insert maps" ON public.maps FOR INSERT WITH CHECK (true);
CREATE POLICY "public update maps" ON public.maps FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete maps" ON public.maps FOR DELETE USING (true);

-- Pins
CREATE TABLE public.pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  x_pct DOUBLE PRECISION NOT NULL CHECK (x_pct >= 0 AND x_pct <= 100),
  y_pct DOUBLE PRECISION NOT NULL CHECK (y_pct >= 0 AND y_pct <= 100),
  status public.pin_status NOT NULL,
  team_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pins_map_id_idx ON public.pins(map_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pins TO anon, authenticated;
GRANT ALL ON public.pins TO service_role;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read pins" ON public.pins FOR SELECT USING (true);
CREATE POLICY "public insert pins" ON public.pins FOR INSERT WITH CHECK (true);
CREATE POLICY "public delete pins" ON public.pins FOR DELETE USING (true);

-- Support requests
CREATE TABLE public.support_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX support_requests_map_id_idx ON public.support_requests(map_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_requests TO anon, authenticated;
GRANT ALL ON public.support_requests TO service_role;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read support" ON public.support_requests FOR SELECT USING (true);
CREATE POLICY "public insert support" ON public.support_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "public update support" ON public.support_requests FOR UPDATE USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.maps;

-- Seed one sample map
INSERT INTO public.maps (code, name, total_houses) VALUES ('1234', '샘플 마을', 30);
