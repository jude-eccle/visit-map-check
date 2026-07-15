
DROP POLICY IF EXISTS "public insert map images" ON storage.objects;
DROP POLICY IF EXISTS "public update map images" ON storage.objects;
DROP POLICY IF EXISTS "public delete map images" ON storage.objects;

DROP POLICY IF EXISTS "public insert handoff photos" ON storage.objects;

CREATE POLICY "public insert handoff photos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'map-images'
  AND split_part(objects.name, '/', 1) = 'handoff-photos'
  AND EXISTS (
    SELECT 1 FROM public.maps m
    WHERE m.id::text = split_part(objects.name, '/', 2)
  )
);
