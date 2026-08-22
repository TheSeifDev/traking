-- ==============================================================================
-- TrackUp Migration: MVP Core Product Tables
-- ==============================================================================

-- 1. VIDEO SOURCE TYPE ENUM
DO $$ BEGIN
  CREATE TYPE public.video_source_type AS ENUM (
    'youtube',
    'google_drive',
    'vimeo',
    'telegram',
    'direct_url'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. WATCH EVENT TYPE ENUM
DO $$ BEGIN
  CREATE TYPE public.watch_event_type AS ENUM (
    'play',
    'pause',
    'seek',
    'heartbeat',
    'complete',
    'ended'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. WORKSPACES
CREATE TABLE IF NOT EXISTS public.workspaces (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  clickup_team_id  TEXT         NOT NULL UNIQUE,
  name             TEXT         NOT NULL,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now()),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_workspaces_clickup_team_id
  ON public.workspaces(clickup_team_id);

DROP TRIGGER IF EXISTS set_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER set_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct workspace inserts" ON public.workspaces;
CREATE POLICY "No direct workspace inserts"
  ON public.workspaces FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct workspace updates" ON public.workspaces;
CREATE POLICY "No direct workspace updates"
  ON public.workspaces FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct workspace deletes" ON public.workspaces;
CREATE POLICY "No direct workspace deletes"
  ON public.workspaces FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "Authenticated users can read workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can read workspaces"
  ON public.workspaces FOR SELECT TO authenticated USING (true);

-- 4. CLICKUP_CONNECTIONS
CREATE TABLE IF NOT EXISTS public.clickup_connections (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id   UUID         NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  access_token   TEXT         NOT NULL,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now()),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (profile_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_clickup_connections_profile_id
  ON public.clickup_connections(profile_id);

CREATE INDEX IF NOT EXISTS idx_clickup_connections_workspace_id
  ON public.clickup_connections(workspace_id);

DROP TRIGGER IF EXISTS set_clickup_connections_updated_at ON public.clickup_connections;
CREATE TRIGGER set_clickup_connections_updated_at
  BEFORE UPDATE ON public.clickup_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.clickup_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct connection reads" ON public.clickup_connections;
CREATE POLICY "No direct connection reads"
  ON public.clickup_connections FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS "No direct connection inserts" ON public.clickup_connections;
CREATE POLICY "No direct connection inserts"
  ON public.clickup_connections FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct connection updates" ON public.clickup_connections;
CREATE POLICY "No direct connection updates"
  ON public.clickup_connections FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct connection deletes" ON public.clickup_connections;
CREATE POLICY "No direct connection deletes"
  ON public.clickup_connections FOR DELETE TO authenticated USING (false);

-- 5. VIDEOS
CREATE TABLE IF NOT EXISTS public.videos (
  id            UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID                      NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    UUID                      REFERENCES public.profiles(id) ON DELETE SET NULL,
  title         TEXT                      NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  description   TEXT,
  source_type   public.video_source_type  NOT NULL,
  source_url    TEXT                      NOT NULL CHECK (char_length(source_url) > 0),
  duration      INTEGER,
  created_at    TIMESTAMPTZ               NOT NULL DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMPTZ               NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_videos_workspace_id ON public.videos(workspace_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_by ON public.videos(created_by);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

DROP TRIGGER IF EXISTS set_videos_updated_at ON public.videos;
CREATE TRIGGER set_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct video inserts" ON public.videos;
CREATE POLICY "No direct video inserts"
  ON public.videos FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct video updates" ON public.videos;
CREATE POLICY "No direct video updates"
  ON public.videos FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No direct video deletes" ON public.videos;
CREATE POLICY "No direct video deletes"
  ON public.videos FOR DELETE TO authenticated USING (false);

DROP POLICY IF EXISTS "No direct video reads" ON public.videos;
CREATE POLICY "No direct video reads"
  ON public.videos FOR SELECT TO authenticated USING (false);

-- 6. VIDEO_CLICKUP_TASKS
CREATE TABLE IF NOT EXISTS public.video_clickup_tasks (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id           UUID        NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  clickup_task_id    TEXT        NOT NULL,
  clickup_task_name  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (video_id, clickup_task_id)
);

CREATE INDEX IF NOT EXISTS idx_video_clickup_tasks_video_id
  ON public.video_clickup_tasks(video_id);

ALTER TABLE public.video_clickup_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct task association inserts" ON public.video_clickup_tasks;
CREATE POLICY "No direct task association inserts"
  ON public.video_clickup_tasks FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct task association reads" ON public.video_clickup_tasks;
CREATE POLICY "No direct task association reads"
  ON public.video_clickup_tasks FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS "No direct task association deletes" ON public.video_clickup_tasks;
CREATE POLICY "No direct task association deletes"
  ON public.video_clickup_tasks FOR DELETE TO authenticated USING (false);

-- 7. WATCH_LINKS
-- NOTE: Supabase installs pgcrypto in the extensions schema. Schema-qualify
-- gen_random_bytes() and build a URL-safe token by translating base64 output.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.watch_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id    UUID        NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE DEFAULT translate(
                             encode(extensions.gen_random_bytes(24), 'base64'),
                             '+/=',
                             '-_'
                           ),
  created_by  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_watch_links_token ON public.watch_links(token);
CREATE INDEX IF NOT EXISTS idx_watch_links_video_id ON public.watch_links(video_id);

ALTER TABLE public.watch_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No direct watch_link reads" ON public.watch_links;
CREATE POLICY "No direct watch_link reads"
  ON public.watch_links FOR SELECT TO authenticated USING (false);

DROP POLICY IF EXISTS "No anon watch_link reads" ON public.watch_links;
CREATE POLICY "No anon watch_link reads"
  ON public.watch_links FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "No direct watch_link inserts" ON public.watch_links;
CREATE POLICY "No direct watch_link inserts"
  ON public.watch_links FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "No direct watch_link deletes" ON public.watch_links;
CREATE POLICY "No direct watch_link deletes"
  ON public.watch_links FOR DELETE TO authenticated USING (false);

-- 8. WATCH_SESSIONS
CREATE TABLE IF NOT EXISTS public.watch_sessions (
  id                     UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_link_id          UUID         NOT NULL REFERENCES public.watch_links(id) ON DELETE CASCADE,
  viewer_identifier      TEXT,
  started_at             TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now()),
  last_seen_at           TIMESTAMPTZ  NOT NULL DEFAULT timezone('utc', now()),
  ended_at               TIMESTAMPTZ,
  watch_time_seconds     INTEGER      NOT NULL DEFAULT 0,
  completion_percentage  NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (completion_percentage >= 0 AND completion_percentage <= 100)
);

CREATE INDEX IF NOT EXISTS idx_watch_sessions_watch_link_id
  ON public.watch_sessions(watch_link_id);
CREATE INDEX IF NOT EXISTS idx_watch_sessions_started_at
  ON public.watch_sessions(started_at DESC);

ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert watch sessions" ON public.watch_sessions;
CREATE POLICY "Anon can insert watch sessions"
  ON public.watch_sessions FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "No anon watch_session reads" ON public.watch_sessions;
CREATE POLICY "No anon watch_session reads"
  ON public.watch_sessions FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "No anon watch_session updates" ON public.watch_sessions;
CREATE POLICY "No anon watch_session updates"
  ON public.watch_sessions FOR UPDATE TO anon USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No authenticated watch_session reads" ON public.watch_sessions;
CREATE POLICY "No authenticated watch_session reads"
  ON public.watch_sessions FOR SELECT TO authenticated USING (false);

-- 9. WATCH_EVENTS
CREATE TABLE IF NOT EXISTS public.watch_events (
  id          UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID                     NOT NULL REFERENCES public.watch_sessions(id) ON DELETE CASCADE,
  event_type  public.watch_event_type  NOT NULL,
  position    NUMERIC(10,2)            NOT NULL DEFAULT 0,
  duration    NUMERIC(10,2),
  created_at  TIMESTAMPTZ              NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_watch_events_session_id
  ON public.watch_events(session_id);
CREATE INDEX IF NOT EXISTS idx_watch_events_created_at
  ON public.watch_events(created_at DESC);

ALTER TABLE public.watch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anon can insert watch events" ON public.watch_events;
CREATE POLICY "Anon can insert watch events"
  ON public.watch_events FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "No anon watch_event reads" ON public.watch_events;
CREATE POLICY "No anon watch_event reads"
  ON public.watch_events FOR SELECT TO anon USING (false);

DROP POLICY IF EXISTS "No authenticated watch_event reads" ON public.watch_events;
CREATE POLICY "No authenticated watch_event reads"
  ON public.watch_events FOR SELECT TO authenticated USING (false);
