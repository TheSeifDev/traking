-- The application writes through server-side service-role code after its own
-- authenticated profile, Space, and capability checks. Public PostgREST clients
-- must not enumerate workspaces or write legacy guest-style tracking rows.

DROP POLICY IF EXISTS "Authenticated users can read workspaces" ON public.workspaces;
CREATE POLICY "No direct workspace reads"
  ON public.workspaces
  FOR SELECT
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "Anon can insert watch sessions" ON public.watch_sessions;
DROP POLICY IF EXISTS "Anon can insert watch events" ON public.watch_events;

REVOKE ALL ON TABLE public.workspaces FROM anon, authenticated;
REVOKE ALL ON TABLE public.watch_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.watch_events FROM anon, authenticated;
