-- ==============================================================================
-- TrackUp Migration: Role Change Audit Log
-- ==============================================================================

-- 1. Create the audit table
--    Immutable append-only log of every role change the owner performs.
--    Rows are never updated or deleted — only inserted.

CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id   UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  changed_by_user_id UUID       NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  previous_role    public.user_role NOT NULL,
  new_role         public.user_role NOT NULL,
  changed_at       TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_audit_target_user
  ON public.role_change_audit(target_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_changed_by
  ON public.role_change_audit(changed_by_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_changed_at
  ON public.role_change_audit(changed_at DESC);

-- 3. Enable RLS — all access goes through the service-role admin client.
--    Application code never reads this with the anon/authenticated key.
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

-- 4. RLS policy: only the owner can view the audit log through the normal key.
--    The admin client (service_role) bypasses RLS and is used for inserts.
DROP POLICY IF EXISTS "Owner can read role change audit" ON public.role_change_audit;
CREATE POLICY "Owner can read role change audit"
  ON public.role_change_audit
  FOR SELECT
  TO authenticated
  USING (public.is_owner());

-- Deny all inserts from the authenticated role — only service_role can insert.
DROP POLICY IF EXISTS "No direct inserts to audit log" ON public.role_change_audit;
CREATE POLICY "No direct inserts to audit log"
  ON public.role_change_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- 5. Constraint: previous_role and new_role must differ.
--    Prevents no-op audit entries.
ALTER TABLE public.role_change_audit
  DROP CONSTRAINT IF EXISTS audit_roles_must_differ;

ALTER TABLE public.role_change_audit
  ADD CONSTRAINT audit_roles_must_differ
  CHECK (previous_role <> new_role);

-- 6. Constraint: 'owner' role can never appear as new_role in the audit log.
--    Provides an extra database-level guarantee that owner is never assigned
--    through the role management system.
ALTER TABLE public.role_change_audit
  DROP CONSTRAINT IF EXISTS audit_new_role_not_owner;

ALTER TABLE public.role_change_audit
  ADD CONSTRAINT audit_new_role_not_owner
  CHECK (new_role <> 'owner'::public.user_role);
