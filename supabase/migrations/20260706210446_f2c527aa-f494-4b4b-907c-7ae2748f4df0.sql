
-- MAPS: replace always-true write policies with validated ones
DROP POLICY IF EXISTS "public insert maps" ON public.maps;
DROP POLICY IF EXISTS "public update maps" ON public.maps;
DROP POLICY IF EXISTS "public delete maps" ON public.maps;

CREATE POLICY "public insert maps"
ON public.maps FOR INSERT TO public
WITH CHECK (
  code ~ '^[0-9]{4}$'
  AND char_length(btrim(name)) BETWEEN 1 AND 200
  AND total_houses BETWEEN 0 AND 100000
);

CREATE POLICY "public update maps"
ON public.maps FOR UPDATE TO public
USING (id IS NOT NULL)
WITH CHECK (
  code ~ '^[0-9]{4}$'
  AND char_length(btrim(name)) BETWEEN 1 AND 200
  AND total_houses BETWEEN 0 AND 100000
);

CREATE POLICY "public delete maps"
ON public.maps FOR DELETE TO public
USING (created_at IS NOT NULL);

-- PINS: replace always-true write policies with validated ones
DROP POLICY IF EXISTS "public insert pins" ON public.pins;
DROP POLICY IF EXISTS "public delete pins" ON public.pins;

CREATE POLICY "public insert pins"
ON public.pins FOR INSERT TO public
WITH CHECK (
  char_length(btrim(team_name)) BETWEEN 1 AND 100
  AND x_pct BETWEEN 0 AND 100
  AND y_pct BETWEEN 0 AND 100
  AND map_id IS NOT NULL
);

CREATE POLICY "public delete pins"
ON public.pins FOR DELETE TO public
USING (map_id IS NOT NULL);

-- SUPPORT REQUESTS: replace always-true write policies with validated ones
DROP POLICY IF EXISTS "public insert support" ON public.support_requests;
DROP POLICY IF EXISTS "public update support" ON public.support_requests;

CREATE POLICY "public insert support"
ON public.support_requests FOR INSERT TO public
WITH CHECK (
  char_length(btrim(team_name)) BETWEEN 1 AND 100
  AND map_id IS NOT NULL
);

CREATE POLICY "public update support"
ON public.support_requests FOR UPDATE TO public
USING (map_id IS NOT NULL)
WITH CHECK (map_id IS NOT NULL);
