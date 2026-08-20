-- ==============================================================================
-- TrackUp Migration: Create RBAC Enum, Profiles Table, and Security Policies
-- ==============================================================================

-- 1. Create PostgreSQL User Role Enum (owner, admin, viewer)
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('owner', 'admin', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clickup_user_id TEXT UNIQUE,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  role public.user_role NOT NULL DEFAULT 'viewer'::public.user_role,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_clickup_user_id ON public.profiles(clickup_user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- 4. Updated At Trigger Function & Trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Helper Functions for Secure RLS (SECURITY DEFINER avoids recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role AS $$
DECLARE
  v_role public.user_role;
BEGIN
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() AND is_active = true;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('owner'::public.user_role, 'admin'::public.user_role)
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_admin_or_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role = 'owner'::public.user_role
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.is_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- 6. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies

-- Select Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins and owners can read all profiles" ON public.profiles;
CREATE POLICY "Admins and owners can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_owner());

-- Write Policies
-- All profile writes are intentionally denied to normal authenticated clients.
-- Provisioning, role changes, status changes, and ClickUp identity sync must go
-- through server-only service-role code, which performs centralized checks.
DROP POLICY IF EXISTS "Admins and owners can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own non-sensitive profile data" ON public.profiles;
DROP POLICY IF EXISTS "No direct profile updates" ON public.profiles;
CREATE POLICY "No direct profile updates"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Admins and owners can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "No direct profile inserts" ON public.profiles;
CREATE POLICY "No direct profile inserts"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "Only owners can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "No direct profile deletes" ON public.profiles;
CREATE POLICY "No direct profile deletes"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (false);
