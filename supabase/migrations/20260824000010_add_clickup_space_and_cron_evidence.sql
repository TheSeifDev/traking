-- TrackUp: additive ClickUp hierarchy metadata and trusted cron execution evidence.
-- Existing historical rows are preserved. No tracking/session/event rows are changed.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS clickup_sync_status TEXT NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS clickup_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clickup_sync_error TEXT;

DO $$ BEGIN
  ALTER TABLE public.organizations
    ADD CONSTRAINT organizations_clickup_sync_status_check
    CHECK (clickup_sync_status IN ('never', 'running', 'success', 'partial', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_organizations_clickup_sync_status
  ON public.organizations(clickup_sync_status, clickup_last_synced_at DESC);

ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS clickup_space_id TEXT,
  ADD COLUMN IF NOT EXISTS clickup_sync_status TEXT NOT NULL DEFAULT 'never',
  ADD COLUMN IF NOT EXISTS clickup_last_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clickup_sync_error TEXT;

DO $$ BEGIN
  ALTER TABLE public.spaces
    ADD CONSTRAINT spaces_clickup_sync_status_check
    CHECK (clickup_sync_status IN ('never', 'running', 'success', 'partial', 'failed'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_spaces_clickup_space_id
  ON public.spaces(clickup_space_id)
  WHERE clickup_space_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spaces_clickup_sync_status
  ON public.spaces(clickup_sync_status, clickup_last_synced_at DESC);

COMMENT ON COLUMN public.organizations.clickup_sync_status IS
  'Last persisted ClickUp Workspace sync state. never is used until an explicit sync is attempted.';
COMMENT ON COLUMN public.spaces.clickup_space_id IS
  'ClickUp Space identity. NULL for legacy TrackUp Spaces created before explicit ClickUp Space mapping.';
COMMENT ON COLUMN public.spaces.clickup_workspace_id IS
  'Legacy ClickUp Workspace relationship retained for backward compatibility; new hierarchy mapping uses organizations.clickup_workspace_id plus spaces.clickup_space_id.';

CREATE TABLE IF NOT EXISTS public.cron_executions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name           TEXT NOT NULL CHECK (char_length(job_name) BETWEEN 1 AND 120),
  schedule           TEXT NOT NULL CHECK (char_length(schedule) BETWEEN 1 AND 80),
  execution_key      TEXT NOT NULL CHECK (char_length(execution_key) BETWEEN 1 AND 240),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  finished_at        TIMESTAMPTZ,
  status             TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
  http_status        INTEGER CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
  latency_ms         INTEGER CHECK (latency_ms IS NULL OR (latency_ms >= 0 AND latency_ms <= 86400000)),
  health_status      TEXT CHECK (health_status IS NULL OR health_status IN ('healthy', 'degraded', 'unknown')),
  error_code         TEXT CHECK (error_code IS NULL OR char_length(error_code) <= 160),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT cron_executions_key_unique UNIQUE (job_name, execution_key)
);

CREATE INDEX IF NOT EXISTS idx_cron_executions_job_started_at
  ON public.cron_executions(job_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_executions_status_started_at
  ON public.cron_executions(status, started_at DESC);

ALTER TABLE public.cron_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No direct cron execution reads" ON public.cron_executions;
CREATE POLICY "No direct cron execution reads"
  ON public.cron_executions FOR SELECT TO authenticated USING (false);
DROP POLICY IF EXISTS "No anonymous cron execution reads" ON public.cron_executions;
CREATE POLICY "No anonymous cron execution reads"
  ON public.cron_executions FOR SELECT TO anon USING (false);
DROP POLICY IF EXISTS "No direct cron execution inserts" ON public.cron_executions;
CREATE POLICY "No direct cron execution inserts"
  ON public.cron_executions FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS "No direct cron execution updates" ON public.cron_executions;
CREATE POLICY "No direct cron execution updates"
  ON public.cron_executions FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "No direct cron execution deletes" ON public.cron_executions;
CREATE POLICY "No direct cron execution deletes"
  ON public.cron_executions FOR DELETE TO authenticated USING (false);
