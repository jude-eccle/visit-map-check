
CREATE OR REPLACE FUNCTION public.assignments_close_activity_on_supersede()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'superseded' AND (OLD.status IS DISTINCT FROM 'superseded') THEN
    UPDATE public.zone_activity
      SET ended_at = now()
    WHERE team_name = NEW.team_name
      AND map_id = NEW.map_id
      AND ended_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assignments_close_activity_on_supersede() FROM PUBLIC, anon, authenticated;
