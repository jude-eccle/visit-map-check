
-- Lock down app_settings: remove public read/write. Only service_role (via server functions) can access it.
DROP POLICY IF EXISTS "Anyone can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can read app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Anyone can update app settings" ON public.app_settings;

REVOKE ALL ON public.app_settings FROM anon, authenticated, PUBLIC;
GRANT ALL ON public.app_settings TO service_role;

-- RLS stays enabled; with no policies, anon/authenticated cannot access even if grants existed.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
