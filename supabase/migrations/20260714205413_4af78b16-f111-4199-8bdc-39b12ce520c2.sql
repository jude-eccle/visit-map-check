
-- MAPS: remove public write policies; only service role (server admin fns) can write
DROP POLICY IF EXISTS "public insert maps" ON public.maps;
DROP POLICY IF EXISTS "public update maps" ON public.maps;
DROP POLICY IF EXISTS "public delete maps" ON public.maps;
REVOKE INSERT, UPDATE, DELETE ON public.maps FROM anon, authenticated;

-- TEAM_NAMES: remove public write policies (were USING true)
DROP POLICY IF EXISTS "team_names public insert" ON public.team_names;
DROP POLICY IF EXISTS "team_names public update" ON public.team_names;
DROP POLICY IF EXISTS "team_names public delete" ON public.team_names;
REVOKE INSERT, UPDATE, DELETE ON public.team_names FROM anon, authenticated;

-- ZONES: only status column is publicly updatable; insert/delete admin-only
DROP POLICY IF EXISTS "public insert zones" ON public.zones;
DROP POLICY IF EXISTS "public delete zones" ON public.zones;
DROP POLICY IF EXISTS "public update zones" ON public.zones;
REVOKE INSERT, UPDATE, DELETE ON public.zones FROM anon, authenticated;
GRANT UPDATE (status) ON public.zones TO anon, authenticated;
CREATE POLICY "public update zone status"
  ON public.zones FOR UPDATE
  TO anon, authenticated
  USING (map_id IS NOT NULL)
  WITH CHECK (map_id IS NOT NULL AND status IN ('unvisited','visiting','completed'));
