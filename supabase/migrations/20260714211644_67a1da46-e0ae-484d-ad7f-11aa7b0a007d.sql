
-- 1. Add status column
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

-- 2. Backfill from legacy acknowledged column if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='assignments' AND column_name='acknowledged'
  ) THEN
    UPDATE public.assignments
      SET status = CASE WHEN acknowledged THEN 'acknowledged' ELSE 'pending' END;
    ALTER TABLE public.assignments DROP COLUMN acknowledged;
  END IF;
END $$;

-- 3. Constrain values
ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS assignments_status_check;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_status_check
  CHECK (status IN ('pending','acknowledged','superseded','cancelled'));

CREATE INDEX IF NOT EXISTS assignments_team_status_idx
  ON public.assignments (team_name, status);
CREATE INDEX IF NOT EXISTS assignments_map_status_idx
  ON public.assignments (map_id, status);

-- 4. Trigger: when a new pending assignment lands for a team, mark previous
--    active assignments (pending/acknowledged) for that team as superseded.
CREATE OR REPLACE FUNCTION public.assignments_supersede_previous()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    UPDATE public.assignments
      SET status = 'superseded'
    WHERE team_name = NEW.team_name
      AND id <> NEW.id
      AND status IN ('pending','acknowledged');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assignments_supersede_previous_trg ON public.assignments;
CREATE TRIGGER assignments_supersede_previous_trg
  AFTER INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.assignments_supersede_previous();

-- 5. Refresh RLS policies to use status
DROP POLICY IF EXISTS "public insert assignments" ON public.assignments;
DROP POLICY IF EXISTS "public update assignments" ON public.assignments;
DROP POLICY IF EXISTS "public delete assignments" ON public.assignments;

CREATE POLICY "public insert assignments"
  ON public.assignments FOR INSERT
  WITH CHECK (
    map_id IS NOT NULL
    AND char_length(btrim(team_name)) BETWEEN 1 AND 100
    AND status = 'pending'
  );

-- Only allow status transitions (no rewriting team_name/map_id)
CREATE POLICY "public update assignments status"
  ON public.assignments FOR UPDATE
  USING (true)
  WITH CHECK (status IN ('pending','acknowledged','superseded','cancelled'));
