-- TrackUp: additive multi-tenant Spaces and Space memberships
--
-- This migration preserves all existing profiles, workspaces, videos, links,
-- sessions, events, invitations, and legacy viewer rows. Existing resources are
-- assigned to one deterministic Space per ClickUp workspace.

DO $$ BEGIN
  CREATE TYPE public.space_member_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.space_member_status AS ENUM ('active', 'suspended', 'removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.spaces (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  slug                 TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,95}[a-z0-9]$'),
  clickup_workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  settings             JSONB NOT NULL DEFAULT '{}'::jsonb
                       CHECK (jsonb_typeof(settings) = 'object' AND octet_length(settings::text) <= 8192),
  archived_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT spaces_slug_unique UNIQUE (slug),
  CONSTRAINT spaces_clickup_workspace_unique UNIQUE (clickup_workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_spaces_clickup_workspace_id
  ON public.spaces(clickup_workspace_id);
CREATE INDEX IF NOT EXISTS idx_spaces_created_by
  ON public.spaces(created_by);
CREATE INDEX IF NOT EXISTS idx_spaces_archived_at
  ON public.spaces(archived_at);

DROP TRIGGER IF EXISTS set_spaces_updated_at ON public.spaces;
CREATE TRIGGER set_spaces_updated_at
  BEFORE UPDATE ON public.spaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct space reads" ON public.spaces;
CREATE POLICY "No direct space reads"
  ON public.spaces FOR SELECT TO authenticated USING (false);
DROP POLICY IF EXISTS "No anonymous space reads" ON public.spaces;
CREATE POLICY "No anonymous space reads"
  ON public.spaces FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "No direct space inserts" ON public.spaces;
CREATE POLICY "No direct space inserts"
  ON public.spaces FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct space updates" ON public.spaces;
CREATE POLICY "No direct space updates"
  ON public.spaces FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct space deletes" ON public.spaces;
CREATE POLICY "No direct space deletes"
  ON public.spaces FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.space_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    UUID NOT NULL REFERENCES public.spaces(id) ON DELETE RESTRICT,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role        public.space_member_role NOT NULL DEFAULT 'member',
  status      public.space_member_status NOT NULL DEFAULT 'active',
  joined_at   TIMESTAMPTZ,
  source      TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'clickup')),
  clickup_user_id TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT space_members_space_profile_unique UNIQUE (space_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_space_members_space_id
  ON public.space_members(space_id);
CREATE INDEX IF NOT EXISTS idx_space_members_profile_id
  ON public.space_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_space_members_role
  ON public.space_members(role);
CREATE INDEX IF NOT EXISTS idx_space_members_status
  ON public.space_members(status);
CREATE INDEX IF NOT EXISTS idx_space_members_space_status
  ON public.space_members(space_id, status);
CREATE INDEX IF NOT EXISTS idx_space_members_space_source_status
  ON public.space_members(space_id, source, status);
CREATE INDEX IF NOT EXISTS idx_space_members_space_clickup_user
  ON public.space_members(space_id, clickup_user_id);

DROP TRIGGER IF EXISTS set_space_members_updated_at ON public.space_members;
CREATE TRIGGER set_space_members_updated_at
  BEFORE UPDATE ON public.space_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct space member reads" ON public.space_members;
CREATE POLICY "No direct space member reads"
  ON public.space_members FOR SELECT TO authenticated USING (false);
DROP POLICY IF EXISTS "No anonymous space member reads" ON public.space_members;
CREATE POLICY "No anonymous space member reads"
  ON public.space_members FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "No direct space member inserts" ON public.space_members;
CREATE POLICY "No direct space member inserts"
  ON public.space_members FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct space member updates" ON public.space_members;
CREATE POLICY "No direct space member updates"
  ON public.space_members FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct space member deletes" ON public.space_members;
CREATE POLICY "No direct space member deletes"
  ON public.space_members FOR DELETE TO authenticated USING (false);

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS space_id UUID;

DO $$ BEGIN
  ALTER TABLE public.videos
    ADD CONSTRAINT videos_space_id_fkey
    FOREIGN KEY (space_id) REFERENCES public.spaces(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_videos_space_id
  ON public.videos(space_id);

-- One deterministic TrackUp Space per existing ClickUp Workspace.
INSERT INTO public.spaces (name, slug, clickup_workspace_id)
SELECT
  left(w.name, 160),
  left('clickup-' || regexp_replace(lower(w.clickup_team_id), '[^a-z0-9]+', '-', 'g'), 96),
  w.id
FROM public.workspaces AS w
ON CONFLICT (clickup_workspace_id) DO NOTHING;

-- Existing connected profiles receive a Space membership once. DO NOTHING is
-- intentional: a later migration or local admin action must not be overwritten.
INSERT INTO public.space_members (space_id, profile_id, role, status, joined_at)
SELECT
  s.id,
  c.profile_id,
  CASE
    WHEN p.role IN ('owner'::public.user_role, 'admin'::public.user_role)
      THEN 'admin'::public.space_member_role
    ELSE 'member'::public.space_member_role
  END,
  'active'::public.space_member_status,
  timezone('utc', now())
FROM public.clickup_connections AS c
JOIN public.spaces AS s ON s.clickup_workspace_id = c.workspace_id
JOIN public.profiles AS p ON p.id = c.profile_id
ON CONFLICT (space_id, profile_id) DO NOTHING;

-- Preserve existing resource ownership while adding a Space root.
UPDATE public.videos AS v
SET space_id = s.id
FROM public.spaces AS s
WHERE v.space_id IS NULL
  AND s.clickup_workspace_id = v.workspace_id;
