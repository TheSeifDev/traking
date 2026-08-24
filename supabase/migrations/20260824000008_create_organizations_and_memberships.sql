-- TrackUp: additive Organization hierarchy above the existing Spaces model.
-- This migration preserves existing Space/resource/tracking IDs and data.

DO $$ BEGIN
  CREATE TYPE public.organization_member_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.organization_member_status AS ENUM ('active', 'suspended', 'removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
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
  CONSTRAINT organizations_slug_unique UNIQUE (slug),
  CONSTRAINT organizations_clickup_workspace_unique UNIQUE (clickup_workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_organizations_clickup_workspace_id
  ON public.organizations(clickup_workspace_id);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by
  ON public.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_archived_at
  ON public.organizations(archived_at);

DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct organization reads" ON public.organizations;
CREATE POLICY "No direct organization reads"
  ON public.organizations FOR SELECT TO authenticated USING (false);
DROP POLICY IF EXISTS "No anonymous organization reads" ON public.organizations;
CREATE POLICY "No anonymous organization reads"
  ON public.organizations FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "No direct organization inserts" ON public.organizations;
CREATE POLICY "No direct organization inserts"
  ON public.organizations FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct organization updates" ON public.organizations;
CREATE POLICY "No direct organization updates"
  ON public.organizations FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct organization deletes" ON public.organizations;
CREATE POLICY "No direct organization deletes"
  ON public.organizations FOR DELETE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  profile_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  role             public.organization_member_role NOT NULL DEFAULT 'member',
  status           public.organization_member_status NOT NULL DEFAULT 'active',
  joined_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT organization_members_org_profile_unique UNIQUE (organization_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_members_organization_id
  ON public.organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_profile_id
  ON public.organization_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_status
  ON public.organization_members(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_role_status
  ON public.organization_members(organization_id, role, status);

DROP TRIGGER IF EXISTS set_organization_members_updated_at ON public.organization_members;
CREATE TRIGGER set_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct organization member reads" ON public.organization_members;
CREATE POLICY "No direct organization member reads"
  ON public.organization_members FOR SELECT TO authenticated USING (false);
DROP POLICY IF EXISTS "No anonymous organization member reads" ON public.organization_members;
CREATE POLICY "No anonymous organization member reads"
  ON public.organization_members FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "No direct organization member inserts" ON public.organization_members;
CREATE POLICY "No direct organization member inserts"
  ON public.organization_members FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct organization member updates" ON public.organization_members;
CREATE POLICY "No direct organization member updates"
  ON public.organization_members FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct organization member deletes" ON public.organization_members;
CREATE POLICY "No direct organization member deletes"
  ON public.organization_members FOR DELETE TO authenticated USING (false);

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS organization_id UUID;

DO $$ BEGIN
  ALTER TABLE public.spaces
    ADD CONSTRAINT spaces_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_spaces_organization_id
  ON public.spaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_spaces_organization_archived_at
  ON public.spaces(organization_id, archived_at);

-- One deterministic Organization for each existing Space, including spaces that
-- are not linked to ClickUp. ClickUp is an optional relationship, not the tenant root.
INSERT INTO public.organizations (name, slug, clickup_workspace_id, created_by, settings)
SELECT
  left(s.name, 160),
  'organization-' || left(replace(s.id::text, '-', ''), 24),
  s.clickup_workspace_id,
  s.created_by,
  '{}'::jsonb
FROM public.spaces AS s
ON CONFLICT (clickup_workspace_id) DO NOTHING;

UPDATE public.spaces AS s
SET organization_id = o.id
FROM public.organizations AS o
WHERE s.organization_id IS NULL
  AND o.slug = 'organization-' || left(replace(s.id::text, '-', ''), 24);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.spaces WHERE organization_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce organization_id: one or more spaces are unmapped';
  END IF;
END $$;

ALTER TABLE public.spaces
  ALTER COLUMN organization_id SET NOT NULL;

-- Preserve the strongest existing Space role as the Organization role.
INSERT INTO public.organization_members (organization_id, profile_id, role, status, joined_at)
SELECT
  s.organization_id,
  sm.profile_id,
  CASE WHEN bool_or(sm.role = 'admin'::public.space_member_role) THEN 'admin'::public.organization_member_role ELSE 'member'::public.organization_member_role END,
  'active'::public.organization_member_status,
  min(sm.joined_at)
FROM public.spaces AS s
JOIN public.space_members AS sm ON sm.space_id = s.id
WHERE sm.status = 'active'
GROUP BY s.organization_id, sm.profile_id
ON CONFLICT (organization_id, profile_id) DO NOTHING;
