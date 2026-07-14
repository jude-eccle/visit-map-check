
DROP POLICY IF EXISTS "public update assignments status" ON public.assignments;

CREATE POLICY "public update assignments status"
  ON public.assignments FOR UPDATE
  USING (map_id IS NOT NULL)
  WITH CHECK (
    map_id IS NOT NULL
    AND status IN ('pending','acknowledged','superseded','cancelled')
  );
