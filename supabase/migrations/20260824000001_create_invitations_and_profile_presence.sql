-- TrackUp: secure team invitations and authenticated profile presence
-- Raw invitation tokens are never stored; only a SHA-256 digest is persisted.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON public.profiles(last_seen_at);

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.user_role NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT invitations_role_check CHECK (role IN ('admin'::public.user_role, 'viewer'::public.user_role)),
  CONSTRAINT invitations_expiry_after_creation CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_invitations_profile_id
  ON public.invitations(profile_id);

CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON public.invitations(email);

CREATE INDEX IF NOT EXISTS idx_invitations_expires_at
  ON public.invitations(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_one_active_per_profile
  ON public.invitations(profile_id)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct invitation reads" ON public.invitations;
CREATE POLICY "No direct invitation reads"
  ON public.invitations
  FOR SELECT
  TO authenticated
  USING (false);

DROP POLICY IF EXISTS "No direct invitation inserts" ON public.invitations;
CREATE POLICY "No direct invitation inserts"
  ON public.invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct invitation updates" ON public.invitations;
CREATE POLICY "No direct invitation updates"
  ON public.invitations
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct invitation deletes" ON public.invitations;
CREATE POLICY "No direct invitation deletes"
  ON public.invitations
  FOR DELETE
  TO authenticated
  USING (false);
