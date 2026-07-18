
ALTER TABLE public.zone_events
  ADD COLUMN IF NOT EXISTS decided BOOLEAN,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.zone_events ALTER COLUMN zone_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='zone_events' AND policyname='public update event decided'
  ) THEN
    CREATE POLICY "public update event decided" ON public.zone_events
      FOR UPDATE USING (true) WITH CHECK (source = 'app');
  END IF;
END $$;
