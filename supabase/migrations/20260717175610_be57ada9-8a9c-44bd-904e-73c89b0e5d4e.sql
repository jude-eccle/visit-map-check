
DROP POLICY IF EXISTS "public insert handoff photos" ON storage.objects;

CREATE POLICY "public insert handoff photos"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'map-images'
  AND split_part(name, '/', 1) = 'handoff-photos'
  AND split_part(name, '/', 3) <> ''
  AND EXISTS (
    SELECT 1 FROM public.maps m
    WHERE m.id::text = split_part(storage.objects.name, '/', 2)
  )
);
