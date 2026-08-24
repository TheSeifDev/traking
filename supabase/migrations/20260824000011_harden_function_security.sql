-- Security hardening for helper functions exposed through the Supabase REST schema.
-- These functions are only used by server-side RLS/triggers and must not be
-- callable by anon or authenticated clients.

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin_or_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin_or_owner() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_owner() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- rls_auto_enable is a legacy helper that may exist in an already-provisioned
-- database but is not part of the current repository migrations. Revoke it
-- when present without making fresh installs depend on that legacy object.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;
  END IF;
END;
$$;
