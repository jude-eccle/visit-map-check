ALTER PUBLICATION supabase_realtime ADD TABLE public.zone_activity;
ALTER TABLE public.zone_activity REPLICA IDENTITY FULL;