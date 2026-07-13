
-- 1) Handoffs: replace always-true policies with validated ones
DROP POLICY IF EXISTS "public insert handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "public update handoffs" ON public.handoffs;
DROP POLICY IF EXISTS "public delete handoffs" ON public.handoffs;

CREATE POLICY "public insert handoffs" ON public.handoffs
  FOR INSERT TO public
  WITH CHECK (
    map_id IS NOT NULL
    AND zone_id IS NOT NULL
    AND kind IN ('complete', 'handoff')
    AND char_length(btrim(team_name)) BETWEEN 1 AND 100
    AND char_length(note) <= 2000
  );

CREATE POLICY "public update handoffs" ON public.handoffs
  FOR UPDATE TO public
  USING (map_id IS NOT NULL)
  WITH CHECK (
    map_id IS NOT NULL
    AND zone_id IS NOT NULL
    AND kind IN ('complete', 'handoff')
    AND char_length(btrim(team_name)) BETWEEN 1 AND 100
    AND char_length(note) <= 2000
  );

CREATE POLICY "public delete handoffs" ON public.handoffs
  FOR DELETE TO public
  USING (map_id IS NOT NULL);

-- 2) Map images storage: scope to existing maps, and add UPDATE policy
DROP POLICY IF EXISTS "public insert map images" ON storage.objects;
DROP POLICY IF EXISTS "public delete map images" ON storage.objects;
DROP POLICY IF EXISTS "public update map images" ON storage.objects;

CREATE POLICY "public insert map images" ON storage.objects
  FOR INSERT TO public
  WITH CHECK (
    bucket_id = 'map-images'
    AND EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "public update map images" ON storage.objects
  FOR UPDATE TO public
  USING (
    bucket_id = 'map-images'
    AND EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  WITH CHECK (
    bucket_id = 'map-images'
    AND EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

CREATE POLICY "public delete map images" ON storage.objects
  FOR DELETE TO public
  USING (
    bucket_id = 'map-images'
    AND EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id::text = split_part(storage.objects.name, '/', 1)
    )
  );
