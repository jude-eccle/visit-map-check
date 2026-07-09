
-- Dedupe existing rows: keep newest per (zone_id, team_name)
DELETE FROM public.zone_completions
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY zone_id, team_name ORDER BY created_at DESC) AS rn
    FROM public.zone_completions
  ) t WHERE rn > 1
);

-- Also remove completions for zones that are no longer marked done
DELETE FROM public.zone_completions zc
USING public.zones z
WHERE zc.zone_id = z.id AND z.status <> 'done';

CREATE UNIQUE INDEX IF NOT EXISTS zone_completions_zone_team_unique
  ON public.zone_completions (zone_id, team_name);
