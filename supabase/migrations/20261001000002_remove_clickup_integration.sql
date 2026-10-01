-- ==============================================================================
-- TrackUp Migration: Sovereign Independence & ClickUp Deprecation
-- ==============================================================================

-- 1. Drop ClickUp-specific legacy tables
DROP TABLE IF EXISTS public.video_clickup_tasks CASCADE;
DROP TABLE IF EXISTS public.clickup_connections CASCADE;

-- 2. Decouple public.videos from public.workspaces
UPDATE public.videos v
SET organization_id = s.organization_id
FROM public.spaces s
WHERE v.space_id = s.id AND v.organization_id IS NULL;

ALTER TABLE public.videos DROP CONSTRAINT IF EXISTS videos_workspace_id_fkey;
ALTER TABLE public.videos DROP COLUMN IF EXISTS workspace_id CASCADE;

-- 3. Decouple public.spaces from public.workspaces and ClickUp metadata
DROP INDEX IF EXISTS public.uq_spaces_clickup_space_id;
DROP INDEX IF EXISTS public.idx_spaces_clickup_sync_status;
DROP INDEX IF EXISTS public.idx_spaces_clickup_workspace_id;

ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_clickup_sync_status_check;
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_clickup_workspace_unique;
ALTER TABLE public.spaces DROP CONSTRAINT IF EXISTS spaces_clickup_workspace_id_fkey;

ALTER TABLE public.spaces DROP COLUMN IF EXISTS clickup_workspace_id CASCADE;
ALTER TABLE public.spaces DROP COLUMN IF EXISTS clickup_space_id CASCADE;
ALTER TABLE public.spaces DROP COLUMN IF EXISTS clickup_sync_status CASCADE;
ALTER TABLE public.spaces DROP COLUMN IF EXISTS clickup_last_synced_at CASCADE;
ALTER TABLE public.spaces DROP COLUMN IF EXISTS clickup_sync_error CASCADE;

-- 4. Decouple public.organizations from public.workspaces and ClickUp metadata
DROP INDEX IF EXISTS public.idx_organizations_clickup_sync_status;
DROP INDEX IF EXISTS public.idx_organizations_clickup_workspace_id;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_clickup_sync_status_check;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_clickup_workspace_unique;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_clickup_workspace_id_fkey;

ALTER TABLE public.organizations DROP COLUMN IF EXISTS clickup_workspace_id CASCADE;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS clickup_sync_status CASCADE;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS clickup_last_synced_at CASCADE;
ALTER TABLE public.organizations DROP COLUMN IF EXISTS clickup_sync_error CASCADE;

-- 5. Decouple public.space_members from ClickUp metadata
DROP INDEX IF EXISTS public.idx_space_members_space_clickup_user;

ALTER TABLE public.space_members DROP COLUMN IF EXISTS source CASCADE;
ALTER TABLE public.space_members DROP COLUMN IF EXISTS clickup_user_id CASCADE;
ALTER TABLE public.space_members DROP COLUMN IF EXISTS last_synced_at CASCADE;

-- 6. Decouple public.profiles from ClickUp user ID
DROP INDEX IF EXISTS public.idx_profiles_clickup_user_id;
DROP FUNCTION IF EXISTS public.accept_invitation(UUID, TEXT, TEXT, TEXT, TEXT);

ALTER TABLE public.profiles DROP COLUMN IF EXISTS clickup_user_id CASCADE;

-- 7. Drop legacy ClickUp workspaces table
DROP TABLE IF EXISTS public.workspaces CASCADE;
