DROP POLICY IF EXISTS "public update zone status" ON public.zones;

CREATE POLICY "public update zone status"
ON public.zones
FOR UPDATE
TO anon, authenticated
USING (map_id IS NOT NULL)
WITH CHECK (
  map_id IS NOT NULL
  AND status = ANY (ARRAY['unvisited'::text, 'in_progress'::text, 'done'::text])
);