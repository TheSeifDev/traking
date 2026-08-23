-- TrackUp Migration: Secure owner observability logs
-- Additive only: does not alter tracking tables or existing audit history.

CREATE TABLE IF NOT EXISTS public.owner_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  level TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  category TEXT NOT NULL CHECK (category IN ('AUTH', 'TRACKING', 'SESSION', 'VIDEO', 'ANALYTICS', 'API', 'DATABASE', 'SYSTEM', 'PROVIDER', 'SECURITY')),
  action TEXT NOT NULL CHECK (char_length(action) BETWEEN 1 AND 120),
  user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  video_id UUID NULL REFERENCES public.videos(id) ON DELETE SET NULL,
  session_id UUID NULL REFERENCES public.watch_sessions(id) ON DELETE SET NULL,
  route TEXT NULL CHECK (route IS NULL OR char_length(route) <= 240),
  status INTEGER NULL CHECK (status IS NULL OR (status >= 100 AND status <= 599)),
  duration_ms INTEGER NULL CHECK (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms <= 86400000)),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT owner_logs_metadata_bounded CHECK (octet_length(metadata::text) <= 4096)
);

CREATE INDEX IF NOT EXISTS idx_owner_logs_created_at
  ON public.owner_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_logs_level_created_at
  ON public.owner_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_logs_category_created_at
  ON public.owner_logs(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_logs_user_created_at
  ON public.owner_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_logs_video_created_at
  ON public.owner_logs(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_logs_session_created_at
  ON public.owner_logs(session_id, created_at DESC);

ALTER TABLE public.owner_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct owner log reads" ON public.owner_logs;
CREATE POLICY "No direct owner log reads"
  ON public.owner_logs
  FOR SELECT
  TO anon, authenticated
  USING (false);

DROP POLICY IF EXISTS "No direct owner log inserts" ON public.owner_logs;
CREATE POLICY "No direct owner log inserts"
  ON public.owner_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct owner log updates" ON public.owner_logs;
CREATE POLICY "No direct owner log updates"
  ON public.owner_logs
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "No direct owner log deletes" ON public.owner_logs;
CREATE POLICY "No direct owner log deletes"
  ON public.owner_logs
  FOR DELETE
  TO anon, authenticated
  USING (false);
