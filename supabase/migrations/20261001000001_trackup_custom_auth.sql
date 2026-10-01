-- ==============================================================================
-- TrackUp Migration: Sovereign Custom Authentication & Server-Side Sessions
-- ==============================================================================

-- 1. Ensure user_role enum exists
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Expand public.profiles for Native Credentials & Security Controls
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;

-- 3. Case-Insensitive Unique Indexes for Username and Email
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(username));

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON public.profiles (LOWER(email));

-- Backfill usernames for existing profiles if null (using local-part of email)
UPDATE public.profiles
SET username = SPLIT_PART(email, '@', 1)
WHERE username IS NULL;

-- 4. Create Server-Side Session Storage Table
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  revoked_at TIMESTAMPTZ NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL
);

-- 5. Session Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_lookup
  ON public.user_sessions(session_token_hash)
  WHERE is_revoked = false;

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_active_expiry
  ON public.user_sessions(expires_at)
  WHERE is_revoked = false;

-- 6. Rate Limiting Storage Table
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 1,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_expiry
  ON public.auth_rate_limits(expires_at);

-- 7. Add organization_id to public.videos for ClickUp Decoupling
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Make videos.workspace_id nullable to allow videos to exist independently
ALTER TABLE public.videos
  ALTER COLUMN workspace_id DROP NOT NULL;

-- Backfill videos.organization_id from spaces if possible
UPDATE public.videos v
SET organization_id = s.organization_id
FROM public.spaces s
WHERE v.space_id = s.id AND v.organization_id IS NULL;

-- 8. Row Level Security on user_sessions & auth_rate_limits
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct client access to user_sessions" ON public.user_sessions;
CREATE POLICY "No direct client access to user_sessions"
  ON public.user_sessions
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct client access to auth_rate_limits" ON public.auth_rate_limits;
CREATE POLICY "No direct client access to auth_rate_limits"
  ON public.auth_rate_limits
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 9. Periodic Session Cleanup Stored Procedure
CREATE OR REPLACE FUNCTION public.cleanup_expired_user_sessions()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM public.user_sessions
  WHERE expires_at < (timezone('utc'::text, now()) - interval '14 days')
     OR (is_revoked = true AND revoked_at < (timezone('utc'::text, now()) - interval '7 days'));
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
